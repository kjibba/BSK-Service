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

- Nginx eksponerer porter `${NGINX_HTTP_PORT}`/`${NGINX_HTTPS_PORT}`
- Backend er kun internt tilgjengelig bak Nginx
- Opplastede bilder serviceres fra `/static/uploads`

## Legacy (arkiv)

Mappen `backend/` inneholder en eldre Flask-implementasjon. Den er bevart kun som referanse og vil fjernes i en senere opprydding. Ikke gjør endringer der.

## Copilot-instruksjoner

Se `.github/copilot-instructions.md` for prosjektspesifikke retningslinjer (mappestruktur, API-konvensjoner, datoformat, PowerShell-eksempler, m.m.).
