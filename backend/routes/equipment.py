from flask import Blueprint, jsonify, request, current_app
from backend.extensions import db
from backend.models import Equipment
from datetime import date, datetime
import os
import base64
import uuid

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
        item.equipment_type_id = data.get('equipment_type_id')
        item.serial_number = data.get('serial_number')
        item.installed_at = _parse_date(data.get('installed_at'))
        # Use notes for a simple placement description
        item.notes = data.get('notes')
        props = data.get('properties') or {}
        # Handle optional placement photo (data URL/base64) and save to static/uploads
        placement_photo = data.get('placement_photo')
        if placement_photo and isinstance(placement_photo, str) and placement_photo.startswith('data:'):
            try:
                header, b64 = placement_photo.split(',', 1)
                # Validate MIME type roughly (must be image/*)
                mime = header.split(';')[0].replace('data:', '')
                if not mime.startswith('image/'):
                    return jsonify({'error': 'Invalid file type'}), 400
                # Basic size check: decoded bytes should be under MAX_UPLOAD_BYTES
                MAX_UPLOAD_BYTES = 2_500_000  # ~2.5 MB
                decoded = base64.b64decode(b64)
                if len(decoded) > MAX_UPLOAD_BYTES:
                    return jsonify({'error': 'File too large'}), 400
                # derive extension
                if 'jpeg' in mime or 'jpg' in mime:
                    ext = 'jpg'
                elif 'png' in mime:
                    ext = 'png'
                else:
                    ext = mime.split('/')[-1] or 'jpg'
                upload_dir = os.path.join(current_app.root_path, 'static', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)
                fname = f"placement_{uuid.uuid4().hex}.{ext}"
                fpath = os.path.join(upload_dir, fname)
                with open(fpath, 'wb') as f:
                    f.write(decoded)
                # Public URL path
                props = dict(props)
                props['placement_photo_url'] = f"/static/uploads/{fname}"
            except Exception:
                # On any error decoding/saving, return an error to help client-side debugging
                return jsonify({'error': 'Failed to process uploaded image'}), 400
        item.properties = props
        # Optional: set coordinates on create
        try:
            if 'latitude' in data:
                _lat = data.get('latitude')
                item.latitude = None if _lat in (None, '') else float(_lat)
            if 'longitude' in data:
                _lng = data.get('longitude')
                item.longitude = None if _lng in (None, '') else float(_lng)
        except Exception:
            # Ignore invalid numeric values; keep as None
            pass
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
        item.equipment_type_id = data.get('equipment_type_id', item.equipment_type_id)
        item.serial_number = data.get('serial_number', item.serial_number)
        if 'installed_at' in data:
            item.installed_at = _parse_date(data.get('installed_at')) or item.installed_at
        item.notes = data.get('notes', item.notes)
        # Merge properties rather than overwrite to preserve existing fields
        existing_props = item.properties or {}
        if 'properties' in data:
            try:
                merged = dict(existing_props)
                merged.update(data.get('properties') or {})
                existing_props = merged
            except Exception:
                existing_props = data.get('properties') or existing_props
        # Handle optional placement_photo similar to POST
        placement_photo = data.get('placement_photo')
        if placement_photo and isinstance(placement_photo, str) and placement_photo.startswith('data:'):
            try:
                header, b64 = placement_photo.split(',', 1)
                if 'jpeg' in header or 'jpg' in header:
                    ext = 'jpg'
                elif 'png' in header:
                    ext = 'png'
                else:
                    ext = 'jpg'
                upload_dir = os.path.join(current_app.root_path, 'static', 'uploads')
                os.makedirs(upload_dir, exist_ok=True)
                fname = f"placement_{uuid.uuid4().hex}.{ext}"
                fpath = os.path.join(upload_dir, fname)
                with open(fpath, 'wb') as f:
                    f.write(base64.b64decode(b64))
                existing_props = dict(existing_props)
                existing_props['placement_photo_url'] = f"/static/uploads/{fname}"
            except Exception:
                pass
        item.properties = existing_props
        # Allow updating coordinates
        if 'latitude' in data:
            _lat_val = data.get('latitude')
            try:
                item.latitude = None if _lat_val in (None, '') else float(_lat_val)
            except Exception:
                # ignore invalid numbers
                pass
        if 'longitude' in data:
            _lng_val = data.get('longitude')
            try:
                item.longitude = None if _lng_val in (None, '') else float(_lng_val)
            except Exception:
                # ignore invalid numbers
                pass
        db.session.commit()
        return jsonify(item.to_dict())
    db.session.delete(item)
    db.session.commit()
    return jsonify({'message': 'Equipment deleted'})

# Equipment model is imported from backend.models, so no need to redefine it here.
