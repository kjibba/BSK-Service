# BSK Service App

Internal service tool for Bergen Skadedyrkontroll: customers, equipment, visits and service logs.

This repository contains a Flask backend (API + migrations) and a React frontend (Vite). The project is configured for local development with a Python virtual environment and a Node dev server.

## Quick start (development)

Prerequisites
- Python 3.11+ and pip
- Node.js 18+ and npm
- MySQL/MariaDB (local or remote) and a database created for the app

1) Backend: create and activate a virtual environment

```powershell
cd F:\dev\BSK_Service_App
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt  # if you have one, else install Flask, SQLAlchemy, Alembic, PyMySQL, flask-login, flask-migrate, flask-cors
```

2) Configure database
- Edit `backend/app.py` or set environment variables so `SQLALCHEMY_DATABASE_URI` points to your DB. Example:

```
mysql+pymysql://bsk_user:password@localhost/bsk_service_db
```

3) Apply migrations

```powershell
cd F:\dev\BSK_Service_App
.\.venv\Scripts\activate
# Ensure FLASK_APP is set if needed, then
flask db upgrade
```

4) Run backend

```powershell
cd F:\dev\BSK_Service_App
.\.venv\Scripts\activate
python -m backend.app
# Backend runs on http://0.0.0.0:5000 by default
```

5) Frontend (dev)

```powershell
cd F:\dev\BSK_Service_App\frontend
npm install
npm run dev -- --host
# Vite will serve on http://localhost:5173 (or try another port if in use)
```

Open the frontend URL in your browser (Vite output shows the exact port). The frontend proxies `/api` to the backend during development.

## Useful scripts
- `backend/scripts/promote_manager.py <email> [name]` — create or promote an employee to role `manager`.
- `backend/scripts/count_employees.py` — prints employees from the DB (debugging)

## Auth and sessions
- The app uses a simple email-based login (no password) for local/dev convenience. Use the login UI in the frontend.
- In production you should replace this with a proper auth/SSO and secure cookies.

## Notes & troubleshooting
- If the frontend can't talk to the backend, verify CORS origins in `backend/app.py` and the Vite port (5173/5174).
- If you see `TypeError: _Loader() takes no arguments` or other Flask-Login errors, restart the backend — the codebase includes a working `user_loader` implementation.
- If employees list is empty, ensure you are logged in and your session cookies are accepted for `localhost:5173` and `localhost:5000`.

## Git
- Repo initialized locally; push branches and create Pull Requests on GitHub. Avoid committing secrets (add them to .gitignore).

## License
This project is internal; add a license file if you will publish.

---
If you want, I can also create a minimal `requirements.txt` and a `README` section tailored to production deployment.
