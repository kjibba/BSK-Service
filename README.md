# BSK Service App

Internverktøy for Bergen Skadedyrkontroll: kunder, utstyr, besøk og servicelogger.

Aktiv backend er Node.js/Express/TypeORM i `backend-nodejs/`. Frontend er React/Vite i `frontend/`.
Den gamle Flask-backenden i `backend/` er arkivert for referanse og brukes ikke i drift.

## Hurtigstart (utvikling)

Forutsetninger
- Node.js 18+ og npm
- MariaDB/MySQL tilgjengelig og database opprettet

1) Backend (Node)

```powershell
cd F:\dev\BSK_Service_App\backend-nodejs
npm install
copy .env.example .env  # juster verdier ved behov
npm run dev
# Lytter på http://localhost:8000
```

2) Frontend (Vite)

```powershell
cd F:\dev\BSK_Service_App\frontend
npm install
npm run dev
# Vite på http://localhost:5175 (proxy til backend på /api)
```

Åpne frontend-URL i nettleser. `/api` proxes til backend.

## Docker Compose (NAS/produksjon)

Bruk `docker-compose.yml` for Nginx (SPA + reverse proxy), Node-backend og MariaDB.

```powershell
cd F:\dev\BSK_Service_App
copy .env.example .env  # sett passord/porter
docker compose up -d --build
```


## Deployment

See docs/WORKFLOWS.md

### Hetzner (Docker)

Prereqs: fresh Ubuntu/Debian host. Script will install Docker + compose.

Steps on server:

1) Run the one-shot deploy script (customize env as needed):

	curl -fsSL https://raw.githubusercontent.com/kjibba/BSK-Service/feature/visit-workflow/scripts/deploy_hetzner.sh -o deploy.sh && \
	chmod +x deploy.sh && \
	sudo HTTP_PORT=80 HTTPS_PORT=443 BRANCH=feature/visit-workflow ./deploy.sh

2) Update `.env` in `/opt/bsk-service` with real secrets and re-run:

	cd /opt/bsk-service
	docker compose up -d --build
	docker compose run --rm backend node dist/run-migrations.js

Services:
- Nginx: :80 (and 443 if configured)
- Backend: internal :8000 (proxied by Nginx)
- DB: internal MariaDB (volume `db_data`)
## Legacy (arkiv)

Mappen `backend/` inneholder en eldre Flask-implementasjon. Den er bevart kun som referanse og vil fjernes i en senere opprydding. Ikke gjør endringer der.

## Copilot-instruksjoner

Se `.github/copilot-instructions.md` for prosjektspesifikke retningslinjer (mappestruktur, API-konvensjoner, datoformat, PowerShell-eksempler, m.m.).
