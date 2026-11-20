import contextlib
import io
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError

from ai import build_questions as ai
from ai import provider


ROOT = Path(__file__).resolve().parents[1]


def completed(plan):
    return {"model": ai.MODEL, "status": "completed", "output": [
        {"type": "reasoning"},
        {"type": "message", "role": "assistant",
         "content": [{"type": "output_text", "text": json.dumps(plan)}]},
    ]}


class HostQuestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / "site/data/catalog.json").read_text())
        cls.gaps = ai.find_gaps(cls.catalog)

    def valid_plan(self):
        return {key: {"opening": ai.OPENINGS[1], "focus": gap["wording"][-1]}
                for key, gap in self.gaps.items()}

    def test_unconfigured_build_is_reproducible_and_never_calls_network(self):
        call = MagicMock()
        payload = ai.build(self.catalog, call=call)
        call.assert_not_called()
        self.assertEqual(payload["provider"], "curated")
        self.assertEqual(payload["status"], "unconfigured")
        self.assertIsNone(payload["model"])
        self.assertEqual(payload, json.loads((ROOT / "site/data/host-questions.json").read_text()))

    def test_exact_unknown_fields_have_traceable_questions(self):
        payload = ai.build(self.catalog)
        sources = {(role["id"], field): role["sources"][field] for role in self.catalog["opportunities"]
                   for field in ai.FIELDS if role[field] == "unknown"}
        actual = {(q["roleId"], q["field"]): q["source"] for q in payload["questions"]}
        self.assertEqual(actual, sources)
        self.assertEqual(len(payload["questions"]), len(sources))
        self.assertTrue(all(q["question"].endswith("?") for q in payload["questions"]))
        conditional = next(q for q in payload["questions"] if q["roleId"] == "phone-companion" and q["field"] == "stepFree")
        self.assertIn("if a visit is needed", conditional["question"])

    def test_accepted_response_uses_model_wording_and_source_owned_by_catalogue(self):
        call = MagicMock(return_value=completed(self.valid_plan()))
        payload = ai.build(self.catalog, "test-token", call)
        self.assertEqual((payload["status"], payload["provider"], payload["model"]), ("ready", "openai", ai.MODEL))
        self.assertTrue(all(q["question"].startswith(ai.OPENINGS[1]) for q in payload["questions"]))
        body = call.call_args.args[0]
        self.assertFalse(body["store"])
        self.assertTrue(body["text"]["format"]["strict"])
        sent = json.loads(body["input"])
        self.assertEqual(set(sent), set(self.gaps))
        for key, item in sent.items():
            self.assertEqual(set(item), {"field", "title", "tasks", "mode"})
            self.assertEqual(item["field"], self.gaps[key]["field"])
        self.assertNotIn("followUps", body["input"])

    def test_missing_untrusted_or_misplaced_content_falls_back(self):
        complete = self.valid_plan()
        key = next(key for key, gap in self.gaps.items() if gap["field"] == "stepFree")
        bad_plans = [
            {},
            {**complete, key: {"opening": "Access is confirmed.", "focus": "Yes"}},
            {**complete, key: {**complete[key], "roleId": "replacement"}},
            {**complete, key: {"opening": ai.OPENINGS[0], "focus": ai.FOCUS["time"][0]}},
            {**complete, "unknown_record": complete[key]},
        ]
        replies = [completed(plan) for plan in bad_plans]
        replies += [
            {"status": "incomplete"},
            {**completed(complete), "model": "unexpected"},
            {**completed(complete), "output": [{"type": "message", "role": "assistant",
              "content": [{"type": "refusal", "refusal": "untrusted provider text"}]}]},
        ]
        fallback = ai.build(self.catalog)
        for reply in replies:
            with self.subTest(reply_shape=list(reply)), contextlib.redirect_stderr(io.StringIO()) as logs:
                result = ai.build(self.catalog, "test-token", MagicMock(return_value=reply))
                self.assertEqual(result["status"], "fallback")
                self.assertEqual(result["provider"], "curated")
                self.assertEqual(result["questions"], fallback["questions"])
                self.assertNotIn("untrusted provider text", logs.getvalue())

    def test_transient_failure_retries_once_and_success_survives(self):
        result = completed(self.valid_plan())
        success = MagicMock()
        success.__enter__.return_value.read.return_value = json.dumps(result).encode()
        fail = HTTPError("https://api.openai.com/v1/responses", 503, "Service unavailable", {}, io.BytesIO(b"{}"))
        with patch.object(provider, "build_opener") as network, patch.object(provider.time, "sleep") as sleep:
            network.return_value.open.side_effect = [fail, success]
            self.assertEqual(ai.request_openai({"store": False}, "test-token"), result)
            self.assertEqual(network.return_value.open.call_count, 2)
            sleep.assert_called_once()

    def test_quota_error_does_not_retry_or_log_provider_body(self):
        error = {"error": {"code": "insufficient_quota", "message": "untrusted provider text"}}
        failure = HTTPError("https://api.openai.com/v1/responses", 429, "quota", {}, io.BytesIO(json.dumps(error).encode()))
        with patch.object(provider, "build_opener") as network, contextlib.redirect_stderr(io.StringIO()) as logs:
            network.return_value.open.side_effect = failure
            payload = ai.build(self.catalog, "test-token")
            self.assertEqual(payload["status"], "fallback")
            self.assertIn("insufficient_quota", logs.getvalue())
            self.assertNotIn("untrusted provider text", logs.getvalue())
            self.assertEqual(network.return_value.open.call_count, 1)


if __name__ == "__main__":
    unittest.main()
