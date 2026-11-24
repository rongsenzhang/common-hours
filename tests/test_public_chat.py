"""Verify release-time transport selection and public configuration boundaries."""
import json
from pathlib import Path
import tempfile
import unittest

from pipeline.package_public import make_site


class PublicChatPackageTests(unittest.TestCase):
    def test_offline_and_configured_previews(self):
        with tempfile.TemporaryDirectory() as scratch:
            for name, endpoint in (("offline", None), ("live", "https://chat.example.org/api/chat")):
                target = Path(scratch) / name
                make_site(target, endpoint)
                self.assertTrue((target / "live-chat.js").is_file())
                config = json.loads((target / "data/chat-config.json").read_text())
                self.assertEqual(config, {"endpoint": endpoint})
                self.assertFalse((target / "server").exists())
                rows = json.loads((target / "data/catalog.json").read_text())["opportunities"]
                self.assertEqual(len(rows), 100)
                self.assertEqual(sum(row.get("source") == "exercise" for row in rows), 7)

    def test_missing_or_invalid_explicit_endpoint_aborts_before_packaging(self):
        with tempfile.TemporaryDirectory() as scratch:
            target = Path(scratch) / "public"
            for url in ("", "https://chat.example.org/chat?token=test", "http://public.example.org/chat",
                        "https://someone:pass@example.org/chat", "file:///api/chat"):
                with self.subTest(url=url), self.assertRaises(ValueError):
                    make_site(target, url)
                self.assertFalse(target.exists())
