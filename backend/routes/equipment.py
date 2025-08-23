from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models import Equipment
from datetime import date, datetime

bp = Blueprint('equipment', __name__, url_prefix='/api/equipment')

def _parse_date(value):
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        # Accept YYYY-MM-DD or ISO strings
        s = value
        if isinstance(s, datetime):
            return s.date()
        if isinstance(s, str):
            # Split on 'T' and take date part
            s = s.split('T')[0]
            return datetime.strptime(s, '%Y-%m-%d').date()
    except Exception:
        return None
    return None


@bp.route('', methods=['GET', 'POST'])
def list_create_equipment():
    if request.method == 'POST':
        data = request.get_json() or {}
        if not data.get('name') or not data.get('customer_id'):
            return jsonify({'error': 'name and customer_id are required'}), 400
        item = Equipment()
        item.customer_id = data['customer_id']
        item.name = data['name']
        item.type = data.get('type')
        item.serial_number = data.get('serial_number')
        item.installed_at = _parse_date(data.get('installed_at'))
        item.notes = data.get('notes')
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    items = Equipment.query.all()
    return jsonify([i.to_dict() for i in items])

@bp.route('/<int:equipment_id>', methods=['GET', 'PUT', 'DELETE'])
def equipment_detail(equipment_id: int):
    item = Equipment.query.get_or_404(equipment_id)
    if request.method == 'GET':
        return jsonify(item.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        item.customer_id = data.get('customer_id', item.customer_id)
        item.name = data.get('name', item.name)
        item.type = data.get('type', item.type)
        item.serial_number = data.get('serial_number', item.serial_number)
        if 'installed_at' in data:
            item.installed_at = _parse_date(data.get('installed_at')) or item.installed_at
        item.notes = data.get('notes', item.notes)
        db.session.commit()
        return jsonify(item.to_dict())
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Equipment deleted'})

# Equipment model is imported from backend.models, so no need to redefine it here.
