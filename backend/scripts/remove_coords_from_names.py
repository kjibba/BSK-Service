"""
Scan `equipment.name` for coordinate-like patterns and remove them from the name.
Dry-run by default; use --apply to write changes.

Example matches removed:
 - "Åtekasse - 60.338921, 5.268414" -> "Åtekasse"
 - "60.267085, 5.333430" -> ""

Safe: script runs inside Flask app context and uses SQLAlchemy session commit only when --apply is passed.
"""
import re
import argparse
from datetime import datetime

# Import Flask app and models from the project
from backend.app import app
from backend.models import db, Equipment

COORD_RE = re.compile(r"[-–—]?\s*\d{1,3}\.\d+\s*,\s*-?\d{1,3}\.\d+")


def clean_name(name: str) -> str:
    if not name:
        return name
    new = COORD_RE.sub('', name)
    # Remove leftover separators and whitespace
    new = new.strip()
    # Remove trailing punctuation or separators
    new = new.rstrip(' -–—,:;')
    new = new.strip()
    return new


def _process(apply_changes: bool):
    with app.app_context():
        eqs = Equipment.query.filter(Equipment.name.isnot(None)).all()
        to_update = []
        for e in eqs:
            if COORD_RE.search(e.name):
                new_name = clean_name(e.name)
                if new_name != e.name:
                    to_update.append((e.id, e.name, new_name))

        print(f"Found {len(to_update)} equipment rows with coordinate patterns in name.")
        for eid, old, new in to_update[:200]:
            print(f"id={eid}: '{old}' -> '{new}'")

        if not to_update:
            print("Nothing to do.")
            return

        if not apply_changes:
            print("Dry-run mode; no changes written. Run with --apply to commit.")
            return

        # Apply changes
        applied = 0
        for eid, old, new in to_update:
            e = Equipment.query.get(eid)
            if e is None:
                print(f"Skipping id={eid}: no longer exists")
                continue
            e.name = new
            db.session.add(e)
            applied += 1
        db.session.commit()
        print(f"Applied {applied} name updates at {datetime.utcnow().isoformat()}Z")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Remove coordinate substrings from equipment.name')
    parser.add_argument('--apply', action='store_true', help='Write changes to the database')
    args = parser.parse_args()
    _process(args.apply)
