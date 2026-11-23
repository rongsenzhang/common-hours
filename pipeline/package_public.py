"""Build Common Hours and the public matching exercise from explicit inputs."""
import argparse
import json
from pathlib import Path
import shutil
import tempfile
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PUBLIC_FILES = (
    "index.html", "app.js", "engine.js", "assistant.js", "assistant-topics.js",
    "chat-view.js", "live-chat.js", "html.js", "icons.js", "style.css", "chat.css",
    "community-case.js", "community-case-view.js",
    "exercise-engine.js", "exercise-view.js", "exercise-chat.js", "exercise.css",
)
ROLE_FIELDS = (
    "id", "title", "organisation", "area", "theme", "summary", "time", "mode",
    "stepFree", "contactNote", "interests", "tasks", "caseFacts",
)


def public_chat_endpoint(value):
    if not isinstance(value, str) or not value or any(c.isspace() for c in value):
        raise ValueError("Specify a non-empty public chat endpoint")
    url = urlsplit(value)
    local = url.scheme == "http" and url.hostname in {"localhost", "127.0.0.1", "::1"}
    if (not url.hostname or not url.path or url.path == "/" or url.scheme != "https" and not local
            or url.username is not None or url.password is not None or url.query or url.fragment
            or "\\" in value):
        raise ValueError("The public chat endpoint must be an HTTPS URL without credentials, query or fragment (HTTP is allowed for loopback)")
    return value


def make_site(output, chat_endpoint=None):
    if chat_endpoint is not None:
        chat_endpoint = public_chat_endpoint(chat_endpoint)
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
        for name, doc in (("catalog", public), ("host-questions", {"questions": host_questions}),
                          ("chat-config", {"endpoint": chat_endpoint})):
            (staging / "data" / f"{name}.json").write_text(json.dumps(doc, ensure_ascii=False) + "\n")
        (staging / ".nojekyll").touch()
        staging.rename(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--chat-endpoint", type=public_chat_endpoint,
                        help="Verified public AI gateway endpoint; omit for on-device search only")
    args = parser.parse_args()
    make_site(args.output, args.chat_endpoint)
