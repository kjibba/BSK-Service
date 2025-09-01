# BSK Service App

Internverktøy for Bergen Skadedyrkontroll: kunder, utstyr, besøk og servicelogger.

Aktiv backend er Node.js/Express/TypeORM i `backend-nodejs/`. Frontend er React/Vite i `frontend/`.
Den gamle Flask-backenden i `backend/` er arkivert for referanse og brukes ikke i drift.

## Arbeidsdokument (UX/UI og deploy)

Se «levende» plan, status og sjekklister i docs/ARBEIDSDOKUMENT.md.

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

Bruk `docker-compose.yml` for Nginx (SPA + reverse proxy) og Node-backend mot ekstern DB.

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
- Nginx: :80 (og 443 hvis konfigurert)
- Backend: intern :8000 (proxes av Nginx)
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
- Frontend (via Nginx): http://localhost

Helse:
- http://localhost:8000/health

Stopp og rydd (inkl. volumer):

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local down -v
```

### Se på mobil i dev (Docker)

Når du kjører lokalt via Docker/Nginx (ikke Vite), er frontenden tilgjengelig på PC‑ens LAN‑IP:

- Sett DB-tilkobling i `.env.extdb` (se `.env.extdb.example`).
- Finn PC‑ens IP (for eksempel 192.168.x.y) og åpne på mobilen: `http://192.168.x.y:5175`.
- PC og mobil må være på samme Wi‑Fi. Eventuell VPN kan blokkere.
- Windows-brannmur: Tillat innkommende på TCP 5175 (Privat nett). Du kan lage en regel via Windows‑GUI eller PowerShell.
- Helse: `http://192.168.x.y:5175/health` proxes til backend og bør svare OK.

Merk:
- Frontenden bygges og servres av Nginx. Ingen Vite‑devserver.
- Proxy: `/api` og `/static` rutes til backend på `http://backend:8000` inne i nettverket.

## Alternativ: Lokal Docker med hot‑reload (Vite + tsx)

Ønsker du direkte oppdatering ved filendringer uten å bygge images på nytt, bruk Vite-devserver og tsx i containere.

Start:

```powershell
cd F:\dev\BSK_Service_App
docker compose -f docker-compose.yml -f docker-compose.local.vite.yml --env-file .env.local up
```

Eller bruk hjelpeskript (Windows PowerShell):

```powershell
cd F:\dev\BSK_Service_App
# Start i bakgrunnen
.\scripts\dev_hotreload.ps1 up -Detached
# Se logger: .\scripts\dev_hotreload.ps1 logs
# Stopp:     .\scripts\dev_hotreload.ps1 down
```

Hvis du IKKE bruker hot‑reload og kjører Nginx‑dev (bygget SPA), rebuild slik:

```powershell
cd F:\dev\BSK_Service_App
docker compose --env-file .env.extdb up -d --build
# eller bruk skript: .\scripts\dev_rebuild_spa.ps1
```

Dette gir:
- Frontend (Vite) på http://localhost:5175 (eksponert til LAN)
- Backend (tsx watch) på http://localhost:8000
- DB: MariaDB på localhost:3307 (om `db` er aktiv i base compose)

Mobiltilgang: bruk http://<PC-IP>:5175

Merk:
- Denne modusen hopper over Nginx (med mindre du eksplisitt aktiverer profilen `spa`).
- Frontend-proxy til backend styres av `vite.config.js` (proxy til :8000).
- Beste valg for daglig utvikling; endringer blir synlige uten rebuild.

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

## Database: backup og restore (Docker/MariaDB)

- Backup (Linux/macOS bash): `./scripts/db_backup.sh` (skriver til `./db_backups/backup_*.sql.gz`)
- Restore (Linux/macOS bash): `./scripts/db_restore.sh <dump.sql|dump.sql.gz>`
- Restore (Windows PowerShell):

```powershell
cd F:\dev\BSK_Service_App
# Start stack (db må kjøre)
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d db
# Importer dump
./scripts/db_restore.ps1 -Path .\db_backups\backup_20250823T182718Z.sql.gz  # eksempel
# Kjør migrasjoner (Node backend) etter restore
docker compose run --rm backend node dist/run-migrations.js
```

Tips:
- Ta backup før du restore: behold en kopi.
- For ekstern dev‑DB, bruk `DB_HOST=host.docker.internal` i `.env.local` og importer via klient (HeidiSQL) hvis ønskelig.
 - Se også docs/DB_RESTORE_TIPS.md for rettigheter og manuell kolonne‑fix etter restore.
