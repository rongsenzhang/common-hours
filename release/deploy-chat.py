"""Provision and verify the Common Hours Worker from a trusted release job."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import build_opener, HTTPRedirectHandler, Request

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.cloudflare.com/client/v4"
REPOSITORY = "rongsenzhang/common-hours"
ORIGIN = "https://rongsenzhang.github.io"
WORKER = "common-hours-volunteer-chat"
MODEL = "gpt-5.4-mini-2026-03-17"
WRANGLER_VERSION = "4.165.0"


class DeploymentError(Exception):
    pass


class CloudflareError(DeploymentError):
    def __init__(self, status, codes):
        self.status, self.codes = status, set(codes)
        message = f"Cloudflare returned HTTP {status}, error codes {sorted(self.codes)}."
        if 9106 in self.codes:
            message += " Cloudflare did not recognise the authentication supplied. Check the scoped token value in CLOUDFLARE_API_TOKEN."
        super().__init__(message)


class NoRedirect(HTTPRedirectHandler):
    """Credentials and smoke requests may only reach their named HTTPS origin."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def request(url, *, method="GET", headers=None, data=None, timeout=20):
    outgoing = {"User-Agent": "Common-Hours-Worker-Deploy", **(headers or {})}
    body = None
    if data is not None:
        body = json.dumps(data).encode()
        outgoing["Content-Type"] = "application/json"
    req = Request(url, data=body, method=method, headers=outgoing)
    try:
        response = build_opener(NoRedirect).open(req, timeout=timeout)
    except HTTPError as error:
        response = error
    with response:
        raw = response.read(500_001)
        if len(raw) > 500_000:
            raise DeploymentError("Received an oversized deployment response.")
        try:
            payload = json.loads(raw) if raw else {}
        except ValueError:
            payload = {}
        return response.status, response.headers, payload


def cloudflare(token):
    def call(path, method="GET", data=None):
        status, _, payload = request(API + path, method=method, data=data,
                                     headers={"Authorization": "Bearer " + token})
        if not isinstance(payload, dict):
            raise DeploymentError("Unexpected Cloudflare API response.")
        if not 200 <= status < 300 or payload.get("success") is not True:
            codes = [x["code"] for x in payload.get("errors", [])
                     if isinstance(x, dict) and isinstance(x.get("code"), int)]
            raise CloudflareError(status, codes)
        return payload["result"]
    return call


def token_kind(value):
    # Current user and account API tokens have different verify endpoints.
    # Legacy scoped tokens do not identify their owner in their format.
    if re.fullmatch(r"cf(?:u|a)t_[A-Za-z0-9_-]{41,75}", value):
        return "user" if value.startswith("cfut_") else "account"
    known_prefix = value.startswith(("cfut_", "cfat_", "cfk_", "cfoat_", "sk-", "ghp_", "ghs_", "gho_", "ghu_", "ghr_"))
    if re.fullmatch(r"[A-Za-z0-9_-]{40}", value) and not known_prefix:
        return "legacy"
    raise DeploymentError("CLOUDFLARE_API_TOKEN must contain only the scoped Cloudflare API token value copied after creation. Check for an ID, a global key, a command, quotes or whitespace.")


def account_id(call, provided):
    value = provided
    if not value:
        try:
            accounts = call("/accounts?per_page=2")
        except CloudflareError as error:
            raise DeploymentError(f"Account discovery failed. {error} Supply CLOUDFLARE_ACCOUNT_ID to select the account directly.") from None
        if not isinstance(accounts, list) or len(accounts) != 1:
            raise DeploymentError("Set CLOUDFLARE_ACCOUNT_ID to select one Cloudflare account.")
        value = accounts[0].get("id", "")
    if not re.fullmatch(r"[a-f0-9]{32}", value):
        raise DeploymentError("CLOUDFLARE_ACCOUNT_ID must be a 32-character account ID.")
    return value


def verified_account(call, kind, provided):
    def verify(path):
        result = call(path)
        if not isinstance(result, dict) or result.get("status") != "active":
            raise DeploymentError("Cloudflare did not confirm an active API token.")

    if kind != "account":
        print("Checking the Cloudflare user token status.", flush=True)
        try:
            verify("/user/tokens/verify")
        except CloudflareError as error:
            if kind != "legacy" or error.status not in (400, 401, 403, 404):
                raise
        else:
            print("Selecting the Cloudflare account.", flush=True)
            return account_id(call, provided)
    print("Selecting the Cloudflare account for account token verification.", flush=True)
    account = account_id(call, provided)
    print("Checking the Cloudflare account token status.", flush=True)
    verify(f"/accounts/{account}/tokens/verify")
    return account


def check_worker_owner(call, account):
    try:
        settings = call(f"/accounts/{account}/workers/scripts/{WORKER}/settings")
    except CloudflareError as error:
        if error.status in (400, 404) and error.codes & {10007, 10090}:
            return
        raise
    if not any(b.get("name") == "OWNER_REPO" and b.get("type") == "plain_text"
               and b.get("text") == REPOSITORY for b in settings.get("bindings", [])):
        raise DeploymentError(f"An existing Worker named {WORKER} has no matching ownership marker. Deployment stopped.")


def workers_subdomain(call, account):
    base = f"/accounts/{account}/workers"
    try:
        subdomain = call(base + "/subdomain")["subdomain"]
    except CloudflareError as error:
        if error.status not in (400, 404) or 10007 not in error.codes:
            raise
        # Derive a stable name distinct across accounts without exposing the account ID.
        suffix = hashlib.sha256((REPOSITORY + ":" + account).encode()).hexdigest()[:12]
        candidate = "rongsenzhang-common-hours-" + suffix
        try:
            call(base + "/subdomains/" + candidate)
        except CloudflareError as availability:
            # Cloudflare's documented CLI accepts 10032 as an available subdomain.
            if 10032 not in availability.codes:
                raise DeploymentError("Register an available workers.dev subdomain in your Cloudflare account, then rerun.") from availability
        subdomain = call(base + "/subdomain", "PUT", {"subdomain": candidate})["subdomain"]
    if not isinstance(subdomain, str) or not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", subdomain):
        raise DeploymentError("Unexpected workers.dev subdomain.")
    return subdomain


def deploy(binary, account, api_token, openai_key):
    binary = Path(binary)
    if not binary.is_absolute() or not binary.is_file():
        raise DeploymentError("WRANGLER_BIN must be the absolute path to the pinned Wrangler executable.")
    env = {name: os.environ[name] for name in ("HOME", "PATH", "TMPDIR", "SYSTEMROOT") if name in os.environ}
    env.update(CI="true", NO_COLOR="1", WRANGLER_SEND_METRICS="false", WRANGLER_LOG="error", WRANGLER_LOG_SANITIZE="true")
    version = subprocess.run([str(binary), "--version"], cwd=ROOT, env=env,
                             capture_output=True, text=True, timeout=30)
    if version.returncode or version.stdout.strip() != WRANGLER_VERSION:
        raise DeploymentError(f"Use Wrangler {WRANGLER_VERSION} for this release.")
    env.update(CLOUDFLARE_ACCOUNT_ID=account, CLOUDFLARE_API_TOKEN=api_token)
    # The pinned CLI reads JSON input from this path into secret_text bindings in
    # the same upload as the Worker. Keep the GitHub secret out of argv, disk and logs.
    result = subprocess.run(
        [str(binary), "deploy", "--config", "wrangler.jsonc", "--name", WORKER,
         "--secrets-file", "/dev/stdin"], env=env, cwd=ROOT,
        input=json.dumps({"OPENAI_API_KEY": openai_key}).encode(), capture_output=True, timeout=240)
    if result.returncode:
        # Never replay Wrangler logs that might contain binding values.
        codes = re.findall(rb"\[code:\s*(\d{3,8})\]", result.stderr + result.stdout)
        suffix = " (Cloudflare codes " + ", ".join(sorted({c.decode() for c in codes})) + ")" if codes else ""
        raise DeploymentError("Wrangler could not deploy the Worker" + suffix + ". Check the token scope and configuration.")


def verify_worker(base, send=request, sleep=time.sleep):
    origin_header = {"Origin": ORIGIN}
    for attempt in range(9):
        try:
            status, _, data = send(base + "/api/status", headers=origin_header, timeout=9)
            if status == 200 and isinstance(data, dict) and data.get("service") == "common-hours-live" and (
                data.get("configured") is True and data.get("provider") == "openai" and data.get("model") == MODEL
            ):
                break
        except (OSError, URLError):
            pass
        if attempt < 8:
            sleep(4)
    else:
        raise DeploymentError("Worker status did not become ready with the configured OpenAI model.")
    endpoint = base + "/api/chat"
    status, headers, _ = send(endpoint, method="OPTIONS", headers={
        **origin_header, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    if (status not in (200, 204) or headers.get("Access-Control-Allow-Origin") != ORIGIN
            or "POST" not in headers.get("Access-Control-Allow-Methods", "").upper()
            or "content-type" not in headers.get("Access-Control-Allow-Headers", "").lower()):
        raise DeploymentError("The volunteer site's CORS preflight did not pass.")
    status, headers, reply = send(endpoint, method="POST", headers=origin_header, timeout=55,
                                  data={"message": "Are you Gemini?", "history": []})
    if not (status == 200 and headers.get("Access-Control-Allow-Origin") == ORIGIN
            and isinstance(reply, dict) and reply.get("provider") == "openai" and reply.get("model") == MODEL
            and isinstance(reply.get("text"), str) and "openai" in reply["text"].lower()
            and reply.get("matches") == [] and reply.get("toConfirm") == [] and reply.get("details") == {}):
        raise DeploymentError(f"Public live-model smoke failed (HTTP {status}); the Pages endpoint was not selected.")
    return endpoint


def main():
    required = ("CLOUDFLARE_API_TOKEN", "OPENAI_API_KEY", "WRANGLER_BIN")
    missing = [key for key in required if not os.environ.get(key)]
    if missing:
        raise DeploymentError("Missing deployment configuration: " + ", ".join(missing))
    if os.environ.get("GITHUB_REPOSITORY", REPOSITORY) != REPOSITORY:
        raise DeploymentError("The release repository does not match the Worker ownership marker.")
    print("Checking the Cloudflare credential format.", flush=True)
    token = os.environ["CLOUDFLARE_API_TOKEN"]
    if token == os.environ["OPENAI_API_KEY"]:
        raise DeploymentError("Supply separate Cloudflare and OpenAI credentials in the corresponding GitHub secrets.")
    kind = token_kind(token)
    call = cloudflare(token)
    account = verified_account(call, kind, os.environ.get("CLOUDFLARE_ACCOUNT_ID"))
    print("Checking ownership of the target Worker.", flush=True)
    check_worker_owner(call, account)
    print("Checking the public workers.dev hostname.", flush=True)
    subdomain = workers_subdomain(call, account)
    print("Deploying the Worker with its encrypted runtime secret.", flush=True)
    deploy(os.environ["WRANGLER_BIN"], account, token, os.environ["OPENAI_API_KEY"])
    print("Checking the public Worker and live OpenAI reply.", flush=True)
    endpoint = verify_worker(f"https://{WORKER}.{subdomain}.workers.dev")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"endpoint={endpoint}\n")
    print("Live OpenAI reply and Pages origin verified at", endpoint)


def run():
    try:
        main()
    except DeploymentError as exc:
        print("Live chat deployment failed:", exc, file=sys.stderr)
        return 1
    except Exception:
        # Library exceptions may quote request headers, URLs or subprocess inputs.
        print("Live chat deployment failed during the reported stage. Check the configuration and network, then retry.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run())
