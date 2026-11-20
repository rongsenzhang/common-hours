import json
import shutil
import sqlite3
import tempfile
import unittest
from pathlib import Path
from pipeline.build import ROOT, build


class CatalogueTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.fixtures = self.root / "fixtures"
        shutil.copytree(ROOT / "fixtures", self.fixtures)

    def generate(self):
        return build(self.fixtures, self.root / "test.sqlite")

    def revise(self, filename, old, new):
        path = self.fixtures / filename
        content = path.read_text()
        self.assertIn(old, content)
        path.write_text(content.replace(old, new, 1))

    def test_public_catalogue_matches_rebuild_and_all_fields_have_a_source(self):
        data = self.generate()
        self.assertEqual(data, json.loads((ROOT / "site/data/catalog.json").read_text()))
        with sqlite3.connect(self.root / "test.sqlite") as db:
            self.assertEqual(db.execute("SELECT COUNT(*) FROM roles").fetchone()[0], len(data["opportunities"]))
        for row in data["opportunities"]:
            self.assertEqual(set(row["sources"]), set(row) - {"sources"})
            for source in row["sources"].values():
                file, identifier = source.split(":")
                self.assertIn(identifier, (self.fixtures / file).read_text())

    def test_missing_value_remains_unknown(self):
        roles = {row["id"]: row for row in self.generate()["opportunities"]}
        self.assertEqual(roles["garden-buddy"]["stepFree"], "unknown")
        self.assertEqual(roles["phone-companion"]["mode"], "unknown")
        self.assertEqual(roles["repair-cafe"]["time"], "unknown")

    def test_broken_foreign_key_fails(self):
        self.revise("roles.csv", "garden-buddy,seed-club", "garden-buddy,missing-host")
        with self.assertRaises(sqlite3.IntegrityError):
            self.generate()

    def test_missing_session_fails(self):
        path = self.fixtures / "sessions.csv"
        path.write_text("\n".join(path.read_text().splitlines()[:-1]) + "\n")
        with self.assertRaisesRegex(ValueError, "Missing session"):
            self.generate()

    def test_unknown_vocabulary_is_rejected(self):
        self.revise("sessions.csv", "Saturday or Sunday", "Every other fortnight")
        with self.assertRaisesRegex(ValueError, "Unexpected source vocabulary"):
            self.generate()

    def test_conflicting_remote_access_values_rejected(self):
        self.revise("sessions.csv", "From home,N/A", "From home,No")
        with self.assertRaisesRegex(ValueError, "remote/site-access"):
            self.generate()

    def test_duplicate_sessions_rejected(self):
        path = self.fixtures / "sessions.csv"
        source = path.read_text()
        path.write_text(source + source.splitlines()[1] + "\n")
        with self.assertRaises(sqlite3.IntegrityError):
            self.generate()

    def test_evidence_must_resolve_an_unknown(self):
        self.revise("follow-ups.json", '"field":"stepFree"', '"field":"time"')
        with self.assertRaisesRegex(ValueError, "Invalid confirmation"):
            self.generate()


if __name__ == "__main__":
    unittest.main()
