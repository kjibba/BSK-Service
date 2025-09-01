# Endringslogg

## 2025-08-31 — Endringer (1)
1) Sikker publisering via Nginx auth_request
  - Nginx (prod) låser ned hele appen bak innlogging via `auth_request` mot `/api/auth/check`.
  - Uautorisert trafikk på HTTPS får `login.html` (ny, minimal innloggingsside) i stedet for SPA.
  - `/.well-known/acme-challenge/` (på :80) og `/api/auth/*` og `/health` er unntatt for å muliggjøre innlogging og sertifikatfornyelse.
  - Backend: la til `GET /api/auth/check` (204 når innlogget; 401 ellers) for Nginx integrasjon.
  - Dev: Nginx lokal-konfig beskytter også alt med Basic Auth (konfigureres via `.env.local`).
  
2) Fix: login-loop (mobil/lan)
  - Nginx auth_request videresender nå `Cookie`-header til backend (`/_auth_check`), slik at `express-session` finner `connect.sid`.
  - Uten denne ble alle SPA-ruter sett som uautorisert og brukeren ble sendt tilbake til `login.html` i en loop.
  - Slått av request body i subrequest og lagt til korte timeouts for stabilitet.
  - Backend: CORS tillater nå private LAN-opprinnelser (10.*, 192.168.*, 172.16–31.*) for lokal mobiltesting gjennom Nginx.

3) Nytt: Klient-feillogging og admin-visning
   - Backend: nytt endepunkt `POST /api/meta/client-log` og tabell `client_logs` for å samle feilmeldinger fra frontend.
     - Unntatt fra auth (kun POST) i Express og i Nginx, så vi fanger også pre-login-feil.
     - Lett rate limiting (~120/min/IP) for å hindre spam.
   - Backend (admin): `GET /api/meta/client-log?limit=200` for å liste siste klientfeil (krever JWT + rolle admin/manager).
   - Frontend: sender auto-logg ved `window.onerror`, `unhandledrejection`, feil i `ErrorBoundary`, og i axios-interceptor for HTTP-feil.
   - Frontend (Rapporter): nytt panel "Klientfeil (siste)" i `ReportsAdmin.jsx` for rask triage. Trykk «Oppdater» for å hente.
  
4) Compose
  - Fikset YAML-innrykk for `ports` på `nginx`-tjenesten i `docker-compose.yml` (ga feilen "Sequence item without - indicator").
  - Eksponerer nå også `5175:80` for enkel lokal testing på `http://localhost:5175`.

5) Admin 401-fix og strengere API-beskyttelse
  - Frontend lagrer nå JWT etter innlogging og setter `Authorization: Bearer <token>` globalt (i `src/api.js`). Løser 401 ved henting av rapporter m.fl.
  - Backend: sikret admin-endepunkter i Node-API:
    - Employees: liste/detalj/stats krever innlogging; opprett/oppdater/slett krever JWT + admin/manager.
    - EquipmentTypes: liste krever innlogging; opprett/oppdater/slett krever JWT + admin/manager.
  - Navigasjon: Admin-paneler vises allerede kun for manager/admin i UI; flere skjermflater vil etter hvert få tilsvarende rollebevissthet.

6) Dev: auto-redeploy ved filendringer
   - Nytt script `scripts/dev_watch.ps1` som lytter på endringer i `backend-nodejs/`, `frontend/` og `nginx/` og kjører automatisk:
     - Backend-endring: `docker compose up -d --build backend`
     - Frontend/nginx-endring: `docker compose up -d --build nginx` (bygger frontend og reloader Nginx)
   - Bruk: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\dev_watch.ps1` (Ctrl+C for å stoppe)
   - Flagg: `-Mode backend|nginx|all|auto`, `-DebounceMs 1500`, `-NoInitUp`.

### Frontend (mobil UX)
- Hjem: FAB «Start neste besøk» åpner bunnark «Rask start» med neste planlagte besøk (åpne/start).
- Kart: la til feature-flagget globalt event `app:openSheet` som lar kartmarkør åpne kundedetalj i bunnark uten å endre popup-HTML.

7) Admin-allowlist for gamle databaser uten rolle-felt
  - Backend: `requireRole`/`requireAdmin` aksepterer nå også e-poster i `ADMIN_EMAILS` (kommaseparert) miljøvariabel som admin/manager.
  - Bruk dette midlertidig om prod/dev-DB ikke har `role`-kolonnen eller dataene ennå. Eksempel i Compose: `ADMIN_EMAILS=user1@firma.no,user2@firma.no`.

8) Compose-konsolidering: kun ekstern MariaDB
  - Ryddet vekk lokale override-filer (`docker-compose.local.yml`, `docker-compose.local.vite.yml`, `docker-compose.local.extdb.yml`).
  - Beholder kun `docker-compose.yml` som peker mot ekstern MariaDB (på lokal maskin) via `DB_HOST=host.docker.internal` (eller egen IP/hostname).
  - Bruk `.env.extdb` for å sette `DB_*` og `ADMIN_EMAILS`. Kjør med: `docker compose --env-file .env.extdb up -d --build`.

9) Backend-stabilisering (2025-08-31)
  - Feedback: fjernet relasjonsoppslag (`relations: ["user","handler"]`) i `routes/feedback.ts` for å unngå SQL-feil når `employees`-skjemaet mangler enkelte kolonner (observed: `active`). API svarer fortsatt med `user_id`/`user_email` og `handled_by`.
  - Employees: forbedret fallback i liste/detalj til å inkludere `role` når tilgjengelig. `PUT /api/employees/:id` oppdaterer ett felt av gangen og skipper ukjente kolonner; returnerer et minimalt objekt med `id,name,email,role`.

10) Arkitektur- og datamodellmapping (2025-09-01)
  - La til `docs/ARCHITECTURE_MAPPING.md` som mapper foreslått datamodell (Kunde, Servicebesøk, Tekniker, Materialbruk, Rapport) til eksisterende TypeORM-entiteter og API.
  - Oppsummerer avvik (f.eks. UUID vs int PK) og foreslår lavrisiko-tilpasninger: `Customer.org_number`/`created_at`, signatur-URLer på `Visit`, utvidelser på `MaterialUsage`, og stegvis validering (Zod).
  - Implementerte første trinn: nye kolonner og migrasjon.
    * Entiteter oppdatert: `Customer` (org_number, created_at), `Visit` (customer_signature_url, technician_signature_url), `MaterialUsage` (unit, batch_number, risk_assessment, approved_by, waste_handling).
    * Migrasjon: `1725230000000_ModelExtensions.ts`. Kjør med TypeORM-motoren i container.

11) Validering (Zod) + enkel UI for nye felt (2025-09-01)
  - Backend: lagt inn Zod-validering i følgende ruter:
    * Customers: POST/PUT validerer felter inkl. org_number; ryddig håndtering av tall/strenger.
    * Visits: POST/PUT validerer felter inkl. customer_/technician_signature_url.
    * ServiceLogs: PUT aksepterer nå utvidet `materials_used[]`-payload (unit, batch_number, risk_assessment, approved_by, waste_handling).
  - Frontend: 
    * CustomerDetail: nytt felt «Org.nr», viser «Opprettet»-dato hvis tilgjengelig.
    * VisitDetail: enkel seksjon for å lime inn signatur-URLer (lagring støttes via PUT /visits; fullføringen fungerer som før).
  - Avgrensninger: signatur-URLer sendes via PUT /visits (ikke wired i UI-knapp enda – se neste steg).

12) Git-rydding og .gitignore (2025-09-01)
  - Oppdatert/forbedret `.gitignore` for å ignorere byggeartefakter, venv og uploads.
  - Fjernet tidligere sporede filer i `backend/venv2/` fra git-indeksen (beholdt på disk) for å unngå støy og advarsler.
  - Effekt: `git status` blir ryddigere, og commits inkluderer kun relevante kildefiler.

13) Compose-opprydding (2025-09-01)
  - Fjernet tomme/feilaktige filer: `docker-compose.override.yml` og `docker-compose.nodejs.yml` (ikke i bruk).
  - Lagt til enkel `docker-compose.prod.yml` som extender base `docker-compose.yml` (kun 80/443 i prod, og samme backend-oppsett via miljøvariabler).
  - `scripts/deploy_to_nas.ps1` kan fortsatt peke til `docker-compose.prod.yml`.

14) Mobil UX: Kontekstuelle FABs (2025-09-01)
  - VisitDetail: viser flytende knapp nederst til høyre med «Start besøk» (planlagt) eller «Fullfør besøk» (pågående) når ny UI er aktiv og skjermen er smal.
  - CustomerDetail: viser flytende knapp «Opprett besøk» for admin/manager når kunden ikke har aktivt besøk; knappen toggler inline-skjema.
  - Dette gjør de viktigste handlingene lettere tilgjengelige på mobil uten å lete i skjermbildet.
