from flask import Flask, jsonify, request
from flask.typing import ResponseReturnValue
from flask_migrate import Migrate
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, UserMixin, current_user as flask_login_user

from backend.extensions import db
from backend.models import Customer, Visit, Equipment, ServiceLog, Employee, Material, MaterialUsage, Feedback
from sqlalchemy import or_
from datetime import datetime, timedelta
import os
import json
import platform
# Dynamically import current_user to avoid hard dependency on flask_login in environments without it.
try:  # pragma: no cover - optional dependency
    from importlib import import_module
    _fl = import_module('flask_login')
    current_user = getattr(_fl, 'current_user', None)  # type: ignore[attr-defined]
except Exception:  # pragma: no cover
    current_user = None  # type: ignore

# Grunnleggende App-konfigurasjon
app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://bsk_user:et_sikkert_passord@localhost/bsk_service_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = app.config.get('SECRET_KEY') or 'dev-secret-change-me'

# Initialiser utvidelser
db.init_app(app)
migrate = Migrate(app, db)
# Allow credentials from Vite dev server origins (5173/5174)
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            "http://localhost:5175",
            "http://127.0.0.1:5175",
        ]
    }
})

# --- Auth setup (Flask-Login) ---
login_manager = LoginManager(app)

class User(UserMixin):
    def __init__(self, id: int, email: str, name: str|None = None):
        self.id = id
        self.email = email
        self.name = name or email

    @staticmethod
    def from_employee(emp: Employee):
        return User(emp.id, emp.email or f"user{emp.id}@local", emp.name)

@login_manager.user_loader
def load_user(user_id: str):
    try:
        emp = Employee.query.get(int(user_id))
        if emp:
            return User.from_employee(emp)
    except Exception:
        return None
    return None

# Importer modeller ETTER at db er initialisert
with app.app_context():
    # Import models so SQLAlchemy is aware of them when migrations run
    from backend.models import Material, MaterialUsage, Employee, RouteChoice, Photo
    # Register blueprints
    from backend.routes.equipment import bp as equipment_bp
    from backend.routes.visits import bp as visits_bp
    from backend.routes.service_logs import bp as service_logs_bp
    from backend.routes.equipment_types import bp as equipment_types_bp
    app.register_blueprint(equipment_bp)
    app.register_blueprint(visits_bp)
    app.register_blueprint(service_logs_bp)
    app.register_blueprint(equipment_types_bp)

@app.route('/')
def index():
    return "Hello, BSK Service App!"

@app.route('/api/auth/login', methods=['POST'])
def auth_login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    if not email:
        return jsonify({'error': 'email required'}), 400
    emp = Employee.query.filter(Employee.email == email).first()
    if not emp:
        # Reject unknown emails; do not auto-provision
        return jsonify({'error': 'Ukjent e-post. Kontakt administrator for tilgang.'}), 401
    user = User.from_employee(emp)
    login_user(user, remember=True)
    return jsonify({'user': {'id': user.id, 'email': user.email, 'name': user.name, 'role': getattr(emp, 'role', None)}})

@app.route('/api/auth/logout', methods=['POST'])
def auth_logout():
    # Be tolerant: allow logout even if not authenticated
    try:
        logout_user()
    except Exception:
        pass
    resp = jsonify({'ok': True})
    # Defensively clear common cookies
    try:
        resp.delete_cookie('session', path='/')
        resp.delete_cookie('remember_token', path='/')
    except Exception:
        pass
    return resp

@app.route('/api/auth/whoami', methods=['GET'])
def auth_whoami():
    if flask_login_user.is_authenticated:
        # Load employee to include role/name
        emp = None
        try:
            emp = Employee.query.get(int(flask_login_user.id))
        except Exception:
            emp = None
        return jsonify({'authenticated': True, 'user': {
            'id': int(flask_login_user.id),
            'email': getattr(flask_login_user, 'email', None),
            'name': getattr(emp, 'name', None),
            'role': getattr(emp, 'role', None),
        }})
    return jsonify({'authenticated': False})

@app.route('/api/employees', methods=['GET'])
@login_required
def list_employees():
    items = Employee.query.order_by(Employee.name.asc()).all()
    # Bootstrap safety: if empty, include the current logged-in employee if present
    if not items:
        try:
            me = Employee.query.get(int(flask_login_user.id)) if flask_login_user.is_authenticated else None
        except Exception:
            me = None
        if me is not None:
            items = [me]
    try:
        app.logger.info("/api/employees user=%s count=%s", getattr(flask_login_user, 'id', None), len(items))
    except Exception:
        pass
    return jsonify([e.to_dict() for e in items])

@app.route('/api/employees/<int:emp_id>', methods=['GET', 'PUT'])
@login_required
def employee_detail(emp_id: int) -> ResponseReturnValue:
    emp = Employee.query.get_or_404(emp_id)
    if request.method == 'GET':
        return jsonify(emp.to_dict())
    # PUT: only managers can change roles (and name optional)
    me = None
    try:
        me = Employee.query.get(int(flask_login_user.id)) if flask_login_user.is_authenticated else None
    except Exception:
        me = None
    if not me or getattr(me, 'role', '') != 'manager':
        return jsonify({'error': 'Only managers can update employees'}), 403
    data = request.get_json() or {}
    if 'role' in data:
        emp.role = data['role']
    if 'name' in data and data['name']:
        emp.name = data['name']
    db.session.commit()
    return jsonify(emp.to_dict())

@app.route('/api/customers', methods=['GET', 'POST'])
def handle_customers() -> ResponseReturnValue:
    if request.method == 'POST':
        # Oppretter en ny kunde
        data = request.get_json() or {}
        if not data.get('name'):
            return jsonify({'message': 'Missing data'}), 400
        new_customer = Customer()
        new_customer.name = data.get('name')
        new_customer.address = data.get('address')
        new_customer.postal_code = data.get('postal_code')
        new_customer.city = data.get('city')
        new_customer.contact_person = data.get('contact_person')
        new_customer.email = data.get('email')
        new_customer.phone = data.get('phone')
        db.session.add(new_customer)
        db.session.commit()
        return jsonify(new_customer.to_dict()), 201

    # GET: List customers; optional sort by next visit, filter by coords, and include computed fields
    sort = request.args.get('sort')
    include = request.args.get('include')
    has_coords = request.args.get('has_coords')

    query = Customer.query
    if has_coords in ('1', 'true', 'True'):
        # Only customers with both latitude and longitude
        query = query.filter(Customer.latitude.isnot(None), Customer.longitude.isnot(None))

    customers = query.all()

    # Whether to include computed next visit field
    include_next = (sort == 'next_visit') or (include == 'next_visit')

    if include_next:
        result = []
        for c in customers:
            obj = c.to_dict()
            next_visit = _compute_next_visit(c)
            obj['next_visit_date'] = next_visit.isoformat() if next_visit else None
            result.append(obj)
        if sort == 'next_visit':
            result.sort(key=lambda x: (x['next_visit_date'] is None, x['next_visit_date']))
        return jsonify(result)

    return jsonify([customer.to_dict() for customer in customers])


@app.route('/api/map/customers', methods=['GET'])
def map_customers() -> ResponseReturnValue:
    # Return customers with coordinates; if missing, derive from equipment centroid

    # Fetch customers and their equipment lazily when needed; avoid N+1 by manual access when computing
    customers = Customer.query.all()
    # Build clusters of customers by normalized name to merge history across duplicates/placeholders
    def _norm_name(s: str):
        if not s:
            return ''
        t = s.strip().lower()
        t = t.replace('æ', 'ae').replace('ø', 'o').replace('å', 'a')
        t = ' '.join(t.split())
        return t
    name_to_ids = {}
    for cust in customers:
        key = _norm_name(cust.name)
        name_to_ids.setdefault(key, []).append(cust.id)
    result = []
    for c in customers:
        lat = c.latitude
        lng = c.longitude
        if lat is None or lng is None:
            # derive from equipment centroid
            eq_points = [(e.latitude, e.longitude) for e in c.equipment if (e.latitude is not None and e.longitude is not None)]
            if eq_points:
                lat = sum(p[0] for p in eq_points) / len(eq_points)
                lng = sum(p[1] for p in eq_points) / len(eq_points)
        if lat is None or lng is None:
            # Skip customers with no usable coordinates (geocoding can be added later)
            continue

        cluster_ids = name_to_ids.get(_norm_name(c.name), [c.id])
        next_visit = _compute_next_visit(c, history_customer_ids=cluster_ids)
        obj = c.to_dict()
        obj['latitude'] = float(lat)
        obj['longitude'] = float(lng)
        obj['next_visit_date'] = next_visit.isoformat() if next_visit else None
        result.append(obj)

    return jsonify(result)


def _compute_next_visit(c: Customer, history_customer_ids=None):
    """Compute next visit based on frequency (visits_per_year) and last visit or start_date.
    Fallback: if frequency missing, return earliest scheduled future visit if any.
    """
    try:
        vpy = getattr(c, 'visits_per_year', None)
    except Exception:
        vpy = None
    now = datetime.now()

    # Helper to pick earliest future scheduled from DB if present
    def scheduled_future():
        q = db.session.query(db.func.min(Visit.visit_date)).filter(Visit.visit_date >= now)
        if history_customer_ids:
            q = q.filter(Visit.customer_id.in_(history_customer_ids))
        else:
            q = q.filter(Visit.customer_id == c.id)
        return q.scalar()

    if not vpy or vpy <= 0:
        # If frequency is unknown, try to infer from historical visits; else use any scheduled future
        fut = scheduled_future()
        # If a scheduled future exists, prefer that
        if fut:
            return fut
        # Infer interval from historical activity (visits and service logs)
        qhist_v = db.session.query(Visit.visit_date).filter(Visit.visit_date != None)
        if history_customer_ids:
            qhist_v = qhist_v.filter(Visit.customer_id.in_(history_customer_ids))
        else:
            qhist_v = qhist_v.filter(Visit.customer_id == c.id)
        v_dates = [r[0] for r in qhist_v.order_by(Visit.visit_date.desc()).limit(6).all() if r[0] is not None]

        qhist_s = (
            db.session.query(ServiceLog.log_date)
            .outerjoin(Visit, ServiceLog.visit_id == Visit.id)
            .outerjoin(Equipment, ServiceLog.equipment_id == Equipment.id)
            .filter(ServiceLog.log_date != None)
        )
        if history_customer_ids:
            qhist_s = qhist_s.filter(or_(Visit.customer_id.in_(history_customer_ids), Equipment.customer_id.in_(history_customer_ids)))
        else:
            qhist_s = qhist_s.filter(or_(Visit.customer_id == c.id, Equipment.customer_id == c.id))
        s_dates = [r[0] for r in qhist_s.order_by(ServiceLog.log_date.desc()).limit(6).all() if r[0] is not None]

        dates = sorted(set(v_dates + s_dates), reverse=True)
        inferred_days = None
        if len(dates) >= 2:
            diffs = []
            for i in range(len(dates)-1):
                d = (dates[i] - dates[i+1]).days
                if d > 0:
                    diffs.append(d)
            if diffs:
                diffs.sort()
                mid = len(diffs)//2
                inferred_days = diffs[mid] if len(diffs)%2==1 else round((diffs[mid-1]+diffs[mid])/2)
        if inferred_days is None:
            inferred_days = 365
        interval = timedelta(days=max(1, inferred_days))
        base = dates[0] if dates else None
        if base is None:
            # No prior activity; assume first cycle from now
            return now + interval
        nxt = base + interval
        loops = 0
        while nxt <= now and loops < 50:
            nxt += interval
            loops += 1
        return nxt

    # Interval between visits
    days = max(1, round(365 / float(vpy)))
    interval = timedelta(days=days)

    # Find the base date: last activity (visit or service log) on/before now, else start_date
    q_last_v = db.session.query(db.func.max(Visit.visit_date)).filter(Visit.visit_date <= now)
    if history_customer_ids:
        q_last_v = q_last_v.filter(Visit.customer_id.in_(history_customer_ids))
    else:
        q_last_v = q_last_v.filter(Visit.customer_id == c.id)
    last_visit = q_last_v.scalar()

    q_last_s = (
        db.session.query(db.func.max(ServiceLog.log_date))
        .outerjoin(Visit, ServiceLog.visit_id == Visit.id)
        .outerjoin(Equipment, ServiceLog.equipment_id == Equipment.id)
        .filter(ServiceLog.log_date <= now)
    )
    if history_customer_ids:
        q_last_s = q_last_s.filter(or_(Visit.customer_id.in_(history_customer_ids), Equipment.customer_id.in_(history_customer_ids)))
    else:
        q_last_s = q_last_s.filter(or_(Visit.customer_id == c.id, Equipment.customer_id == c.id))
    last_log = q_last_s.scalar()

    base = max([d for d in [last_visit, last_log] if d is not None], default=None)
    if base is None:
        try:
            base = c.start_date
        except Exception:
            base = None
        if isinstance(base, datetime) is False and base is not None:
            # convert date to datetime noon to avoid tz issues
            base = datetime.combine(base, datetime.min.time())
    if base is None:
        # No history; optionally use scheduled future if exists, else schedule from now when frequency is known
        fut = scheduled_future()
        if fut:
            return fut
        if vpy and vpy > 0:
            return now + interval
        return None

    # Step forward in intervals until in future
    next_dt = base + interval
    # Safety cap to prevent excessive loops
    loops = 0
    while next_dt <= now and loops < 50:
        next_dt += interval
        loops += 1
    return next_dt


@app.route('/api/visits/my_missions', methods=['GET'])
@login_required
def my_missions() -> ResponseReturnValue:
    """Return visits assigned to the currently logged-in technician with status 'Planlagt'.

    Notes:
    - This assumes a `current_user` object (e.g. from Flask-Login) exposing `id` and/or `email`.
    - If the `Visit` model has `assigned_technician_id` and `status`, we use them.
    - If not, we gracefully fall back to filtering by `Visit.technician` (string) and upcoming dates.
    - This endpoint returns a JSON array of visits (using Visit.to_dict()) and includes
      extra fields if present (status, assigned_technician_id) without requiring model changes here.
    """
    now = datetime.now()

    # Helper to determine identity from current_user, with optional query override for testing.
    # This keeps the route useful even before auth is fully wired up.
    technician_id = None
    technician_email = None
    try:
        # Optional overrides for local testing: /api/visits/my_missions?email=...&user_id=...
        if 'user_id' in request.args:
            _uid = request.args.get('user_id')
            if _uid is not None and str(_uid).strip() != '':
                technician_id = int(_uid)
        if 'email' in request.args:
            technician_email = request.args.get('email')
    except Exception:
        pass

    if current_user is not None:
        try:
            if technician_id is None and getattr(current_user, 'id', None) is not None:
                technician_id = int(current_user.id)
        except Exception:
            pass
        try:
            if technician_email is None and getattr(current_user, 'email', None):
                technician_email = str(current_user.email)
        except Exception:
            pass

    query = Visit.query
    # Prefer the explicit assignment field if it exists on the model
    if hasattr(Visit, 'assigned_technician_id') and technician_id is not None:
        query = query.filter(getattr(Visit, 'assigned_technician_id') == technician_id)
    elif hasattr(Visit, 'technician') and technician_email:
        # Fallback to matching the technician string to the user's email
        query = query.filter(getattr(Visit, 'technician') == technician_email)
    else:
        # As a last resort, if we cannot identify the user or field, return 400 with a hint.
        return jsonify({
            'error': 'Unable to determine technician identity or assignment field. Provide ?user_id= or ?email=, or ensure authentication and Visit.assigned_technician_id exist.'
        }), 400

    # Include planned and ongoing visits if status field exists; otherwise, assume future-dated visits are relevant.
    if hasattr(Visit, 'status'):
        query = query.filter(getattr(Visit, 'status').in_(['Planlagt', 'Pågående']))
    else:
        # Best-effort heuristic: future visits are considered planned
        query = query.filter(Visit.visit_date >= now)

    visits = query.order_by(Visit.visit_date.asc()).all()

    # Prefetch customers to enrich response without N+1
    cust_ids = list({int(v.customer_id) for v in visits if getattr(v, 'customer_id', None) is not None})
    customers = {}
    if cust_ids:
        for c in Customer.query.filter(Customer.id.in_(cust_ids)).all():
            try:
                customers[int(c.id)] = c
            except Exception:
                pass

    # Build response dicts, including optional fields if present
    items = []
    for v in visits:
        obj = v.to_dict()
        if hasattr(v, 'status'):
            obj['status'] = getattr(v, 'status')
        if hasattr(v, 'assigned_technician_id'):
            obj['assigned_technician_id'] = getattr(v, 'assigned_technician_id')
        # Add customer details for better UX in lists
        try:
            c = customers.get(int(v.customer_id)) if getattr(v, 'customer_id', None) is not None else None
        except Exception:
            c = None
        if c is not None:
            try:
                obj['customer_name'] = getattr(c, 'name', None)
                obj['customer_address'] = getattr(c, 'address', None)
                obj['customer_postal_code'] = getattr(c, 'postal_code', None)
                obj['customer_city'] = getattr(c, 'city', None)
            except Exception:
                pass
        items.append(obj)

    return jsonify(items)


# --- Helper functions for identifying requester and checking permissions ---
def _get_request_user():
    """Return (user_id, email) for the current requester.
    Uses current_user if available; allows ?user_id / ?email overrides for local testing.
    """
    uid = None
    email = None
    # Overrides via querystring (useful before auth is wired fully)
    _uid = request.args.get('user_id')
    if _uid:
        try:
            uid = int(_uid)
        except Exception:
            pass
    _em = request.args.get('email')
    if _em:
        email = _em
    # Flask-Login current_user if present
    if flask_login_user is not None and getattr(flask_login_user, 'is_authenticated', False):
        try:
            if uid is None and getattr(flask_login_user, 'id', None) is not None:
                uid = int(flask_login_user.id)
        except Exception:
            pass
        try:
            if email is None and getattr(flask_login_user, 'email', None):
                email = str(flask_login_user.email)
        except Exception:
            pass
    return uid, email


@app.route('/api/feedback', methods=['POST', 'GET'])
def feedback_list_create():
    """POST: create feedback entry (open)
       GET: list recent feedback entries for managers
    """
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        uid, email = _get_request_user()
        f = None
        try:
            f = Feedback()
            f.user_id = uid
            f.user_email = email
            f.text = data.get('text') or data.get('message') or ''
            f.context = data.get('context') or {}
            f.diagnostics = data.get('diagnostics') or {}
            f.status = 'open'
            f.created_at = datetime.utcnow()
            f.updated_at = datetime.utcnow()
            db.session.add(f)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            app.logger.exception('Failed to store feedback: %s', e)
            return jsonify({'error': 'failed to store feedback'}), 500
        return jsonify({'ok': True, 'id': f.id}), 201

    # GET: manager-only
    try:
        if not (flask_login_user and getattr(flask_login_user, 'is_authenticated', False)):
            return jsonify({'error': 'authentication required'}), 401
    except Exception:
        return jsonify({'error': 'authentication required'}), 401
    try:
        emp = Employee.query.get(int(flask_login_user.id)) if getattr(flask_login_user, 'is_authenticated', False) else None
    except Exception:
        emp = None
    if not emp or getattr(emp, 'role', '') != 'manager':
        return jsonify({'error': 'manager role required'}), 403

    tail = 200
    try:
        if 'tail' in request.args:
            tail = max(1, int(request.args.get('tail') or tail))
    except Exception:
        tail = 200

    items = [f.to_dict() for f in Feedback.query.order_by(Feedback.created_at.desc()).limit(tail).all()]
    return jsonify({'count': len(items), 'items': items})


@app.route('/api/feedback/<int:fid>', methods=['GET', 'PUT'])
@login_required
def feedback_detail(fid: int):
    """GET feedback detail (manager) or PUT to update status/handler_note (manager)
    """
    f = Feedback.query.get_or_404(fid)
    # Check manager
    emp = None
    try:
        emp = Employee.query.get(int(flask_login_user.id)) if getattr(flask_login_user, 'is_authenticated', False) else None
    except Exception:
        emp = None
    if not emp or getattr(emp, 'role', '') != 'manager':
        return jsonify({'error': 'manager role required'}), 403

    if request.method == 'GET':
        return jsonify(f.to_dict())

    data = request.get_json() or {}
    changed = False
    if 'status' in data and data['status'] in ('open', 'in_progress', 'closed'):
        f.status = data['status']; changed = True
    if 'handler_note' in data:
        f.handler_note = data['handler_note']; changed = True
    if 'handled_by' in data:
        try:
            f.handled_by = int(data['handled_by'])
            changed = True
        except Exception:
            pass
    if changed:
        f.updated_at = datetime.utcnow()
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            return jsonify({'error': 'failed to update'}), 500
    return jsonify(f.to_dict())


def _is_assigned_to_visit(v: Visit, uid, email) -> bool:
    """Check if requester is assigned to this visit (by id or email), when fields exist.
    Falls back to False if we cannot determine.
    """
    try:
        if hasattr(v, 'assigned_technician_id') and uid is not None:
            return getattr(v, 'assigned_technician_id') == uid
    except Exception:
        pass
    try:
        if hasattr(v, 'technician') and email:
            return getattr(v, 'technician') == email
    except Exception:
        pass
    return False


def _is_owner_of_visit(v: Visit, uid) -> bool:
    """Check if requester is owner (the technician who started the visit), if field exists."""
    if uid is None:
        return False
    if hasattr(v, 'owner_technician_id'):
        try:
            return getattr(v, 'owner_technician_id') == uid
        except Exception:
            return False
    return False


@app.route('/api/office/visits', methods=['POST'])
@login_required
def office_create_visit() -> ResponseReturnValue:
    """Office: create an ad-hoc visit for a customer (e.g., phone-in job).

    Body: {
      customer_id: int,           // required
      visit_date: ISO8601 string, // required
      notes?: str,
      assigned_technician_id?: int, // optional assignment
      technician_email?: str         // fallback if id not given
    }
    Returns created Visit.
    Permissions: any authenticated user; assignment to other techs is allowed for managers only.
    """
    data = request.get_json() or {}
    cid = data.get('customer_id')
    when = data.get('visit_date')
    if not cid or not when:
        return jsonify({'error': 'customer_id and visit_date are required'}), 400
    try:
        # parse datetime; accept 'Z'
        if isinstance(when, str) and when.endswith('Z'):
            when = when[:-1] + '+00:00'
        dt = datetime.fromisoformat(when) if isinstance(when, str) else when
        if hasattr(dt, 'tzinfo') and dt.tzinfo:
            dt = dt.replace(tzinfo=None)
    except Exception:
        return jsonify({'error': 'visit_date must be ISO 8601 datetime'}), 400

    v = Visit()
    v.customer_id = int(cid)
    v.visit_date = dt
    if 'notes' in data:
        v.notes = data.get('notes')

    # assignment rules
    target_id = data.get('assigned_technician_id')
    tech_email = data.get('technician_email')
    requester = None
    try:
        requester = Employee.query.get(int(flask_login_user.id)) if flask_login_user.is_authenticated else None
    except Exception:
        requester = None
    is_manager = bool(getattr(requester, 'role', '') == 'manager')
    if target_id is not None:
        # allow self-assign; manager can assign anyone
        is_self = False
        try:
            is_self = int(flask_login_user.id) == int(target_id)
        except Exception:
            is_self = False
        if is_manager or is_self:
            if hasattr(v, 'assigned_technician_id'):
                try: v.assigned_technician_id = int(target_id)
                except Exception: pass
            else:
                # fallback to email
                tech = Employee.query.get(int(target_id))
                if tech and tech.email:
                    v.technician = tech.email
        else:
            return jsonify({'error': 'Not allowed to assign to other technicians'}), 403
    elif tech_email:
        # email assignment only if manager
        if is_manager:
            v.technician = str(tech_email)
        else:
            return jsonify({'error': 'Only managers can assign by email'}), 403

    # If no assignment was provided, default to self-assign for convenience
    if target_id is None and not tech_email:
        try:
            if hasattr(v, 'assigned_technician_id') and flask_login_user.is_authenticated and getattr(flask_login_user, 'id', None) is not None:
                v.assigned_technician_id = int(flask_login_user.id)
            elif getattr(flask_login_user, 'email', None) and not getattr(v, 'assigned_technician_id', None):
                # Fallback to string email if assignment id field is not present
                v.technician = str(getattr(flask_login_user, 'email'))
        except Exception:
            pass

    # Ensure default status Planlagt if field exists
    try:
        if hasattr(v, 'status') and not v.status:
            v.status = 'Planlagt'
    except Exception:
        pass
    db.session.add(v)
    db.session.commit()
    return jsonify(v.to_dict()), 201


@app.route('/api/office/visits/<int:visit_id>/assign', methods=['POST'])
@login_required
def office_assign_visit(visit_id: int) -> ResponseReturnValue:
    """Office: assign an existing visit to a technician (manager only)."""
    v = Visit.query.get_or_404(visit_id)
    data = request.get_json() or {}
    target_id = data.get('assigned_technician_id')
    if target_id is None:
        return jsonify({'error': 'assigned_technician_id required'}), 400
    # Only manager can assign via this office endpoint
    emp = None
    try:
        emp = Employee.query.get(int(flask_login_user.id)) if flask_login_user.is_authenticated else None
    except Exception:
        emp = None
    if not emp or getattr(emp, 'role', '') != 'manager':
        return jsonify({'error': 'Only managers can assign'}), 403
    if hasattr(v, 'assigned_technician_id'):
        try: v.assigned_technician_id = int(target_id)
        except Exception: pass
    else:
        tech = Employee.query.get(int(target_id))
        if tech and tech.email:
            v.technician = tech.email
    db.session.commit()
    return jsonify(v.to_dict())


@app.route('/api/visits/<int:visit_id>/assign', methods=['POST'])
@login_required
def assign_visit(visit_id: int) -> ResponseReturnValue:
    """Assign a visit to a technician.

    Body: { "assigned_technician_id": int }
    Rules:
    - Managers (Employee.role == 'manager') can assign any technician.
    - A technician can self-assign (set assigned_technician_id to their own id).
    """
    v = Visit.query.get_or_404(visit_id)
    data = request.get_json() or {}
    target_id = data.get('assigned_technician_id')
    if target_id is None:
        return jsonify({'error': 'assigned_technician_id required'}), 400
    # Load requester employee
    emp = None
    try:
        emp = Employee.query.get(int(flask_login_user.id)) if flask_login_user.is_authenticated else None
    except Exception:
        emp = None
    is_manager = bool(getattr(emp, 'role', '') == 'manager')
    is_self = False
    try:
        is_self = int(flask_login_user.id) == int(target_id)
    except Exception:
        is_self = False
    if not (is_manager or is_self):
        return jsonify({'error': 'Not allowed to assign this visit'}), 403
    # Apply assignment
    if hasattr(v, 'assigned_technician_id'):
        v.assigned_technician_id = int(target_id)
    else:
        # Fallback: write to technician email if matches
        tech = Employee.query.get(int(target_id))
        if tech and tech.email:
            v.technician = tech.email
    db.session.commit()
    return jsonify(v.to_dict())


@app.route('/api/visits/<int:visit_id>/detail', methods=['GET'])
@login_required
def visit_detail(visit_id: int) -> ResponseReturnValue:
    """Return a rich view of a visit for the technician UI.

    Includes:
      - visit (to_dict)
      - customer (basic fields)
      - equipment list for the customer, each with a 'checked' flag if there's a ServiceLog for this visit
      - logs for this visit
    """
    v = Visit.query.get_or_404(visit_id)
    cust = Customer.query.get(v.customer_id)

    # Find all equipment for this customer
    eq_items = Equipment.query.filter(Equipment.customer_id == v.customer_id).all()

    # Find which equipment has logs for this visit
    log_pairs = db.session.query(ServiceLog.equipment_id).filter(ServiceLog.visit_id == visit_id).all()
    checked_ids = {row[0] for row in log_pairs}

    equipment = []
    for e in eq_items:
        item = e.to_dict()
        item['checked'] = e.id in checked_ids
        equipment.append(item)

    # All logs for this visit
    logs = [s.to_dict() for s in ServiceLog.query.filter(ServiceLog.visit_id == visit_id).order_by(ServiceLog.id.asc()).all()]

    return jsonify({
        'visit': v.to_dict(),
        'customer': cust.to_dict() if cust else None,
        'equipment': equipment,
        'logs': logs,
    })


@app.route('/api/visits/<int:visit_id>/start', methods=['POST'])
@login_required
def start_visit(visit_id: int) -> ResponseReturnValue:
    """Mark a visit as started by the assigned technician.

    - Sets status to 'Pågående' when Visit.status exists.
    - Sets started_at timestamp when the field exists.
    - If fields are missing, we update what we can and return a helpful message.
    """
    v = Visit.query.get_or_404(visit_id)
    uid, email = _get_request_user()

    # Only assigned tech can start; if we cannot determine assignment, allow to avoid blocking in dev
    if hasattr(v, 'status') and getattr(v, 'status') not in (None, 'Planlagt'):
        # Idempotent: if already ongoing, just return current state
        obj = v.to_dict()
        obj['info'] = 'Visit already started'
        return jsonify(obj)

    # If the visit is unassigned, auto-assign to the requester to allow starting.
    try:
        unassigned = True
        if hasattr(v, 'assigned_technician_id') and getattr(v, 'assigned_technician_id') not in (None, 0):
            unassigned = False
        if hasattr(v, 'technician') and getattr(v, 'technician'):
            unassigned = False
        if unassigned and uid is not None:
            try:
                if hasattr(v, 'assigned_technician_id'):
                    setattr(v, 'assigned_technician_id', int(uid))
                elif email:
                    setattr(v, 'technician', str(email))
            except Exception:
                pass
    except Exception:
        pass

    if _is_assigned_to_visit(v, uid, email) or (uid is None and email is None):
        now = datetime.now()
        notes = []
        if hasattr(v, 'status'):
            v.status = 'Pågående'
        else:
            notes.append("Visit.status field not found; skipped status update")
        if hasattr(v, 'started_at'):
            setattr(v, 'started_at', now)
        else:
            notes.append("Visit.started_at field not found; skipped start timestamp")
        # Set the owner as the user who starts the visit
        if hasattr(v, 'owner_technician_id') and uid is not None:
            try:
                if getattr(v, 'owner_technician_id') in (None, 0):
                    setattr(v, 'owner_technician_id', uid)
            except Exception:
                pass
        db.session.commit()
        obj = v.to_dict()
        if notes:
            obj['warnings'] = notes
        return jsonify(obj)
    # Provide more context in the error for the UI
    who = {'uid': uid, 'email': email}
    assigned = getattr(v, 'assigned_technician_id', None)
    techStr = getattr(v, 'technician', None)
    return jsonify({'error': 'Not allowed to start this visit', 'whoami': who, 'assigned_technician_id': assigned, 'technician': techStr}), 403


@app.route('/api/visits/<int:visit_id>/logs', methods=['GET', 'POST'])
@login_required
def visit_logs(visit_id: int) -> ResponseReturnValue:
    """List or create ServiceLog entries for a visit.

    GET: returns all logs for the visit.
    POST JSON body:
      { "equipment_id": int, "description": str, "hours_worked": float, "log_date": ISO8601? }
    - log_date defaults to now if not provided.
    - Validates that the equipment belongs to the same customer as the visit.
    """
    v = Visit.query.get_or_404(visit_id)
    if request.method == 'GET':
        logs = [s.to_dict() for s in ServiceLog.query.filter(ServiceLog.visit_id == visit_id).order_by(ServiceLog.id.asc()).all()]
        return jsonify(logs)

    # Collaboration rule: once a visit is Pågående, any technician can add logs.
    # Otherwise, only the assigned technician can add logs.
    uid, email = _get_request_user()
    if hasattr(v, 'status'):
        st = getattr(v, 'status')
        if st != 'Pågående' and not _is_assigned_to_visit(v, uid, email):
            return jsonify({'error': 'Not allowed to add logs before start'}), 403
    else:
        # Without status field, fall back to assignment check
        if not _is_assigned_to_visit(v, uid, email) and uid is not None:
            return jsonify({'error': 'Not allowed to add logs'}), 403

    data = request.get_json() or {}
    equipment_id = data.get('equipment_id')
    if not equipment_id:
        return jsonify({'error': 'equipment_id is required'}), 400
    eq = Equipment.query.get_or_404(equipment_id)
    if eq.customer_id != v.customer_id:
        return jsonify({'error': 'equipment does not belong to this visit\'s customer'}), 400

    desc = data.get('description') or ''
    hours = data.get('hours_worked')
    log_date = data.get('log_date')
    dt = None
    if log_date:
        try:
            dt = datetime.fromisoformat(log_date)
        except Exception:
            return jsonify({'error': 'log_date must be ISO 8601 datetime'}), 400
    if dt is None:
        dt = datetime.now()

    # Create service log
    s = ServiceLog()
    s.visit_id = visit_id
    s.equipment_id = equipment_id
    s.description = desc
    s.hours_worked = hours
    s.log_date = dt
    db.session.add(s)

    # Optional: bait usage details and materials
    # Accept both English-like and Norwegian keys
    def _get(dct, *keys):
        for k in keys:
            if k in dct:
                return dct.get(k)
        return None

    materials_used_payload = data.get('materials_used')
    # Structured bait sections
    poison = data.get('poison_bait') or {}
    nonpoison = data.get('nonpoison_bait') or {}

    # Helper to add a material usage safely
    def add_usage(material_id, amount):
        try:
            if material_id is None:
                return
            mid = int(material_id)
            amt = None if amount is None else float(amount)
            mu = MaterialUsage()
            # Set FK directly to avoid attribute assignment issues flagged by type checkers
            # Ensure s has an id (flush) so FK is valid
            try:
                db.session.flush()
            except Exception:
                pass
            mu.service_log_id = s.id
            mu.material_id = mid
            mu.amount = amt
            db.session.add(mu)
        except Exception:
            pass

    # If client sent explicit materials_used array, use it
    if isinstance(materials_used_payload, list):
        for item in materials_used_payload:
            add_usage(item.get('material_id'), item.get('amount'))

    # Parse poison bait section
    pb_mat = _get(poison, 'used_material_id', 'benyttet_giftaate_id', 'benyttet_giftåte_id')
    pb_amt = _get(poison, 'refilled_grams', 'giftaate_etterfylt', 'giftåte_etterfylt')
    if pb_mat is not None or pb_amt is not None:
        add_usage(pb_mat, pb_amt)

    # Parse non-poison bait section
    npb_mat = _get(nonpoison, 'used_material_id', 'benyttet_giftfritt_aate_id', 'benyttet_giftfritt_åte_id')
    npb_amt = _get(nonpoison, 'refilled_grams', 'giftfritt_etterfylt')
    if npb_mat is not None or npb_amt is not None:
        add_usage(npb_mat, npb_amt)

    db.session.commit()
    return jsonify(s.to_dict()), 201


@app.route('/api/materials', methods=['GET'])
@login_required
def list_materials() -> ResponseReturnValue:
    """List materials with optional filtering by material_type.

    Query params:
      - type: filter by material_type value (e.g., 'Giftåte', 'Giftfritt Åte')
      - q: optional case-insensitive substring filter on name
    """
    q = Material.query
    mtype = request.args.get('type')
    if mtype:
        q = q.filter(Material.material_type == mtype)
    name_q = request.args.get('q')
    if name_q:
        like = f"%{name_q}%"
        q = q.filter(Material.name.ilike(like))
    items = q.order_by(Material.name.asc()).all()
    return jsonify([m.to_dict() for m in items])


@app.route('/api/visits/<int:visit_id>/complete', methods=['POST'])
@login_required
def complete_visit(visit_id: int) -> ResponseReturnValue:
    """Complete a visit after all equipment is checked.

    JSON body may include checklist flags and a summary. We try to map them to the Visit model if fields exist.
      {
        "summary": str,
        "checklist": {
          "sjekk_advarselskilt": bool,
          "...": bool
        }
      }
    - Sets status to 'Fullført' and completed_at when fields exist.
    - If fields are missing in the model, we store summary into Visit.notes (if present) and skip unknown checklist keys.
    """
    v = Visit.query.get_or_404(visit_id)
    uid, email = _get_request_user()
    # Only owner or assigned technician can complete
    if not (_is_owner_of_visit(v, uid) or _is_assigned_to_visit(v, uid, email) or (uid is None and email is None)):
        return jsonify({'error': 'Not allowed to complete this visit'}), 403
    data = request.get_json() or {}
    summary = data.get('summary')
    checklist = data.get('checklist') or {}

    # Update summary on the appropriate field if present
    updated = []
    if summary is not None:
        if hasattr(v, 'oppsummering_notat'):
            setattr(v, 'oppsummering_notat', summary)
            updated.append('oppsummering_notat')
        elif hasattr(v, 'notes'):
            setattr(v, 'notes', summary)
            updated.append('notes')

    # Update checklist booleans if they exist on Visit
    if isinstance(checklist, dict):
        for key, value in checklist.items():
            if hasattr(v, key):
                try:
                    setattr(v, key, bool(value))
                    updated.append(key)
                except Exception:
                    pass

    # Finalize status/timestamps
    now = datetime.now()
    if hasattr(v, 'status'):
        v.status = 'Fullført'
        updated.append('status')
    if hasattr(v, 'completed_at'):
        setattr(v, 'completed_at', now)
        updated.append('completed_at')

    db.session.commit()
    obj = v.to_dict()
    obj['updated_fields'] = sorted(set(updated))
    return jsonify(obj)

@app.route('/api/customers/<int:customer_id>/fix-geo', methods=['POST'])
def fix_customer_geo(customer_id: int) -> ResponseReturnValue:
    """Manually correct a customer's coordinates.
    Expected JSON: { "latitude": float, "longitude": float }
    Returns the updated customer.
    """
    customer = Customer.query.get_or_404(customer_id)
    data = request.get_json() or {}
    lat = data.get('latitude')
    lng = data.get('longitude')
    # Basic validation to avoid writing nonsense
    if lat is None or lng is None:
        return jsonify({ 'error': 'latitude and longitude are required' }), 400
    try:
        lat = float(lat)
        lng = float(lng)
    except Exception:
        return jsonify({ 'error': 'latitude/longitude must be numbers' }), 400
    if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
        return jsonify({ 'error': 'latitude/longitude out of range' }), 400
    customer.latitude = lat
    customer.longitude = lng
    db.session.commit()
    return jsonify(customer.to_dict())

@app.route('/api/customers/<int:customer_id>', methods=['GET', 'PUT', 'DELETE'])
def handle_customer_by_id(customer_id: int) -> ResponseReturnValue:
    customer = Customer.query.get_or_404(customer_id)

    if request.method == 'GET':
        return jsonify(customer.to_dict())

    elif request.method == 'PUT':
        try:
            data = request.get_json()
            customer.name = data.get('name', customer.name)
            customer.address = data.get('address', customer.address)
            customer.postal_code = data.get('postal_code', customer.postal_code)
            customer.city = data.get('city', customer.city)
            customer.contact_person = data.get('contact_person', customer.contact_person)
            customer.email = data.get('email', customer.email)
            customer.phone = data.get('phone', customer.phone)
            # Allow coordinates to be corrected manually from the UI.
            if 'latitude' in data:
                customer.latitude = data.get('latitude')
            if 'longitude' in data:
                customer.longitude = data.get('longitude')
            db.session.commit()
            return jsonify(customer.to_dict())
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    elif request.method == 'DELETE':
        try:
            db.session.delete(customer)
            db.session.commit()
            return jsonify({'message': 'Customer deleted successfully'}), 200
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

    return jsonify({'error': 'Method not allowed'}), 405


@app.route('/api/customers/<int:customer_id>/detail', methods=['GET'])
def customer_detail(customer_id: int) -> ResponseReturnValue:
    """Return a detailed view of a customer, including equipment with coords, visit history, and service logs.

    Response shape:
      {
        customer: {..., next_visit_date},
        equipment: [Equipment.to_dict()],
        visits: [Visit.to_dict()],  // sorted desc by visit_date
        logs: [ServiceLog.to_dict() & { equipment_name, visit_date }], // sorted desc by log_date
      }
    """
    cust = Customer.query.get_or_404(customer_id)
    eq_items = Equipment.query.filter(Equipment.customer_id == customer_id).all()
    visits = Visit.query.filter(Visit.customer_id == customer_id).order_by(Visit.visit_date.desc()).all()

    # Service logs for this customer's visits (join for efficient filter)
    q_logs = (
        db.session.query(ServiceLog, Visit, Equipment)
        .join(Visit, ServiceLog.visit_id == Visit.id)
        .outerjoin(Equipment, ServiceLog.equipment_id == Equipment.id)
        .filter(Visit.customer_id == customer_id)
        # MariaDB/MySQL does not support the SQL 'NULLS LAST' clause; avoid using it
        .order_by(ServiceLog.log_date.desc(), ServiceLog.id.desc())
    )
    logs = []
    for s, v, e in q_logs.all():
        obj = s.to_dict()
        try:
            obj['visit_date'] = v.visit_date.isoformat() if getattr(v, 'visit_date', None) else None
        except Exception:
            obj['visit_date'] = None
        try:
            obj['equipment_name'] = getattr(e, 'name', None)
        except Exception:
            obj['equipment_name'] = None
        logs.append(obj)

    # Compute next planned/expected visit
    try:
        nxt = _compute_next_visit(cust)
        customer_obj = cust.to_dict()
        customer_obj['next_visit_date'] = nxt.isoformat() if nxt else None
    except Exception:
        customer_obj = cust.to_dict()

    return jsonify({
        'customer': customer_obj,
        'equipment': [e.to_dict() for e in eq_items],
        'visits': [v.to_dict() for v in visits],
        'logs': logs,
    })

if __name__ == '__main__':
    # Run on all interfaces so it can be reached from your phone on the same network.
    # Note: Windows Firewall may prompt the first time; allow access for private networks.
    app.run(host='0.0.0.0', port=5000, debug=True)
