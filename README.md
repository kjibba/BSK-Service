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

## Lokal Docker (speil av prod)

Kjør stacken lokalt i et miljø som matcher produksjon så tett som mulig:

1) Lag en lokal env-fil

```powershell
cd F:\dev\BSK_Service_App
copy .env.local.example .env.local
# rediger .env.local hvis ønskelig (passord/porter)
```

2) Start Compose med local-override

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up --build
```

Dette gir:
- DB: MariaDB på localhost:3307 (for HeidiSQL)
- Backend: http://localhost:8000
- Frontend (via Nginx): http://localhost:5175

Helse:
- http://localhost:8000/health

Stopp og rydd (inkl. volumer):

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local down -v
```

### Bruke ekstern utviklingsdatabase lokalt (valgfritt)

Ønsker du at lokal backend skal koble seg mot en eksisterende utviklings‑DB (samme som før beta)?

1) Sett disse i `.env.local`:

```dotenv
DB_HOST=host.docker.internal  # eller IP: 192.168.x.y
DB_PORT=3306
DB_USERNAME=<bruker>
DB_PASSWORD=<passord>
DB_DATABASE=<dbnavn>
DB_SYNC=false                 # anbefalt for delt database
```

2) Start stacken som vanlig. Du kan la `db`‑tjenesten være stoppet; backend bruker DB_* variablene og trenger ikke lokal `db`.

Tips: På Windows/macOS fungerer `host.docker.internal`. På Linux, bruk IP‑adressen til vertsmaskinen eller legg inn en rute/alias.

Rask start med override‑fil:

```powershell
copy .env.extdb.example .env.extdb
docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.local.extdb.yml --env-file .env.extdb up -d --build
```


## Legacy (arkiv)

Mappen `backend/` inneholder en eldre Flask-implementasjon. Den er bevart kun som referanse og vil fjernes i en senere opprydding. Ikke gjør endringer der.

## Copilot-instruksjoner

Se `.github/copilot-instructions.md` for prosjektspesifikke retningslinjer (mappestruktur, API-konvensjoner, datoformat, PowerShell-eksempler, m.m.).
