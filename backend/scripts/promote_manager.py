#!/usr/bin/env python3
"""Promote or create an employee with a manager role.

Usage: run from repository root with the project's Python interpreter.
"""
import sys
from pathlib import Path

# Ensure package imports work when script is executed directly
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from backend.app import app
from backend.extensions import db
from backend.models import Employee
from typing import Optional

def promote(email: str, name: Optional[str] = None):
    with app.app_context():
        emp = Employee.query.filter(Employee.email == email).first()
        if not emp:
            emp = Employee()
            emp.email = email
            emp.name = name or (email.split('@')[0])
            emp.role = 'manager'
            db.session.add(emp)
            db.session.commit()
            print(f"Created employee {emp.id} {emp.email} with role=manager")
            return emp
        else:
            emp.role = 'manager'
            if name:
                emp.name = name
            db.session.commit()
            print(f"Updated employee {emp.id} {emp.email} -> role=manager")
            return emp

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: promote_manager.py email [name]")
        sys.exit(2)
    email = sys.argv[1].strip().lower()
    name = sys.argv[2] if len(sys.argv) > 2 else None
    promote(email, name)
