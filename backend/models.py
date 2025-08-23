from backend.extensions import db

class Customer(db.Model):
    __tablename__ = 'customers'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    postal_code = db.Column(db.String(20))
    city = db.Column(db.String(100))
    contact_person = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    visits_per_year = db.Column(db.Integer)
    start_date = db.Column(db.Date)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    # Relationships
    visits = db.relationship("Visit", back_populates="customer", cascade="all, delete-orphan")
    equipment = db.relationship("Equipment", back_populates="customer", cascade="all, delete-orphan")
    route_choices = db.relationship("RouteChoice", back_populates="customer", cascade="all, delete-orphan")
    daily_tasks = db.relationship("DailyTask", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Customer {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'address': self.address,
            'postal_code': self.postal_code,
            'city': self.city,
            'contact_person': self.contact_person,
            'phone': self.phone,
            'email': self.email,
            'visits_per_year': self.visits_per_year,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'latitude': self.latitude,
            'longitude': self.longitude,
        }

class Visit(db.Model):
    __tablename__ = 'visits'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, index=True)
    visit_date = db.Column(db.DateTime, nullable=False)
    technician = db.Column(db.String(100))
    notes = db.Column(db.Text)

    # Workflow fields
    status = db.Column(db.String(20), index=True, default='Planlagt')  # Planlagt, Pågående, Fullført
    assigned_technician_id = db.Column(db.Integer, index=True)
    owner_technician_id = db.Column(db.Integer, index=True)  # who pressed Start
    started_at = db.Column(db.DateTime)
    completed_at = db.Column(db.DateTime)

    # Sjekkliste + oppsummering
    oppsummering_notat = db.Column(db.Text)
    sjekk_advarselskilt = db.Column(db.Boolean, default=False)
    sjekk_agnstasjoner = db.Column(db.Boolean, default=False)
    sjekk_inngangspunkter = db.Column(db.Boolean, default=False)
    sjekk_fellefangst = db.Column(db.Boolean, default=False)

    # Relationships
    customer = db.relationship("Customer", back_populates="visits")
    service_logs = db.relationship("ServiceLog", back_populates="visit", cascade="all, delete-orphan")
    photos = db.relationship("Photo", back_populates="visit", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Visit {self.id} on {self.visit_date}>"

    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'visit_date': self.visit_date.isoformat() if self.visit_date else None,
            'technician': self.technician,
            'notes': self.notes,
            'status': self.status,
            'assigned_technician_id': self.assigned_technician_id,
            'owner_technician_id': self.owner_technician_id,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'oppsummering_notat': self.oppsummering_notat,
            'sjekk_advarselskilt': self.sjekk_advarselskilt,
            'sjekk_agnstasjoner': self.sjekk_agnstasjoner,
            'sjekk_inngangspunkter': self.sjekk_inngangspunkter,
            'sjekk_fellefangst': self.sjekk_fellefangst,
        }

class Equipment(db.Model):
    __tablename__ = 'equipment'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(100))
    serial_number = db.Column(db.String(100))
    installed_at = db.Column(db.Date)
    notes = db.Column(db.Text)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)

    # Relationships
    customer = db.relationship("Customer", back_populates="equipment")
    service_logs = db.relationship("ServiceLog", back_populates="equipment_item", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Equipment {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'name': self.name,
            'type': self.type,
            'serial_number': self.serial_number,
            'installed_at': self.installed_at.isoformat() if self.installed_at else None,
            'notes': self.notes,
            'latitude': self.latitude,
            'longitude': self.longitude,
        }

class ServiceLog(db.Model):
    __tablename__ = 'service_logs'
    id = db.Column(db.Integer, primary_key=True)
    visit_id = db.Column(db.Integer, db.ForeignKey('visits.id'), nullable=False, index=True)
    equipment_id = db.Column(db.Integer, db.ForeignKey('equipment.id'), nullable=False, index=True)
    log_date = db.Column(db.DateTime)
    description = db.Column(db.Text, nullable=False)
    hours_worked = db.Column(db.Float)

    # Relationships
    visit = db.relationship("Visit", back_populates="service_logs")
    equipment_item = db.relationship("Equipment", back_populates="service_logs")
    materials_used = db.relationship("MaterialUsage", back_populates="service_log", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ServiceLog {self.id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'visit_id': self.visit_id,
            'equipment_id': self.equipment_id,
            'log_date': self.log_date.isoformat() if self.log_date else None,
            'description': self.description,
            'hours_worked': self.hours_worked,
        }


class DailyTask(db.Model):
    __tablename__ = 'daily_tasks'
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False, index=True)
    task_date = db.Column(db.Date, nullable=False, index=True)
    technician_email = db.Column(db.String(100))

    customer = db.relationship("Customer", back_populates="daily_tasks")

    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'task_date': self.task_date.isoformat() if self.task_date else None,
            'technician_email': self.technician_email,
        }

class Material(db.Model):
    __tablename__ = 'materials'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    material_type = db.Column(db.String(100))
    active_ingredient = db.Column(db.String(100))
    standard_amount = db.Column(db.Float)

    usages = db.relationship("MaterialUsage", back_populates="material", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Material {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'material_type': self.material_type,
            'active_ingredient': self.active_ingredient,
            'standard_amount': self.standard_amount,
        }


class MaterialUsage(db.Model):
    __tablename__ = 'material_usage'
    id = db.Column(db.Integer, primary_key=True)
    service_log_id = db.Column(db.Integer, db.ForeignKey('service_logs.id'), nullable=False, index=True)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False, index=True)
    amount = db.Column(db.Float)

    service_log = db.relationship("ServiceLog", back_populates="materials_used")
    material = db.relationship("Material", back_populates="usages")

    def __repr__(self):
        return f"<MaterialUsage {self.id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'service_log_id': self.service_log_id,
            'material_id': self.material_id,
            'amount': self.amount,
        }


class Employee(db.Model):
    __tablename__ = 'employees'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True)
    role = db.Column(db.String(50))

    def __repr__(self):
        return f"<Employee {self.name}>"

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
        }


class RouteChoice(db.Model):
    __tablename__ = 'route_choices'
    id = db.Column(db.Integer, primary_key=True)
    technician_email = db.Column(db.String(100))
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=True, index=True)
    selected_date = db.Column(db.Date)

    customer = db.relationship("Customer", back_populates="route_choices")

    def __repr__(self):
        return f"<RouteChoice {self.id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'technician_email': self.technician_email,
            'customer_id': self.customer_id,
            'selected_date': self.selected_date.isoformat() if self.selected_date else None,
        }


class Photo(db.Model):
    __tablename__ = 'photos'
    id = db.Column(db.Integer, primary_key=True)
    visit_id = db.Column(db.Integer, db.ForeignKey('visits.id'), nullable=True, index=True)
    image_url = db.Column(db.Text)
    description = db.Column(db.Text)

    visit = db.relationship("Visit", back_populates="photos")

    def __repr__(self):
        return f"<Photo {self.id}>"

    def to_dict(self):
        return {
            'id': self.id,
            'visit_id': self.visit_id,
            'image_url': self.image_url,
            'description': self.description,
        }
