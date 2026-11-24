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
            self.assertEqual(db.execute("SELECT COUNT(*) FROM roles WHERE source='exercise'").fetchone()[0], 7)
        for row in data["opportunities"]:
            self.assertEqual(set(row["sources"]), set(row) - {"sources"})
            for source in row["sources"].values():
                file, identifier = source.split(":")
                base = ROOT if row.get("source") == "exercise" else self.fixtures
                self.assertIn(identifier, (base / file).read_text())

    def test_community_catalogue_size_and_unique_records(self):
        data = self.generate()
        rows = data["opportunities"]
        self.assertEqual(len(rows), 100)
        self.assertEqual(len({row["title"] for row in rows}), 100)
        self.assertEqual(len({row["id"] for row in rows}), 100)
        demo = [row for row in rows if row.get("source") != "exercise"]
        self.assertEqual(len(demo), 93)
        self.assertEqual(data["summary"]["hostCount"], len({row["organisation"] for row in demo}))

    def test_recruitment_roles_appear_once_with_the_supplied_facts(self):
        rows = {row["id"]: row for row in self.generate()["opportunities"] if row.get("source") == "exercise"}
        self.assertEqual(set(rows), {"digital-access-buddy", "community-cafe-host", "youth-reading-mentor",
                                     "food-parcel-packer", "conversation-partner", "form-filling-volunteer",
                                     "digital-skills-facilitator"})
        digital = rows["digital-access-buddy"]
        self.assertEqual(digital["summary"], "Support adults individually to get online and use everyday services")
        self.assertEqual(digital["caseFacts"], {
            "slots": [{"day": "Wed", "period": "evening"}], "distanceMiles": None,
            "clearance": "none-listed", "individualEvidence": "individually", "digitalEvidence": "get online",
        })
        self.assertEqual(digital["mode"], "remote")
        forms = rows["form-filling-volunteer"]
        self.assertEqual((forms["mode"], forms["caseFacts"]["distanceMiles"], forms["stepFree"]),
                         ("onsite", None, "unknown"))
        self.assertEqual(rows["youth-reading-mentor"]["caseFacts"]["clearance"], "required")

    def test_case_facts_are_grounded_and_missing_facts_stay_unknown(self):
        rows = {row["id"]: row for row in self.generate()["opportunities"]}
        local = rows["bus-app-coach"]["caseFacts"]
        self.assertEqual(local["slots"], [{"day": "Thu", "period": "evening"}])
        self.assertEqual(local["distanceMiles"], 2)
        self.assertIn(local["digitalEvidence"], rows["bus-app-coach"]["summary"])
        self.assertIsNone(rows["photo-transfer-tutor"]["caseFacts"]["distanceMiles"])
        self.assertEqual(rows["repair-cafe"]["caseFacts"]["slots"], [])
        self.assertIsNone(rows["tablet-basics-host"]["caseFacts"]["individualEvidence"])
        self.assertEqual(rows["junior-coding-mentor"]["caseFacts"]["clearance"], "required")

    def test_case_fact_mismatch_fails_build(self):
        self.revise("case-facts.csv", "bus-app-coach,Thu evening", "bus-app-coach,Sat evening")
        with self.assertRaisesRegex(ValueError, "Case slots disagree"):
            self.generate()

    def test_ungrounded_case_evidence_fails_build(self):
        self.revise("case-facts.csv", "teach journey planning on a travel app", "guaranteed one-to-one job")
        with self.assertRaisesRegex(ValueError, "Case preference evidence"):
            self.generate()

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
