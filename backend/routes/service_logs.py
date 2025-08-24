from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models import ServiceLog, Visit, Equipment, MaterialUsage
from datetime import datetime

bp = Blueprint('service_logs', __name__, url_prefix='/api/service-logs')


def parse_dt(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except Exception:
        return None


@bp.route('', methods=['GET', 'POST'])
def list_create_service_log():
    if request.method == 'POST':
        data = request.get_json() or {}
        visit_id = data.get('visit_id')
        equipment_id = data.get('equipment_id')
        description = data.get('description')
        if not visit_id or not equipment_id or not description:
            return jsonify({'error': 'visit_id, equipment_id and description are required'}), 400
        # Optional existence checks (fail with 404 if missing)
        Visit.query.get_or_404(visit_id)
        Equipment.query.get_or_404(equipment_id)
        item = ServiceLog()
        item.visit_id = visit_id
        item.equipment_id = equipment_id
        item.log_date = parse_dt(data.get('log_date'))
        item.description = description
        item.hours_worked = data.get('hours_worked')
        db.session.add(item)
        db.session.commit()
        return jsonify(item.to_dict()), 201
    # GET with optional filters
    q = ServiceLog.query
    cust_id = request.args.get('customer_id', type=int)
    if cust_id:
        # Join via Visit to filter by customer
        q = q.join(Visit).filter(Visit.customer_id == cust_id)
    equipment_id = request.args.get('equipment_id', type=int)
    if equipment_id:
        q = q.filter(ServiceLog.equipment_id == equipment_id)
    visit_id = request.args.get('visit_id', type=int)
    if visit_id:
        q = q.filter(ServiceLog.visit_id == visit_id)
    # MariaDB/MySQL doesn't support "NULLS LAST"; emulate by sorting NULLs last via boolean then value
    # ORDER BY (log_date IS NULL) ASC puts non-NULL first, then sort by log_date DESC
    items = q.order_by(ServiceLog.log_date.is_(None), ServiceLog.log_date.desc()).all()
    return jsonify([i.to_dict() for i in items])


@bp.route('/<int:log_id>', methods=['GET', 'PUT', 'DELETE'])
def service_log_detail(log_id: int):
    item = ServiceLog.query.get_or_404(log_id)
    if request.method == 'GET':
        return jsonify(item.to_dict())
    if request.method == 'PUT':
        data = request.get_json() or {}
        if 'visit_id' in data and data['visit_id'] is not None:
            Visit.query.get_or_404(data['visit_id'])
            item.visit_id = data['visit_id']
        if 'equipment_id' in data and data['equipment_id'] is not None:
            Equipment.query.get_or_404(data['equipment_id'])
            item.equipment_id = data['equipment_id']
        if 'log_date' in data:
            item.log_date = parse_dt(data.get('log_date'))
        if 'description' in data:
            item.description = data['description']
        if 'hours_worked' in data:
            item.hours_worked = data['hours_worked']
        # Optional: replace materials usage if provided
        def _get(dct, *keys):
            for k in keys:
                if k in dct:
                    return dct.get(k)
            return None
        materials_used_payload = data.get('materials_used')
        poison = data.get('poison_bait') or {}
        nonpoison = data.get('nonpoison_bait') or {}
        replace_materials = bool(isinstance(materials_used_payload, list) or poison or nonpoison)
        if replace_materials:
            try:
                # delete existing
                for u in list(item.materials_used or []):
                    db.session.delete(u)
                db.session.flush()
            except Exception:
                pass
            def add_usage(material_id, amount):
                try:
                    if material_id is None:
                        return
                    mid = int(material_id)
                    amt = None if amount is None else float(amount)
                    mu = MaterialUsage()
                    mu.service_log_id = item.id
                    mu.material_id = mid
                    mu.amount = amt
                    db.session.add(mu)
                except Exception:
                    pass
            if isinstance(materials_used_payload, list):
                for it in materials_used_payload:
                    add_usage(it.get('material_id'), it.get('amount'))
            pb_mat = _get(poison, 'used_material_id', 'benyttet_giftaate_id', 'benyttet_giftåte_id')
            pb_amt = _get(poison, 'refilled_grams', 'giftaate_etterfylt', 'giftåte_etterfylt')
            if pb_mat is not None or pb_amt is not None:
                add_usage(pb_mat, pb_amt)
            npb_mat = _get(nonpoison, 'used_material_id', 'benyttet_giftfritt_aate_id', 'benyttet_giftfritt_åte_id')
            npb_amt = _get(nonpoison, 'refilled_grams', 'giftfritt_etterfylt')
            if npb_mat is not None or npb_amt is not None:
                add_usage(npb_mat, npb_amt)
        db.session.commit()
        return jsonify(item.to_dict())
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'ServiceLog deleted'})
