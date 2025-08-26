## Copilot-instruksjoner for BSK Service App (kort, praktisk)

Denne repoen har React/Vite frontend og en ny Node.js/Express/TypeORM backend (folder `backend-nodejs`). En eldre Flask-backend ligger fortsatt i `backend/` for referanse, men aktiv utvikling skjer på Node.

1) Arkitektur og nøkkelfiler
- Backend (Node): `backend-nodejs/src/app.ts` (Express-setup), `src/data-source.ts` (AppDataSource/DB), `src/entities/*.ts` (TypeORM-modeller med toDict()), `src/routes/*.ts` (API-endepunkter).
- Frontend (Vite): `frontend/src/components/MapView.jsx`, `CustomerDetail.jsx`, `src/api.js`, `vite.config.js` (proxy /api → :8000).
- Kart-UX: Leaflet-popups bygges som HTML-strenger og bindes via `popupopen`. Ikke endre klassenavn som `.btn-save-new`, `.new-eq-type` osv.

2) Kjør lokalt (PowerShell)
- Backend: `cd backend-nodejs; npm install; npm run build; npm start` (prod) eller `npm run dev` (hot-reload via tsx). Server lytter på http://localhost:8000. Helse: GET `/health`.
- Frontend: `cd frontend; npm install; npm run dev` (Vite på 5175). Proxy til backend er satt i `vite.config.js`.
- Port-8000 trøbbel? Finn/kill prosess: `Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess | Stop-Process -Id <pid> -Force`.

3) API- og datamodell-konvensjoner
- Entiteter eksponerer `toDict()` for API-svar. Datoer formateres i EU-format i flere entiteter (se `utils/dateUtils.ts`). Kart-endepunktet returnerer i tillegg `next_visit_date` som ISO og `status` for fargekoding.
- Valider alltid heltalls-IDer i routes før DB-kall (returner 400 ved ugyldig input); verifiser at relaterte rader finnes.
- Filopplasting og bilder serviceres under `/static` (map til `backend-nodejs/static/`).

4) Viktige endepunkter og mønstre
- Kartdata: `GET /api/map/customers` → `{ id, name, latitude, longitude, next_visit_date, status }`. Frontend bruker `status` direkte til markørfarge.
- Ansatte (for tekniker-valg i popups): `GET /api/employees`, `PUT /api/employees/:id`.
- Besøk (visits): CRUD + arbeidsflyt finnes i `src/routes/visits.ts`:
	- `GET /api/visits/my_missions`, `GET /api/visits/:id/detail`, `POST /api/visits/:id/start`,
		`GET/POST /api/visits/:id/logs`, `POST /api/visits/:id/complete`, `POST /api/visits/:id/assign`.
	- Kontorhjelpere: `POST /api/office/visits`, `POST /api/office/visits/:id/assign`.
- Frontend-klient: legg nye helpers i `frontend/src/api.js` og gjenbruk derfra i komponenter.

5) TypeORM og migrasjoner (Node)
- Bruk `npm run migration:generate -- <Name>` og `npm run migration:run`. Hold entiteter og migrasjoner i sync i samme PR.
- Gjenbruk `AppDataSource` fra `src/data-source.ts`; ikke opprett nye DataSource-instanser.

6) Eksempel på ny rute (Node)
- Opprett `backend-nodejs/src/routes/myFeature.ts`, eksporter Express-router som returnerer `toDict()`-objekter.
- Registrer i `app.ts` via `app.use('/api/my-feature', myFeatureRoutes)`.
- Legg til klient i `frontend/src/api.js` og kall fra komponent.

7) Frontend-spesifikke mønstre
- Ikke formatter om popup-HTML: event-bindingene forutsetter spesifikke klassenavn (`.btn-save-new`, `.nv-save`, etc.).
- Ved brukerinput for `datetime-local`, normaliser med `new Date(value).toISOString()` (se `MapView.jsx`/`CustomerDetail.jsx`).

8) Feilsøking raskt
- Sjekk at backend faktisk lytter: `netstat -ano | findstr :8000` (eller `Get-NetTCPConnection`).
- Helse-URL: `GET http://localhost:8000/health`.
- Frontend → backend: verifiser proxy i `vite.config.js` (5175 → 8000).

Gi beskjed hvis noe er uklart eller mangler (f.eks. mer om auth, datoformat, eller migrasjonsflyt), så utvider vi denne siden.

9) Pedagogiske hensyn og oppdatert info
- Bruker er norsk. Bruk norsk språk.
- Forklar endringer kort og enkelt i PR-beskrivelser/commits: hva, hvorfor, hvor i koden, hvordan teste.
- Unngå fagsjargong; legg inn små, relevante kommentarer i ny kode (kun der det hjelper).
- Når du er i tvil, hent siste dokumentasjon online (offisielle kilder først) og lenk kort i PR:
	- TypeORM (v0.3+), Express, React, Vite, Leaflet, mysql2.
	- Sjekk breaking changes/changelogs ved API-bruk som virker ukjent.
- Bruk eksempler som kan kjøres lokalt (PowerShell-vennlige kommandoer) og referer til nøkkelfiler i dette repoet.
