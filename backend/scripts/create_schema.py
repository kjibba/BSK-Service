"""
Utility to initialize the database schema using SQLAlchemy models.

Usage (PowerShell):
  # Create missing tables only
  python backend/scripts/create_schema.py

  # Drop ALL tables and recreate (destructive reset)
  python backend/scripts/create_schema.py --reset
"""

import argparse
from backend.app import app
from backend.extensions import db

# Ensure all models are imported so metadata is populated
from backend import models  # noqa: F401


def create_all():
    with app.app_context():
        db.create_all()
        print("Created tables (if missing).")


def reset_all():
    with app.app_context():
        # Disable foreign key checks for safe drop order (MySQL)
        try:
            db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=0"))
        except Exception:
            pass
        db.drop_all()
        try:
            db.session.execute(db.text("SET FOREIGN_KEY_CHECKS=1"))
        except Exception:
            pass
        db.create_all()
        print("Dropped and recreated all tables.")


def main():
    parser = argparse.ArgumentParser(description="Create or reset DB schema from SQLAlchemy models")
    parser.add_argument("--reset", action="store_true", help="Drop ALL tables and recreate (destructive)")
    args = parser.parse_args()
    if args.reset:
        reset_all()
    else:
        create_all()


if __name__ == "__main__":
    main()
