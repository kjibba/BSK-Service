import json
from datetime import datetime
from backend.app import app, db
from sqlalchemy import text

BACKUP = '../backend/db_backups/equipment_backup_20250823T182718Z.json'

CREATE_SQL = '''
CREATE TABLE IF NOT EXISTS equipment (
  id INTEGER NOT NULL PRIMARY KEY AUTO_INCREMENT,
  customer_id INTEGER,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(100),
  equipment_type_id INTEGER,
  serial_number VARCHAR(100),
  installed_at DATE,
  notes TEXT,
  latitude DOUBLE,
  longitude DOUBLE,
  properties JSON
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
'''

with app.app_context():
    # Create equipment table if missing
    try:
        db.session.execute(text(CREATE_SQL))
        db.session.commit()
        print('Ensured equipment table exists')
    except Exception as e:
        db.session.rollback()
        print('Failed to create equipment table:', e)
        raise

    # Load backup JSON
    import os
    backup_path = os.path.join(os.path.dirname(__file__), '..', 'db_backups', 'equipment_backup_20250823T182718Z.json')
    print('Loading backup:', backup_path)
    with open(backup_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    inserted = 0
    for row in data:
        try:
            # Prepare values, allow nulls
            idv = int(row.get('id')) if row.get('id') is not None else None
            customer_id = int(row.get('customer_id')) if row.get('customer_id') not in (None, '') else None
            name = row.get('name') or ''
            typ = row.get('type')
            serial = row.get('serial_number')
            installed_at = row.get('installed_at')
            notes = row.get('notes')
            lat = row.get('latitude')
            lng = row.get('longitude')
            props = row.get('properties')

            # Use INSERT ... ON DUPLICATE KEY UPDATE to upsert by id
            sql = text('''
            INSERT INTO equipment (id, customer_id, name, type, serial_number, installed_at, notes, latitude, longitude, properties)
            VALUES (:id, :customer_id, :name, :type, :serial_number, :installed_at, :notes, :latitude, :longitude, :properties)
            ON DUPLICATE KEY UPDATE
              customer_id=VALUES(customer_id), name=VALUES(name), type=VALUES(type), serial_number=VALUES(serial_number), installed_at=VALUES(installed_at), notes=VALUES(notes), latitude=VALUES(latitude), longitude=VALUES(longitude), properties=VALUES(properties)
            ''')
            params = {
                'id': idv,
                'customer_id': customer_id,
                'name': name,
                'type': typ,
                'serial_number': serial,
                'installed_at': installed_at,
                'notes': notes,
                'latitude': lat,
                'longitude': lng,
                'properties': json.dumps(props) if props is not None else None,
            }
            db.session.execute(sql, params)
            inserted += 1
        except Exception as e:
            print('Failed to insert row', row.get('id'), e)
            db.session.rollback()
    try:
        db.session.commit()
    except Exception as e:
        print('Commit failed', e)
        db.session.rollback()
        raise

    print('Inserted/updated rows:', inserted)
