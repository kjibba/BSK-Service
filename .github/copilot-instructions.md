## Copilot-instruksjoner for BSK Service App

Kort, håndfast guide for AI-agenter som skal jobbe i dette repoet (Flask backend + React/Vite frontend, map-first UX).

1) Rask sjekkliste for endringer
- Forstå avhengigheter: `backend/app.py`, `backend/extensions.py`, `backend/models.py`, `migrations/`.
- Frontend-punkter: `frontend/src/components/CustomerDetail.jsx`, `frontend/src/components/MapView.jsx`, `frontend/src/api.js`.
- Behold `db`-instansen fra `backend/extensions.py` (bruk pakkestier ved imports).

2) Arkitektur (kort)
- Backend: Flask + SQLAlchemy. Entrypunkt: `backend/app.py`. DB-konfig i `app.py`.
- Migrations: Alembic/Flask-Migrate under `migrations/versions/`.
- Frontend: React + Vite. Kart- og CRUD-UX er Leaflet-popup-basert i `CustomerDetail.jsx`/`MapView.jsx`.

3) Hurtigstart (PowerShell)
& .venv/Scripts/Activate.ps1; cd backend; $env:PYTHONPATH='F:/dev/BSK_Service_App'; python app.py
& .venv/Scripts/Activate.ps1; cd backend; $env:FLASK_APP='app.py'; $env:PYTHONPATH='F:/dev/BSK_Service_App'; python -m flask db upgrade -d ../migrations
cd frontend; npm install; npm run dev

4) Viktige mønstre og prosjektkonvensjoner
- Equipment-typing: `EquipmentType` i `backend/models.py`; equipment-rader bruker `properties` (JSON) for per-instance felter.
- Popup-UX: `CustomerDetail.jsx` bygger HTML-strenger for Leaflet-popups og binder events i `popupopen`. Ikke reformater disse HTML-strengene — behold klasse-navn som `.btn-save-new`, `.new-eq-type`.
- API-klient: alle helpers samles i `frontend/src/api.js`. Legg nye klient-funksjoner der for konsistens.
- Scripts i `backend/scripts/` kjøres under Flask-app-kontekst (importer `backend.app` og kjør fra `backend/`).

5) Migrations & DB-arbeidsflyt (konkret)
- Legg til/endre modeller i `backend/models.py`.
- Fra `backend/`: `flask db migrate -m "<desc>"` (sett FLASK_APP og PYTHONPATH som vist over).
- Sjekk `migrations/versions/`; ved flere heads: `flask db heads` og `flask db merge <rev1> <rev2>`.
- Apply: `python -m flask db upgrade -d ../migrations`.

6) Eksempel: Legge til en enkel API-rute
- Opprett blueprint i `backend/routes/` (se `equipment_types.py` for mønster).
- Returner `jsonify(model.to_dict())`.
- Legg til frontend-helper i `frontend/src/api.js` og kall fra komponent.
- Test: bruk Flask `test_client` eller frontend manuelt via Vite.

7) Små, viktige tips
- Bruk pakkestier ved imports (f.eks. `from backend.extensions import db`). Ikke opprett nye `db`-instanser.
- Bilder: dev-server servicerer `backend/static/uploads/` via `/static/uploads/<file>`.
- Git: commit migrations og modeller sammen.
- Når du endrer popup-HTML, begrens endringer til nødvendig DOM — mye bindinger antar spesifikke klasse-navn.

8) Nøkkelfiler å lese først
- `backend/app.py`, `backend/extensions.py`, `backend/models.py`, `backend/routes/equipment.py`, `backend/routes/equipment_types.py`
- `frontend/src/components/CustomerDetail.jsx`, `frontend/src/components/MapView.jsx`, `frontend/src/api.js`

Gi beskjed hvis du vil at jeg skal:
- Lage en kort «how-to» commit-mal for migrasjoner.
- Legge inn en template for nye blueprints + frontend-helper.

Be om avklaring eller område jeg bør utvide.
