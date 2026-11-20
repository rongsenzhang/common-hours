"""Compute and publish cosine scores for fixed, fictional volunteering search examples."""
import argparse
import json
import math
import os
from pathlib import Path
import sys

from ai.provider import ProviderError, post_json, write_manifest


ROOT = Path(__file__).resolve().parents[1]
MODEL = "text-embedding-3-small"
DIMENSIONS = 256
# Chosen before any embedding results were available. Apply to six-decimal published scores.
CUTOFF = 0.32


def role_text(role):
    # Use the same topical inputs as the lexical engine. Exclude all condition and judgement fields.
    return "\n".join([role["title"], role["summary"], *role["tasks"], *role["interests"],
                      role["organisation"], role["area"]])


def normalised_vectors(response, count):
    if not isinstance(response, dict) or response.get("model") != MODEL:
        raise ProviderError("unexpected_embedding_model")
    rows = response.get("data")
    if not isinstance(rows, list) or len(rows) != count:
        raise ProviderError("incomplete_embedding_batch")
    output = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("object") != "embedding":
            raise ProviderError("invalid_embedding_row")
        index = row.get("index")
        vector = row.get("embedding")
        if type(index) is not int or not 0 <= index < count or index in output:
            raise ProviderError("invalid_embedding_index")
        if not isinstance(vector, list) or len(vector) != DIMENSIONS or any(
            type(value) not in (int, float) or not -1 <= value <= 1 for value in vector
        ):
            raise ProviderError("invalid_embedding_values")
        length = math.sqrt(sum(value * value for value in vector))
        if not math.isfinite(length) or length <= 0:
            raise ProviderError("zero_embedding")
        output[index] = [value / length for value in vector]
    return [output[i] for i in range(count)]


def build(catalog, judgements, api_key=None, call=post_json):
    roles = catalog["opportunities"]
    examples = [{"id": case["id"], "query": case["query"], "scores": []} for case in judgements]
    if len({case["id"] for case in examples}) != len(examples) or len({r["id"] for r in roles}) != len(roles):
        raise ValueError("Repeated case or role identifiers")
    result = {"version": 1, "provider": "none", "status": "unconfigured", "model": None,
              "dimensions": DIMENSIONS, "cutoff": CUTOFF, "cases": examples}
    if not api_key:
        return result
    inputs = [role_text(role) for role in roles] + [case["query"] for case in examples]
    body = {"model": MODEL, "encoding_format": "float", "dimensions": DIMENSIONS, "input": inputs}
    try:
        vectors = normalised_vectors(call("embeddings", body, api_key, limit=1048576), len(inputs))
    except ProviderError as exc:
        print(f"Semantic comparison unavailable ({exc}).", file=sys.stderr)
        result["status"] = "fallback"
        return result
    for case, query in zip(examples, vectors[len(roles):]):
        for role, document in zip(roles, vectors[:len(roles)]):
            cosine = sum(left * right for left, right in zip(query, document))
            score = round(min(1.0, max(-1.0, cosine)), 6)
            case["scores"].append({"roleId": role["id"], "score": score})
        case["scores"].sort(key=lambda row: (-row["score"], row["roleId"]))
    result.update(provider="openai", status="ready", model=MODEL)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--with-openai", action="store_true")
    parser.add_argument("--out", type=Path, default=ROOT / "site/data/semantic.json")
    args = parser.parse_args()
    catalog = json.loads((ROOT / "site/data/catalog.json").read_text(encoding="utf-8"))
    cases = json.loads((ROOT / "fixtures/judgements.json").read_text(encoding="utf-8"))
    key = os.environ.get("OPENAI_API_KEY") if args.with_openai else None
    result = build(catalog, cases, key)
    write_manifest(args.out, result)
    scores = sum(len(example["scores"]) for example in result["cases"])
    print(f"Published {scores} semantic scores for {len(cases)} examples. "
          f"Provider={result['provider']}, status={result['status']}.")


if __name__ == "__main__":
    main()
