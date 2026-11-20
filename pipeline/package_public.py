"""Build the volunteer-only GitHub Pages directory from explicit public inputs."""
import argparse
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PUBLIC_FILES = (
    "index.html", "app.js", "engine.js", "assistant.js", "assistant-topics.js",
    "chat-view.js", "html.js", "icons.js", "style.css", "chat.css",
)
ROLE_FIELDS = (
    "id", "title", "organisation", "area", "theme", "summary", "time", "mode",
    "stepFree", "contactNote", "interests", "tasks",
)


def make_site(output):
    output = output.resolve()
    if output.exists():
        raise ValueError(f"Choose a new output directory: {output}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        staging = Path(temporary) / "public"
        (staging / "data").mkdir(parents=True)
        for name in PUBLIC_FILES:
            shutil.copy2(SITE / name, staging / name)
        shutil.copytree(SITE / "assets", staging / "assets")
        catalog = json.loads((SITE / "data/catalog.json").read_text())
        questions = json.loads((SITE / "data/host-questions.json").read_text())
        public = {
            "version": catalog["version"],
            "summary": {"hostCount": catalog["summary"]["hostCount"]},
            "opportunities": [{key: r[key] for key in ROLE_FIELDS} for r in catalog["opportunities"]],
        }
        host_questions = [{key: q[key] for key in ("roleId", "field", "question")}
                          for q in questions["questions"]]
        for name, doc in (("catalog", public), ("host-questions", {"questions": host_questions})):
            (staging / "data" / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False) + "\n")
        (staging / ".nojekyll").touch()
        staging.rename(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    make_site(parser.parse_args().output)
