from backend.app import app, db
from sqlalchemy import inspect, text
import json

with app.app_context():
    insp = inspect(db.engine)
    tables = insp.get_table_names()
    print(json.dumps({"tables": tables}, indent=2))
    for t in ["customers","employees","visits","service_logs","feedback"]:
        if t in tables:
            try:
                c = db.session.execute(text(f"SELECT COUNT(*) as c FROM `{t}`")).scalar()
            except Exception as e:
                c = str(e)
            print(f"{t}: {c}")
        else:
            print(f"{t}: MISSING")
