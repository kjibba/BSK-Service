import json
from backend.app import app


def run(client, method, url, **kwargs):
    resp = client.open(url, method=method, json=kwargs.get('json'))
    print(f"{method} {url} -> {resp.status_code}")
    try:
        body = resp.get_json(silent=True)
        print(json.dumps(body, indent=2, ensure_ascii=False))
    except Exception:
        print(resp.data[:200])
    return resp


with app.test_client() as client:
    # whoami (unauthenticated)
    run(client, 'GET', '/api/auth/whoami')

    # Login as manager@example.com
    r = run(client, 'POST', '/api/auth/login', json={'email': 'manager@example.com'})
    assert r.status_code == 200, 'Login failed'

    # List customers (basic)
    run(client, 'GET', '/api/customers')

    # Map customers (with computed fields)
    run(client, 'GET', '/api/map/customers')

    # Employees listing (auth required)
    run(client, 'GET', '/api/employees')

    # Materials list
    run(client, 'GET', '/api/materials')

    # Create an ad-hoc visit for first customer
    customers = run(client, 'GET', '/api/customers').get_json()
    if isinstance(customers, list) and customers:
        cid = customers[0]['id']
        from datetime import datetime, timedelta
        when = (datetime.now() + timedelta(days=1)).isoformat()
        run(client, 'POST', '/api/office/visits', json={'customer_id': cid, 'visit_date': when, 'notes': 'Smoke test'})

    # Feedback submission (open)
    run(client, 'POST', '/api/feedback', json={'text': 'Smoke test feedback', 'context': {'where': 'smoke'}, 'diagnostics': {'ok': True}})

    # Feedback list (manager)
    run(client, 'GET', '/api/feedback')
