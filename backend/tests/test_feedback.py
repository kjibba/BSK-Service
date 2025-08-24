import json
import pytest
from backend.app import app, db
from backend.models import Employee, Feedback
from datetime import datetime


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Use an in-memory sqlite DB for tests
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    with app.app_context():
        # db is already initialized by the application; just create tables for the test DB
        db.create_all()
        # create a manager user
        mgr = Employee(name='Manager', email='manager@example.com', role='manager')
        emp = Employee(name='Tech', email='tech@example.com', role='technician')
        db.session.add_all([mgr, emp])
        db.session.commit()
    with app.test_client() as client:
        yield client
    # teardown
    with app.app_context():
        db.session.remove()
        db.drop_all()


def login_as(client, email):
    return client.post('/api/auth/login', json={'email': email})


def test_create_feedback_anonymous(client):
    # anonymous POST should succeed and return id
    rv = client.post('/api/feedback', json={'text': 'Test feedback', 'context': {'page': '/x'}})
    assert rv.status_code == 201
    data = rv.get_json()
    assert data.get('ok') is True
    assert 'id' in data


def test_manager_list_and_update(client):
    # create a feedback entry
    rv = client.post('/api/feedback', json={'text': 'Please fix', 'context': {'page': '/fix'}})
    assert rv.status_code == 201
    fid = rv.get_json().get('id')

    # try to GET list as anonymous -> should 401
    rv = client.get('/api/feedback')
    assert rv.status_code == 401

    # login as manager
    rv = login_as(client, 'manager@example.com')
    assert rv.status_code == 200

    # list should return items
    rv = client.get('/api/feedback')
    assert rv.status_code == 200
    data = rv.get_json()
    assert 'items' in data
    assert any(i['id'] == fid for i in data['items'])

    # get detail
    rv = client.get(f'/api/feedback/{fid}')
    assert rv.status_code == 200
    item = rv.get_json()
    assert item['id'] == fid

    # update status
    rv = client.put(f'/api/feedback/{fid}', json={'status': 'in_progress', 'handler_note': 'Taking a look'})
    assert rv.status_code == 200
    item2 = rv.get_json()
    assert item2['status'] == 'in_progress'
    assert item2['handler_note'] == 'Taking a look'
