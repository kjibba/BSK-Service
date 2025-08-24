import os
import time
from urllib.parse import urlencode
import re
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


def _norm_postcode(pc: str | None) -> str | None:
    if not pc:
        return None
    s = str(pc).strip()
    # keep only 4 consecutive digits if present
    m = re.search(r"\b(\d{4})\b", s)
    return m.group(1) if m else None


def build_query(customer: Customer) -> str:
    """Build a clean query string:
    - Extract a 4-digit postal code (if any) and avoid duplicates with address
    - Include city when present
    - Append country to constrain search
    """
    address = (customer.address or '').strip()
    city = (customer.city or '').strip()
    pc = _norm_postcode(getattr(customer, 'postal_code', None))
    # If address already contains the same postcode, don't add it again
    addr_has_pc = bool(pc and re.search(rf"\b{re.escape(pc)}\b", address))
    parts: list[str] = []
    if address:
        parts.append(address)
    if pc and not addr_has_pc:
        parts.append(pc)
    if city:
        parts.append(city)
    parts.append('Norge')
    # Deduplicate while preserving order (case-insensitive)
    seen = set()
    uniq: list[str] = []
    for p in parts:
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        uniq.append(p)
    return ", ".join(uniq)


def geocode(query: str, user_agent: str) -> tuple[float | None, float | None]:
    base = 'https://nominatim.openstreetmap.org/search'
    params = {
        'q': query,
        'format': 'json',
        'addressdetails': 0,
        'limit': 1,
    'countrycodes': 'no',
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
        total_updated = 0
        while True:
            missing = (
                Customer.query
                .filter((Customer.latitude.is_(None)) | (Customer.longitude.is_(None)))
                .limit(batch)
                .all()
            )
            if not missing:
                break
            print(f"Customers missing coords: {len(missing)} (processing up to {batch})")
            updated = 0
            for c in missing:
                base_q = build_query(c)
                if not base_q:
                    continue
                lat, lon = geocode(base_q, user_agent)
                # Fallback variants if first try fails
                if lat is None or lon is None:
                    address = (c.address or '').strip()
                    city = (c.city or '').strip()
                    pc = _norm_postcode(getattr(c, 'postal_code', None))
                    candidates = []
                    if address and city:
                        candidates.append(f"{address}, {city}, Norge")
                    if address and pc:
                        candidates.append(f"{address}, {pc}, Norge")
                    if city and pc:
                        candidates.append(f"{pc} {city}, Norge")
                    # Unique candidate strings
                    seen = set()
                    uniq_cands = []
                    for s in candidates:
                        k = s.lower()
                        if k not in seen:
                            seen.add(k)
                            uniq_cands.append(s)
                    for q2 in uniq_cands:
                        lat, lon = geocode(q2, user_agent)
                        if lat is not None and lon is not None:
                            break
                if lat is not None and lon is not None:
                    c.latitude = lat
                    c.longitude = lon
                    updated += 1
                    total_updated += 1
                    print(f"✓ {c.id} {c.name}: {lat}, {lon}")
                    if updated % 10 == 0:
                        db.session.commit()
                else:
                    print(f"- No match for {c.id} {c.name} [{base_q}]")
                time.sleep(delay)
            db.session.commit()
            print(f"Batch updated: {updated}")
            # If fewer than batch were returned, we reached the end; loop continues and will break next round
        print(f"Done. Updated total {total_updated} customers with coordinates.")


if __name__ == '__main__':
    main()
