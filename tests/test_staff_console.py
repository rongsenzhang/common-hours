import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.parse import urlencode

from admin.serve import StaffServer


class StaffAccessTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        directory = Path(temporary.name)
        (directory / "catalog.json").write_text('{"opportunities":[]}', encoding="utf-8")
        self.server = StaffServer(0, directory)
        thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def fetch(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection(*self.server.server_address, timeout=2)
        try:
            conn.request(method, path, body, headers or {})
            response = conn.getresponse()
            return response.status, dict(response.getheaders()), response.read()
        finally:
            conn.close()

    def sign_in(self, code):
        return self.fetch("POST", "/login", urlencode({"code": code}), {
            "Content-Type": "application/x-www-form-urlencoded"})

    def test_entire_interactive_console_requires_sign_in(self):
        self.assertEqual(self.server.server_address[0], "127.0.0.1")
        self.assertIn(b"Access code", self.fetch("GET", "/")[2])
        for path in ("/app.js", "/data/catalog.json", "/data/semantic.json", "/desk-view.js"):
            self.assertEqual(self.fetch("GET", path)[0], 401)
        self.assertEqual(self.sign_in("incorrect")[0], 401)
        status, headers, _ = self.sign_in(self.server.code)
        self.assertEqual(status, 303)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        cookie = {"Cookie": headers["Set-Cookie"].split(";")[0]}
        self.assertIn(b"Staff console", self.fetch("GET", "/", headers=cookie)[2])
        status, headers, body = self.fetch("GET", "/data/catalog.json", headers=cookie)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"opportunities": []})
        self.assertIn("no-store", headers["Cache-Control"])
        self.assertEqual(self.fetch("GET", "/admin/serve.py", headers=cookie)[0], 404)
        self.assertEqual(self.fetch("HEAD", "/data/semantic.json")[0], 401)
