"""Bounded, authenticated requests to the two release-time OpenAI endpoints."""
from http.client import IncompleteRead
import json
import os
import socket
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, Request, build_opener


def write_manifest(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=path.parent, delete=False, encoding="utf-8") as file:
        json.dump(data, file, indent=2, ensure_ascii=False, allow_nan=False)
        file.write("\n")
    os.chmod(file.name, 0o644)
    os.replace(file.name, path)


class ProviderError(Exception):
    """A diagnostic category safe to expose in CI logs."""


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def post_json(endpoint, body, api_key, limit=262144):
    if endpoint not in {"responses", "embeddings"}:
        raise ValueError("Unsupported API endpoint")
    request = Request("https://api.openai.com/v1/" + endpoint, data=json.dumps(body).encode("utf-8"), method="POST",
                      headers={"Content-Type": "application/json", "Authorization": "Bearer " + api_key})
    opener = build_opener(NoRedirect())
    for attempt in range(2):
        try:
            with opener.open(request, timeout=60) as response:
                raw = response.read(limit + 1)
            if len(raw) > limit:
                raise ProviderError("oversized_response")
            return json.loads(raw)
        except HTTPError as exc:
            status = exc.code
            try:
                code = json.loads(exc.read(8192)).get("error", {}).get("code")
            except (AttributeError, ValueError, UnicodeError):
                code = None
            finally:
                exc.close()
            if code == "insufficient_quota":
                raise ProviderError("insufficient_quota") from None
            if status not in (408, 429, 500, 502, 503, 504) or attempt == 1:
                raise ProviderError(f"http_{status}") from None
        except (socket.timeout, TimeoutError, URLError, ConnectionError, IncompleteRead):
            if attempt == 1:
                raise ProviderError("network_unavailable") from None
        except (ValueError, UnicodeError):
            raise ProviderError("invalid_response_json") from None
        time.sleep(2)
