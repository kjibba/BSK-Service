import os
import time
from urllib.parse import urlencode
import requests
from flask import Flask

from backend.extensions import db
from backend.models import Customer


def create_app():
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = 'mysql+pymysql://bsk_user:et_sikkert_passord@localhost/bsk_service_db'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app


def build_query(customer: Customer) -> str:
    parts = [p for p in [customer.address, customer.postal_code, customer.city] if p]
    return ", ".join(parts)


def geocode(query: str, user_agent: str) -> tuple[float | None, float | None]:
    base = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': query,
        'format': 'json',
        'addressdetails': 0,
        'limit': 1,
    }
    headers = { 'User-Agent': user_agent }
    r = requests.get(base, params=params, headers=headers, timeout=15)
    if r.status_code != 200:
        return None, None
    data = r.json()
    if not data:
        return None, None
    try:
        lat = float(data[0]['lat'])
        lon = float(data[0]['lon'])
        return lat, lon
    except Exception:
        return None, None


def main():
    user_agent = os.environ.get('GEOCODER_USER_AGENT', 'BSK-Service-App/1.0 (contact: admin@localhost)')
    delay = float(os.environ.get('GEOCODER_DELAY_SEC', '1.2'))  # be nice to the service
    batch = int(os.environ.get('GEOCODER_BATCH', '100'))

    app = create_app()
    with app.app_context():
        # Find customers missing coordinates
        missing = Customer.query.filter((Customer.latitude.is_(None)) | (Customer.longitude.is_(None))).limit(batch).all()
        print(f"Customers missing coords: {len(missing)} (processing up to {batch})")
        updated = 0
        for c in missing:
            q = build_query(c)
            if not q:
                continue
            lat, lon = geocode(q, user_agent)
            if lat is not None and lon is not None:
                c.latitude = lat
                c.longitude = lon
                updated += 1
                print(f"✓ {c.id} {c.name}: {lat}, {lon}")
                # Commit in small chunks to avoid large transactions
                if updated % 10 == 0:
                    db.session.commit()
            else:
                print(f"- No match for {c.id} {c.name} [{q}]")
            time.sleep(delay)
        db.session.commit()
        print(f"Done. Updated {updated} customers with coordinates.")


if __name__ == '__main__':
    main()
