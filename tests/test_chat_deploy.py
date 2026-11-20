import importlib.util
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from pathlib import Path
import unittest
from unittest.mock import Mock, call, patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("chat_deployment", ROOT / "release/deploy-chat.py")
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)
ACCOUNT = "8" * 32
BASE = "https://example.test"


class ChatDeploymentTests(unittest.TestCase):
    def test_credential_format_rejects_ids_and_other_keys_before_any_request(self):
        token = "cfut_" + "u" * 47
        for bad in (ACCOUNT, "cfk_" + "f" * 48, "cfut_" + "x" * 35, "sk-" + "o" * 37,
                    "Bearer " + token, token + "\n", "cfoat_" + "o" * 47):
            with self.subTest(), patch.dict(deploy.os.environ, {
                    "OPENAI_API_KEY": "mock-openai", "CLOUDFLARE_API_TOKEN": bad, "WRANGLER_BIN": "/test/wrangler",
                    "GITHUB_REPOSITORY": deploy.REPOSITORY
                }), patch.object(deploy, "request") as http, redirect_stderr(StringIO()) as err, redirect_stdout(StringIO()):
                self.assertEqual(deploy.run(), 1)
                self.assertIn("scoped Cloudflare API token", err.getvalue())
                self.assertNotIn(bad, err.getvalue())
                http.assert_not_called()
        self.assertEqual(deploy.token_kind(token), "user")
        self.assertEqual(deploy.token_kind("cfat_" + "a" * 47), "account")
        self.assertEqual(deploy.token_kind("L" * 40), "legacy")

    def test_both_token_endpoints_and_legacy_account_fallback(self):
        user_path = "/user/tokens/verify"
        account_path = f"/accounts/{ACCOUNT}/tokens/verify"
        cases = [
            ("user", [], [user_path]), ("account", [], [account_path]),
            ("legacy", [], [user_path]),
            ("legacy", [deploy.CloudflareError(400, [9106])], [user_path, account_path]),
        ]
        for kind, failures, paths in cases:
            http = Mock(side_effect=[*failures, {"status": "active"}])
            with self.subTest(kind=kind), redirect_stdout(StringIO()):
                self.assertEqual(deploy.verified_account(http, kind, ACCOUNT), ACCOUNT)
                self.assertEqual(http.call_args_list, [call(path) for path in paths])
        http = Mock(return_value={"status": "expired"})
        with redirect_stdout(StringIO()), self.assertRaisesRegex(deploy.DeploymentError, "active"):
            deploy.verified_account(http, "legacy", ACCOUNT)
        http.assert_called_once_with(user_path)
        http = Mock(side_effect=deploy.CloudflareError(400, [9106]))
        with redirect_stdout(StringIO()), self.assertRaisesRegex(deploy.DeploymentError, "9106.*recognise"):
            deploy.verified_account(http, "user", ACCOUNT)
        http.assert_called_once_with(user_path)

    def test_unexpected_errors_never_log_library_details(self):
        with patch.object(deploy, "main", side_effect=ValueError("secret-mock-header")), redirect_stderr(StringIO()) as err:
            self.assertEqual(deploy.run(), 1)
            self.assertNotIn("secret-mock-header", err.getvalue())

    def test_explicit_account_does_not_need_listing_permissions(self):
        call = Mock()
        self.assertEqual(deploy.account_id(call, ACCOUNT), ACCOUNT)
        call.assert_not_called()
        call.return_value = [{"id": ACCOUNT}]
        self.assertEqual(deploy.account_id(call, None), ACCOUNT)
        call.return_value.append({"id": "a" * 32})
        with self.assertRaisesRegex(deploy.DeploymentError, "select one"):
            deploy.account_id(call, None)

    def test_existing_worker_must_have_our_marker(self):
        unrelated = [{"name": "OWNER_REPO", "type": "plain_text", "text": "another/repo"}]
        with self.assertRaisesRegex(deploy.DeploymentError, "ownership marker"):
            deploy.check_worker_owner(lambda path: {"bindings": unrelated}, ACCOUNT)
        own = [{"name": "OWNER_REPO", "type": "plain_text", "text": deploy.REPOSITORY}]
        deploy.check_worker_owner(lambda path: {"bindings": own}, ACCOUNT)
        deploy.check_worker_owner(Mock(side_effect=deploy.CloudflareError(404, [10007])), ACCOUNT)
        with self.assertRaises(deploy.CloudflareError):
            deploy.check_worker_owner(Mock(side_effect=deploy.CloudflareError(403, [10000])), ACCOUNT)

    def test_existing_subdomain_cannot_be_renamed(self):
        call = Mock(return_value={"subdomain": "owners-domain"})
        self.assertEqual(deploy.workers_subdomain(call, ACCOUNT), "owners-domain")
        call.assert_called_once_with(f"/accounts/{ACCOUNT}/workers/subdomain")

    def test_first_subdomain_requires_available_name(self):
        missing = deploy.CloudflareError(404, [10007])
        taken = deploy.CloudflareError(400, [10031])
        call = Mock(side_effect=[missing, taken])
        with self.assertRaisesRegex(deploy.DeploymentError, "available"):
            deploy.workers_subdomain(call, ACCOUNT)
        self.assertTrue(all(len(invocation.args) == 1 for invocation in call.call_args_list))

    def test_genuine_chat_and_pages_cors_needed_for_endpoint(self):
        status = {"service": "common-hours-live", "configured": True, "provider": "openai", "model": deploy.MODEL}
        cors = {"Access-Control-Allow-Origin": deploy.ORIGIN, "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "Content-Type"}
        reply = {"provider": "openai", "model": deploy.MODEL, "text": "OpenAI powers Common Hours.",
                 "matches": [], "toConfirm": [], "details": {}}
        def responses(last):
            return Mock(side_effect=[(200, cors, status), (204, cors, {}), (200, cors, last)])
        good = responses(reply)
        self.assertEqual(deploy.verify_worker(BASE, good), BASE + "/api/chat")
        self.assertEqual(good.call_args.kwargs["data"]["message"], "Are you Gemini?")
        with self.assertRaisesRegex(deploy.DeploymentError, "smoke failed"):
            deploy.verify_worker(BASE, responses({**reply, "provider": "local"}))
        blocked = Mock(side_effect=[(200, cors, status), (204, {**cors, "Access-Control-Allow-Origin": "*"}, {})])
        with self.assertRaisesRegex(deploy.DeploymentError, "preflight"):
            deploy.verify_worker(BASE, blocked)
        self.assertEqual(blocked.call_count, 2)

    def test_not_ready_never_calls_a_billable_turn(self):
        unavailable = Mock(return_value=(200, {}, {"configured": False}))
        with self.assertRaisesRegex(deploy.DeploymentError, "status"):
            deploy.verify_worker(BASE, unavailable, sleep=lambda delay: None)
        self.assertTrue(all(call.args[0].endswith("/status") for call in unavailable.call_args_list))


if __name__ == "__main__":
    unittest.main()
