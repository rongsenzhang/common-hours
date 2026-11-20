import contextlib
import io
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock

from ai import build_semantic as semantic


ROOT = Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT / "site/data/catalog.json").read_text())
CASES = json.loads((ROOT / "fixtures/judgements.json").read_text())


def vector(index, weights):
    return {"object": "embedding", "index": index, "embedding": [*weights, *([0] * (256 - len(weights)))]}


class SemanticTests(unittest.TestCase):
    def test_checked_in_fallback_contains_all_examples_and_no_scores(self):
        call = MagicMock()
        actual = semantic.build(CATALOG, CASES, call=call)
        call.assert_not_called()
        self.assertEqual(actual, json.loads((ROOT / "site/data/semantic.json").read_text()))
        self.assertEqual(actual["cutoff"], 0.32)
        self.assertEqual(actual["provider"], "none")
        self.assertTrue(all(case["scores"] == [] for case in actual["cases"]))
        self.assertEqual([case["query"] for case in actual["cases"]], [case["query"] for case in CASES])

    def test_single_batch_sanitises_inputs_and_real_scores_require_valid_response(self):
        roles = [dict(role, contactNote="PRIVATE NOTE") for role in CATALOG["opportunities"][:2]]
        cases = [{"id": "A", "query": "read letters", "why": "HIDDEN LABEL", "relevant": ["HIDDEN ID"]}]
        rows = [vector(2, [1, 0]), vector(1, [0, 1]), vector(0, [1, 0])]
        call = MagicMock(return_value={"data": rows, "model": semantic.MODEL})
        result = semantic.build({"opportunities": roles}, cases, "test-token", call=call)
        call.assert_called_once()
        endpoint, body, _ = call.call_args.args
        self.assertEqual(endpoint, "embeddings")
        self.assertEqual(set(body), {"input", "dimensions", "model", "encoding_format"})
        self.assertEqual(len(body["input"]), 3)
        self.assertEqual(body["input"][-1], "read letters")
        self.assertNotIn("PRIVATE NOTE", str(body))
        self.assertNotIn("HIDDEN", str(body))
        self.assertEqual((result["provider"], result["status"]), ("openai", "ready"))
        self.assertEqual(result["cases"][0]["scores"], [
            {"roleId": roles[0]["id"], "score": 1}, {"roleId": roles[1]["id"], "score": 0}])
        self.assertNotIn('"embedding"', json.dumps(result))
        self.assertNotIn("test-token", json.dumps(result))

    def test_invalid_batches_publish_no_partial_scores(self):
        valid = vector(0, [1, 0])
        for bad in [[], [valid, valid], [valid, vector(1, [0, 0])], [valid, vector(1, [float("nan")])],
                    [valid, {"object": "embedding", "index": 1, "embedding": [1]}]]:
            with self.subTest(length=len(bad)), contextlib.redirect_stderr(io.StringIO()):
                call = MagicMock(return_value={"model": semantic.MODEL, "data": bad})
                result = semantic.build({"opportunities": CATALOG["opportunities"][:1]}, CASES[:1],
                                        "test-token", call=call)
                self.assertEqual((result["provider"], result["status"]), ("none", "fallback"))
                self.assertEqual(result["cases"][0]["scores"], [])


if __name__ == "__main__":
    unittest.main()
