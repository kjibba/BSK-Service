# Copilot instructions for BSK Service App

This repository contains a Flask backend and a React + Vite frontend focused on a map-first equipment management UX. The goal of this guide is to give an AI coding agent the exact, actionable knowledge it needs to be productive immediately.

Overview
- Backend: Flask + SQLAlchemy in `backend/` (entry `backend/app.py`). DB migrations live in `migrations/versions/` (Alembic via Flask-Migrate).
- Frontend: React + Vite in `frontend/`. Key UI lives in `frontend/src/components/CustomerDetail.jsx` (map + popup-driven flows) and `MapView.jsx`. API client: `frontend/src/api.js`.
- DB: MySQL/MariaDB (configured in `backend/app.py`). Equipment uses `equipment_type_id` + `properties` (JSON) for typed fields.

Quick dev commands (PowerShell)
- Start backend (dev):
  & .venv/Scripts/Activate.ps1; cd backend; $env:PYTHONPATH='F:/dev/BSK_Service_App'; python app.py
- Run migrations (from backend):
  & .venv/Scripts/Activate.ps1; cd backend; $env:FLASK_APP='app.py'; $env:PYTHONPATH='F:/dev/BSK_Service_App'; python -m flask db upgrade -d ../migrations
- Start frontend (Vite):
  cd frontend; npm install; npm run dev  # Vite will choose a free port if 5173 is busy

Project-specific conventions
- Map-first UX: equipment CRUD is popup-driven inside Leaflet popups. `CustomerDetail.jsx` constructs popup HTML strings and binds event handlers inside `popupopen` handlers. When modifying these flows, preserve exact classnames used by JS (e.g. `.btn-save-new`, `.new-eq-type`).
- API: `frontend/src/api.js` mirrors backend endpoints. Add client helpers there when adding endpoints.
- Equipment typing: types are modeled in `backend/models.py` as `EquipmentType` and stored in `equipment_types`; equipment rows use `properties` (JSON) for per-instance data.
- Scripts: utility/seed scripts live in `backend/scripts/` and run under Flask app context (import `backend.app`). Run them from the `backend` folder with `python scripts/<script>.py`.

Pedagogical rules (project root guidance merged)
- Prefer short, clear explanations in code and PR comments. When adding code, include a brief comment explaining what it does and why.
- Keep examples short and concrete. If you add an API route, include a minimal `curl` or Flask `test_client` example.
- Follow PEP8 for Python. Use descriptive names and break up long functions.
- Use package imports (e.g. `backend.extensions`, `backend.models`) to avoid import issues. Reuse the `db` instance from `backend/extensions.py` (do not create new instances).

Migrations & DB workflow
- When adding models/fields:
  1) Add/modify `backend/models.py`.
  2) Generate migration: `flask db migrate -m "desc"` (from backend, ensure FLASK_APP & PYTHONPATH set).
  3) Inspect `migrations/versions/` and, if multiple heads exist, run `flask db heads` and merge with `flask db merge <rev1> <rev2>`.
  4) Apply: `flask db upgrade -d ../migrations`.
- Commit migration files into `migrations/versions/` with the model change.

Common pitfalls & tips
- Alembic multiple heads: prefer creating a merge revision and ensuring `down_revision` matches the merged parent.
- Popup DOM edits: `CustomerDetail.jsx` uses fragile string-HTML for popups — avoid reformatting the HTML strings when only adding handlers; keep classnames stable.
- Google maps mutant loads asynchronously — code initializes layers either on script load or if the script was already present; call `map.invalidateSize(true)` after switching base layers.
- Images: placement photos are saved to `backend/static/uploads/` and served via `/static/uploads/<file>` in dev; production must use validated uploads and a proper storage backend.

How to add an API endpoint (concrete)
1. Create a blueprint in `backend/routes/` following `equipment_types.py` pattern. Return `jsonify(model.to_dict())`.
2. Add client helpers in `frontend/src/api.js` (list/create/update/delete).
3. Update UI components (prefer `toast.push` for error/success feedback). Test manually via the frontend or `flask test_client` in small unit examples.

Developer ergonomics
- Terminal: PowerShell. Use `;` to chain commands and `&` to run scripts from the venv activation.
- Linting: run `npm run lint` or `npx eslint ...` for frontend; fix ESLint warnings where possible. Keep changes minimal when editing `CustomerDetail.jsx` because it's large and fragile.
- Git: commit migrations, seeds, and code together when adding model changes. Add short explanatory commit messages.

Files to read first
- `backend/app.py`, `backend/models.py`, `backend/routes/equipment.py`, `backend/routes/equipment_types.py`, `frontend/src/components/CustomerDetail.jsx`, `frontend/src/api.js`.

If you need more
- Ask for a focused codewalk of any file (I can produce a short summary of hot spots and safe edit points).
- If you want, I can insert small, well-documented examples into any file (route + client + small UI hook) and run quick dev validations.

---
If anything here is unclear or you want translation/extra Norwegian guidance, tell me which section to expand.
Hold all kommunikasjon med bruker på norsk
