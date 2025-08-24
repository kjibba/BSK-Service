from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models import Visit
from datetime import datetime

bp = Blueprint('visits', __name__, url_prefix='/api/visits')

def _parse_dt(value):
    if not value:
        return None
    try:
        # Handle 'Z' suffix
        if isinstance(value, str) and value.endswith('Z'):
            value = value[:-1] + '+00:00'
        dt = datetime.fromisoformat(value) if isinstance(value, str) else value
        # Drop tzinfo for MySQL naive datetime
        return dt.replace(tzinfo=None) if hasattr(dt, 'tzinfo') and dt.tzinfo else dt
    except Exception:
        return None


@bp.route('', methods=['GET', 'POST'])
def list_create_visit():
    if request.method == 'POST':
        data = request.get_json() or {}
        if not data.get('customer_id') or not data.get('visit_date'):
            return jsonify({'error': 'customer_id and visit_date are required'}), 400
        item = Visit()
        item.customer_id = data['customer_id']
        item.visit_date = _parse_dt(data['visit_date'])
        # Optional fields
        item.technician = data.get('technician')
        item.notes = data.get('notes')
        # Allow assigning directly on create if field exists
        try:
            if hasattr(item, 'assigned_technician_id'):
                _assignee = data.get('assigned_technician_id')
                if _assignee is not None:
                    item.assigned_technician_id = int(_assignee)
        except Exception:
            pass
        # Allow setting status explicitly if provided; otherwise model default applies
        try:
            if hasattr(item, 'status') and data.get('status'):
                item.status = str(data.get('status'))
        except Exception:
            pass
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    # GET with optional filters
    q = Visit.query
    customer_id = request.args.get('customer_id', type=int)
    if customer_id:
        q = q.filter(Visit.customer_id == customer_id)
    items = q.order_by(Visit.visit_date.desc()).all()
    return jsonify([i.to_dict() for i in items])

@bp.route('/<int:visit_id>', methods=['GET', 'PUT', 'DELETE'])
def visit_detail(visit_id: int):
    item = Visit.query.get_or_404(visit_id)
    if request.method == 'GET':
        return jsonify(item.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        item.customer_id = data.get('customer_id', item.customer_id)
        if 'visit_date' in data:
            item.visit_date = _parse_dt(data.get('visit_date')) or item.visit_date
        item.technician = data.get('technician', item.technician)
        item.notes = data.get('notes', item.notes)
        db.session.commit()
        return jsonify(item.to_dict())
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Visit deleted'})
