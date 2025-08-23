#!/usr/bin/env python3
"""Scan equipment rows and extract lat/lng from name or notes when latitude/longitude are empty.

Usage:
  python clean_equipment_coords.py         # dry-run
  python clean_equipment_coords.py --apply # apply changes
"""
import re
import sys
from backend.extensions import db
from backend.models import Equipment
# Import app factory / app so we can push an app context
try:
    from backend.app import app as flask_app
except Exception:
    flask_app = None

COORD_RE = re.compile(r"(-?\d{1,3}[.,]\d+)\s*[,;\s]\s*(-?\d{1,3}[.,]\d+)")

def parse_coords(text):
    if not text:
        return None
    m = COORD_RE.search(text)
    if not m:
        return None
    try:
        lat = float(m.group(1).replace(',', '.'))
        lng = float(m.group(2).replace(',', '.'))
        if abs(lat) > 90 or abs(lng) > 180:
            return None
        return lat, lng
    except Exception:
        return None

def run(dry_run=True):
    if flask_app:
        with flask_app.app_context():
            q = Equipment.query.filter((Equipment.latitude == None) | (Equipment.longitude == None)).all()
            return _process(q, dry_run)
    else:
        q = Equipment.query.filter((Equipment.latitude == None) | (Equipment.longitude == None)).all()
        return _process(q, dry_run)


def _process(q, dry_run=True):
    print(f"Found {len(q)} equipment records missing latitude/longitude.")
    to_update = []
    for e in q:
        # try name then notes
        candidates = [e.name or '', e.notes or '']
        found = None
        for c in candidates:
            res = parse_coords(c)
            if res:
                found = res
                break
        if found:
            lat, lng = found
            print(f"Will set coords for equipment id={e.id} name='{e.name}': {lat}, {lng}")
            to_update.append((e, lat, lng))
    if not to_update:
        print('No candidates found.')
        return 0
    if dry_run:
        print('\nDry-run mode; no database changes made. Use --apply to write changes.')
        return len(to_update)
    # apply
    for e, lat, lng in to_update:
        print(f"Updating id={e.id} -> lat={lat} lng={lng}")
        e.latitude = lat
        e.longitude = lng
        db.session.add(e)
    db.session.commit()
    print(f"Applied {len(to_update)} updates.")
    return len(to_update)
    print(f"Found {len(q)} equipment records missing latitude/longitude.")
    to_update = []
    for e in q:
        # try name then notes
        candidates = [e.name or '', e.notes or '']
        found = None
        for c in candidates:
            res = parse_coords(c)
            if res:
                found = res
                break
        if found:
            lat, lng = found
            print(f"Will set coords for equipment id={e.id} name='{e.name}': {lat}, {lng}")
            to_update.append((e, lat, lng))
    if not to_update:
        print('No candidates found.')
        return 0
    if dry_run:
        print('\nDry-run mode; no database changes made. Use --apply to write changes.')
        return len(to_update)
    # apply
    for e, lat, lng in to_update:
        print(f"Updating id={e.id} -> lat={lat} lng={lng}")
        e.latitude = lat
        e.longitude = lng
        db.session.add(e)
    db.session.commit()
    print(f"Applied {len(to_update)} updates.")
    return len(to_update)

if __name__ == '__main__':
    apply_flag = '--apply' in sys.argv[1:]
    run(dry_run=not apply_flag)
