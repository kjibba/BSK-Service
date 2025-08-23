#!/usr/bin/env python3
"""Backup equipment table to JSON and CSV files in backend/db_backups/.

Usage:
  python -m backend.scripts.backup_equipment
"""
import os
import json
import csv
from datetime import datetime
try:
    from backend.app import app as flask_app
except Exception:
    flask_app = None

from backend.models import Equipment


def run():
    outdir = os.path.join(os.path.dirname(__file__), '..', 'db_backups')
    outdir = os.path.abspath(outdir)
    os.makedirs(outdir, exist_ok=True)
    stamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    json_path = os.path.join(outdir, f'equipment_backup_{stamp}.json')
    csv_path = os.path.join(outdir, f'equipment_backup_{stamp}.csv')

    if flask_app:
        with flask_app.app_context():
            items = [e.to_dict() for e in Equipment.query.order_by(Equipment.id.asc()).all()]
    else:
        items = [e.to_dict() for e in Equipment.query.order_by(Equipment.id.asc()).all()]

    # write JSON
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2, default=str)

    # write CSV
    if items:
        keys = sorted(items[0].keys())
        with open(csv_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=keys)
            writer.writeheader()
            for row in items:
                writer.writerow({k: (row.get(k) if row.get(k) is not None else '') for k in keys})

    print(f'Wrote {len(items)} equipment rows to:')
    print(f'  {json_path}')
    print(f'  {csv_path}')


if __name__ == '__main__':
    run()
