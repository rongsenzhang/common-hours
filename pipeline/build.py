"""Join three authored source feeds in SQLite; publish a deterministic catalogue."""
import argparse
import csv
import json
import os
from pathlib import Path
import sqlite3
import tempfile
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
TIME = {"monday to friday": "weekday", "saturday or sunday": "weekend", "choose either": "flexible", "": "unknown"}
MODE = {"at venue": "onsite", "from home": "remote", "either route": "hybrid", "": "unknown"}
ACCESS = {"yes": "yes", "no": "no", "n/a": "na", "": "unknown"}

SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE hosts (id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT NOT NULL);
CREATE TABLE roles (id TEXT PRIMARY KEY, host_id TEXT NOT NULL REFERENCES hosts(id),
    title TEXT NOT NULL, theme TEXT NOT NULL, summary TEXT NOT NULL, interests TEXT NOT NULL, tasks TEXT NOT NULL);
CREATE TABLE sessions (role_id TEXT PRIMARY KEY REFERENCES roles(id), session_id TEXT UNIQUE NOT NULL,
    time TEXT NOT NULL, mode TEXT NOT NULL, stepFree TEXT NOT NULL, contactNote TEXT NOT NULL);
CREATE TABLE follow_ups (id TEXT NOT NULL REFERENCES roles(id), field TEXT NOT NULL, value TEXT NOT NULL,
    note TEXT NOT NULL, source TEXT UNIQUE NOT NULL, PRIMARY KEY(id,field));
"""


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def clean(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"Missing required source text: {value!r}")
    return value.strip()


def enum_value(raw, mapping):
    key = raw.strip().casefold()
    if key not in mapping:
        raise ValueError(f"Unexpected source vocabulary: {raw!r}")
    return mapping[key]


def grouped(raw):
    return [clean(part) for part in raw.split("|")]


def build(fixtures, db_path):
    with sqlite3.connect(db_path) as db:
        db.row_factory = sqlite3.Row
        db.executescript(SCHEMA)
        hosts = json.loads((fixtures / "hosts.json").read_text())
        for host in hosts:
            db.execute("INSERT INTO hosts VALUES(?,?,?)", [clean(host[k]) for k in ("id", "name", "area")])
        for row in read_csv(fixtures / "roles.csv"):
            fields = ("id", "host_id", "title", "theme", "summary", "interests", "tasks")
            db.execute("INSERT INTO roles VALUES(?,?,?,?,?,?,?)", [clean(row[k]) for k in fields])
        for row in read_csv(fixtures / "sessions.csv"):
            time = enum_value(row["schedule"], TIME)
            mode = enum_value(row["delivery"], MODE)
            access = enum_value(row["step_free"], ACCESS)
            if (mode == "remote") != (access == "na"):
                raise ValueError(f"Unexpected remote/site-access combination for {row['role_id']}")
            db.execute("INSERT INTO sessions VALUES(?,?,?,?,?,?)", (
                clean(row["role_id"]), clean(row["session_id"]), time, mode, access, clean(row["contact_note"])))
        missing = db.execute("SELECT id FROM roles LEFT JOIN sessions ON roles.id=sessions.role_id WHERE role_id IS NULL").fetchall()
        if missing:
            raise ValueError(f"Missing session records: {[row['id'] for row in missing]}")
        linked = db.execute("""
            SELECT roles.*,hosts.name AS organisation,hosts.area,sessions.session_id,sessions.time,
                   sessions.mode,sessions.stepFree,sessions.contactNote
            FROM roles JOIN hosts ON roles.host_id=hosts.id JOIN sessions ON roles.id=sessions.role_id
            ORDER BY roles.id
        """)
        opportunities = []
        for row in linked:
            role_ref = f"roles.csv:{row['id']}"
            host_ref = f"hosts.json:{row['host_id']}"
            session_ref = f"sessions.csv:{row['session_id']}"
            entry = {k: row[k] for k in ("id", "title", "organisation", "area", "theme", "summary",
                                          "time", "mode", "stepFree", "contactNote")}
            entry["interests"] = grouped(row["interests"])
            entry["tasks"] = grouped(row["tasks"])
            entry["sources"] = dict.fromkeys(("id", "title", "theme", "summary", "interests", "tasks"), role_ref)
            entry["sources"].update(dict.fromkeys(("organisation", "area"), host_ref))
            entry["sources"].update(dict.fromkeys(("time", "mode", "stepFree", "contactNote"), session_ref))
            opportunities.append(entry)
        follow_ups = json.loads((fixtures / "follow-ups.json").read_text())
        by_id = {row["id"]: row for row in opportunities}
        for update in follow_ups:
            role = by_id[update["id"]]
            field = update["field"]
            vocabulary = {"time": TIME, "mode": MODE, "stepFree": ACCESS}.get(field)
            if not vocabulary or role[field] != "unknown" or update["value"] not in set(vocabulary.values()) - {"unknown", "na"}:
                raise ValueError(f"Invalid confirmation for {role['id']}, {field}")
            db.execute("INSERT INTO follow_ups VALUES(?,?,?,?,?)", [clean(update[k]) for k in ("id","field","value","note","source")])
        counts = {field: dict(sorted(Counter(row[field] for row in opportunities).items()))
                  for field in ("time","mode","stepFree","theme")}
        return {"version":"1.1.0","provenance":"All organisations, opportunities, timings and follow-ups are fictional.",
                "summary":{"roleCount":len(opportunities),"hostCount":len(hosts),"counts":counts},
                "opportunities":opportunities,"followUps":follow_ups}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixtures", type=Path, default=ROOT / "fixtures")
    parser.add_argument("--db", type=Path, default=ROOT / ".work/catalog.sqlite")
    parser.add_argument("--out", type=Path, default=ROOT / "site/data/catalog.json")
    args = parser.parse_args()
    args.db.parent.mkdir(parents=True, exist_ok=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=args.db.parent) as temp_dir:
        temp_db = Path(temp_dir) / "build.sqlite"
        catalog = build(args.fixtures, temp_db)
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=args.out.parent, delete=False) as output:
            json.dump(catalog, output, indent=2, ensure_ascii=False)
            output.write("\n")
        os.chmod(output.name, 0o644)
        os.replace(output.name, args.out)
        os.replace(temp_db, args.db)
    print(f"Built {len(catalog['opportunities'])} opportunities and {len(catalog['followUps'])} sample follow-ups.")


if __name__ == "__main__":
    main()
