"""Seed script to create example equipment types for easier UX.

Run with: python backend/scripts/seed_equipment_types.py
"""
from backend.extensions import db
from backend.models import EquipmentType
from datetime import datetime

EXAMPLES = [
    {
        'name': 'Åtekasse',
        'fields': [
            { 'key': 'bait_type', 'label': 'Åte', 'type': 'select', 'options': ['gift', 'giftfritt', 'ingen'] },
            { 'key': 'locked', 'label': 'Låst', 'type': 'boolean' },
        ]
    },
    {
        'name': 'Gassfelle',
        'fields': [
            { 'key': 'strike_count', 'label': 'Antall slag', 'type': 'number' },
            { 'key': 'battery_ok', 'label': 'Batteri ok', 'type': 'boolean' },
        ]
    }
]


def seed():
    # Use app context
    from backend.app import app
    with app.app_context():
        created = 0
        for ex in EXAMPLES:
            existing = EquipmentType.query.filter(EquipmentType.name == ex['name']).first()
            if existing:
                print('Exists:', ex['name'])
                continue
            et = EquipmentType()
            et.name = ex['name']
            et.fields = ex['fields']
            et.created_at = datetime.utcnow()
            db.session.add(et)
            created += 1
        db.session.commit()
        print(f'Created {created} equipment types')


if __name__ == '__main__':
    seed()
