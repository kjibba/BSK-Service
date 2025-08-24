from backend.app import app, db
from sqlalchemy import text
with app.app_context():
    try:
        r = db.session.execute(text('SELECT version_num FROM alembic_version')).scalar()
    except Exception as e:
        r = f'ERROR: {e}'
    print('alembic_version:', r)
