from backend.app import app
from backend.extensions import db
from backend.models import Employee

with app.app_context():
    cnt = db.session.query(Employee).count()
    print('employees:', cnt)
    for e in db.session.query(Employee).order_by(Employee.id.asc()).all():
        print(e.id, e.email, e.role)
