"""Serve the Common Hours staff console on loopback with an operator-only session."""
import argparse
import hmac
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import mimetypes
from pathlib import Path
import secrets
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
ADMIN = ROOT / "admin"
SITE = ROOT / "site"
COOKIE = "commonhours_staff"
LOGIN = b"""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Staff sign in | Common Hours</title>
<body><main><h1>Common Hours staff sign in</h1>
<p>Enter the access code shown in the terminal that started this console.</p>
<form action="/login" method="post"><label>Access code <input type="password" name="code"
autocomplete="off" autofocus required maxlength="128"></label>
<button>Open staff console</button></form></main></body></html>"""


def route_files(data):
    files = {
        "/": ADMIN / "index.html",
        "/style.css": SITE / "style.css",
        "/site/engine.js": SITE / "engine.js",
        "/site/icons.js": SITE / "icons.js",
    }
    for name in ("app.js", "admin.css", "desk-view.js", "desk.css", "queries.js",
                 "research-view.js", "research.css", "semantic-view.js", "semantic.js"):
        files["/" + name] = ADMIN / name
    for name in ("mark.svg", "dm-sans.ttf", "instrument-serif-italic.ttf"):
        files["/assets/" + name] = SITE / "assets" / name
    for name in ("catalog.json", "evaluation.json", "host-questions.json", "semantic.json"):
        files["/data/" + name] = data / name
    return files


class StaffServer(ThreadingHTTPServer):
    def __init__(self, port, data):
        self.files = route_files(data)
        self.code = secrets.token_urlsafe(24)
        self.session = secrets.token_urlsafe(32)
        super().__init__(("127.0.0.1", port), StaffRequest)


class StaffRequest(BaseHTTPRequestHandler):
    server_version = "CommonHours"
    sys_version = ""

    def send(self, status, body=b"", content_type="text/plain; charset=utf-8", headers=()):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; "
                         "base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        for key, value in headers:
            self.send_header(key, value)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def authenticated(self):
        jar = SimpleCookie()
        try:
            jar.load(self.headers.get("Cookie", ""))
        except CookieError:
            return False
        value = jar[COOKIE].value if COOKIE in jar else ""
        return hmac.compare_digest(value.encode(), self.server.session.encode())

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/login" or (path == "/" and not self.authenticated()):
            self.send(HTTPStatus.OK, LOGIN, "text/html; charset=utf-8")
            return
        if not self.authenticated():
            self.send(HTTPStatus.UNAUTHORIZED, b"Staff sign-in required.")
            return
        file = self.server.files.get(path)
        if not file or not file.is_file():
            self.send(HTTPStatus.NOT_FOUND)
            return
        self.send(HTTPStatus.OK, file.read_bytes(), mimetypes.guess_type(file.name)[0]
                  or "application/octet-stream")

    do_HEAD = do_GET

    def do_POST(self):
        if urlsplit(self.path).path != "/login":
            self.send(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
        except ValueError:
            length = 0
        if not 0 < length <= 512 or self.headers.get_content_type() != "application/x-www-form-urlencoded":
            self.send(HTTPStatus.BAD_REQUEST)
            return
        fields = parse_qs(self.rfile.read(length).decode("utf-8", "replace"))
        code = fields.get("code", [""])[0].encode()
        if not hmac.compare_digest(code, self.server.code.encode()):
            self.send(HTTPStatus.UNAUTHORIZED, LOGIN, "text/html; charset=utf-8")
            return
        # Use Secure behind Codespaces HTTPS, while allowing loopback HTTP offline.
        secure = "; Secure" if self.headers.get("X-Forwarded-Proto", "").split(",")[0].strip() == "https" else ""
        cookie = f"{COOKIE}={self.server.session}; Path=/; HttpOnly; SameSite=Strict{secure}"
        self.send(HTTPStatus.SEE_OTHER, headers=(("Location", "/"), ("Set-Cookie", cookie)))

    def log_message(self, _fmt, *_args):
        # The operator sees the launch instructions. Avoid logging requests or credentials.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    default = ROOT / "data" if (ROOT / "data/catalog.json").exists() else SITE / "data"
    parser.add_argument("--data-dir", type=Path, default=default)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not all((args.data_dir / (name + ".json")).is_file() for name in
               ("catalog", "evaluation", "host-questions", "semantic")):
        parser.error("Choose a directory containing the four complete staff snapshot files.")
    with StaffServer(args.port, args.data_dir) as server:
        print(f"Open http://127.0.0.1:{server.server_port}/ or the private forwarded Codespaces port.")
        print(f"Staff access code: {server.code}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
