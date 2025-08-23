from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models import EquipmentType
from datetime import datetime

bp = Blueprint('equipment_types', __name__, url_prefix='/api/equipment-types')

@bp.route('', methods=['GET', 'POST'])
def list_create():
    if request.method == 'POST':
        data = request.get_json() or {}
        name = (data.get('name') or '').strip()
        if not name:
            return jsonify({'error': 'name required'}), 400
        # fields should be a list of field descriptors
        fields = data.get('fields') or []
        et = EquipmentType()
        et.name = name
        et.fields = fields
        et.created_at = datetime.utcnow()
        db.session.add(et)
        db.session.commit()
        return jsonify(et.to_dict()), 201
    items = EquipmentType.query.order_by(EquipmentType.name.asc()).all()
    return jsonify([i.to_dict() for i in items])

@bp.route('/<int:et_id>', methods=['GET', 'PUT', 'DELETE'])
def detail(et_id: int):
    et = EquipmentType.query.get_or_404(et_id)
    if request.method == 'GET':
        return jsonify(et.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        if 'name' in data and data.get('name'):
            et.name = data.get('name')
        if 'fields' in data:
            et.fields = data.get('fields') or []
        db.session.commit()
        return jsonify(et.to_dict())
    db.session.delete(et)
    db.session.commit()
    return jsonify({'message': 'deleted'})
