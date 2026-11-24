"""Compose a release's host questions from synthetic, source-linked catalogue gaps."""

import argparse
import json
import os
from pathlib import Path
import re
import sys

from ai.provider import ProviderError, post_json, write_manifest


ROOT = Path(__file__).resolve().parents[1]
MODEL = "gpt-5.4-mini-2026-03-17"
FIELDS = ("time", "mode", "stepFree")
OPENINGS = ("Could you tell me", "Could you confirm", "Can I check")
FOCUS = {
    "time": (
        "which days volunteers can take part",
        "whether any sessions run at weekends",
        "whether volunteers can choose a weekday or weekend session",
    ),
    "mode": (
        "whether this role can be done from home or requires a visit",
        "whether volunteers need to attend in person",
        "whether someone can do the whole role from home",
    ),
    "stepFree": (
        "whether there is a step-free route from arrival to the activity area",
        "whether the route to and around the volunteering area is step-free",
        "whether a volunteer can reach the activity without using steps",
    ),
    "accessIfVisiting": (
        "whether there is step-free access if a visit is needed",
        "whether any in-person part of this role has a step-free route",
    ),
}


def find_gaps(catalog):
    gaps = {}
    for role in catalog["opportunities"]:
        for field in FIELDS:
            if role[field] != "unknown":
                continue
            key = f"{role['id']}__{field}"
            if key in gaps or not re.fullmatch(r"[a-z0-9-]{1,70}", role["id"]):
                raise ValueError("Invalid or duplicate catalogue identifier")
            source = role["sources"][field]
            exercise_record = role.get("source") == "exercise" and source == f"site/exercise-engine.js:{role['id']}"
            if not exercise_record and not re.fullmatch(r"sessions\.csv:[A-Za-z0-9_-]+", source):
                raise ValueError("Unknown session evidence reference")
            focus = "accessIfVisiting" if field == "stepFree" and role["mode"] == "unknown" else field
            gaps[key] = {
                "roleId": role["id"], "field": field, "source": source,
                "title": role["title"], "tasks": role["tasks"], "mode": role["mode"],
                "wording": FOCUS[focus],
            }
    return gaps


def object_schema(fields):
    return {"type": "object", "properties": fields, "required": list(fields), "additionalProperties": False}


def request_body(gaps):
    def enum(options):
        return {"type": "string", "enum": list(options)}

    choices = {key: object_schema({"opening": enum(OPENINGS), "focus": enum(gap["wording"])})
               for key, gap in gaps.items()}
    context = {key: {field: gap[field] for field in ("title", "tasks", "field", "mode")}
               for key, gap in gaps.items()}
    return {
        "model": MODEL, "store": False, "max_output_tokens": 2400,
        "instructions": (
            "Help a volunteer write a single brief question to an opportunity provider about each "
            "missing source field. Choose an opening and a relevant focus from that key's permitted "
            "wording. Use the fictional role's tasks and delivery setting to select the clearest wording. "
            "Favour practical, neutral questions. The input is catalogue data only. "
            "Never guess a missing answer or determine eligibility."
        ),
        "input": json.dumps(context, ensure_ascii=False),
        "text": {"format": {"type": "json_schema", "name": "host_questions",
                            "strict": True, "schema": object_schema(choices)}},
    }


def request_openai(body, api_key):
    return post_json("responses", body, api_key)


def extract_choices(response):
    if not isinstance(response, dict) or response.get("status") != "completed":
        raise ProviderError("response_not_completed")
    if response.get("model") != MODEL:
        raise ProviderError("unexpected_model")
    output = response.get("output")
    if not isinstance(output, list):
        raise ProviderError("invalid_output")
    parts = []
    for message in output:
        if not isinstance(message, dict):
            raise ProviderError("invalid_output")
        if message.get("type") != "message":
            continue
        if message.get("role") != "assistant" or not isinstance(message.get("content"), list):
            raise ProviderError("invalid_message")
        for part in message["content"]:
            if not isinstance(part, dict) or part.get("type") != "output_text" or not isinstance(part.get("text"), str):
                raise ProviderError("missing_or_refused_text")
            parts.append(part["text"])
    if len(parts) != 1:
        raise ProviderError("expected_one_answer")
    try:
        return json.loads(parts[0])
    except ValueError:
        raise ProviderError("invalid_answer_json") from None


def render(gaps, choices):
    if not isinstance(choices, dict) or choices.keys() != gaps.keys():
        raise ProviderError("incomplete_coverage")
    questions = []
    for key, gap in gaps.items():
        choice = choices[key]
        if not isinstance(choice, dict) or set(choice) != {"opening", "focus"}:
            raise ProviderError("unexpected_fields")
        if choice["opening"] not in OPENINGS or choice["focus"] not in gap["wording"]:
            raise ProviderError("unapproved_wording")
        row = {field: gap[field] for field in ("roleId", "field", "source")}
        row["question"] = f"{choice['opening']} {choice['focus']}?"
        questions.append(row)
    return questions


def build(catalog, api_key=None, call=request_openai):
    gaps = find_gaps(catalog)
    choices = {key: {"opening": OPENINGS[0], "focus": gap["wording"][0]} for key, gap in gaps.items()}
    result = {"version": 1, "provider": "curated", "model": None, "status": "unconfigured",
              "questions": render(gaps, choices)}
    if api_key and gaps:
        try:
            choices = extract_choices(call(request_body(gaps), api_key))
            questions = render(gaps, choices)
        except ProviderError as exc:
            print(f"Host questions used editor-written wording ({exc}).", file=sys.stderr)
            result["status"] = "fallback"
        else:
            result.update(provider="openai", model=MODEL, status="ready", questions=questions)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, default=ROOT / "site/data/catalog.json")
    parser.add_argument("--out", type=Path, default=ROOT / "site/data/host-questions.json")
    parser.add_argument("--with-openai", action="store_true",
                        help="Use the key from this process's environment for a release build.")
    args = parser.parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    key = os.environ.get("OPENAI_API_KEY") if args.with_openai else None
    result = build(catalog, key)
    write_manifest(args.out, result)
    print(f"Published {len(result['questions'])} host questions. Provider={result['provider']}, "
          f"status={result['status']}.")


if __name__ == "__main__":
    main()
