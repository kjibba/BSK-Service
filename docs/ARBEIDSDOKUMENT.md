# Arbeidsdokument – Mobil UX/UI-oppgradering og Docker-deploy

Dette er et «levende» dokument for plan, status og neste steg. Hold sjekklistene oppdatert når ting fullføres eller endres.

## Mål
- Stabil lokal og produksjonskjøring i Docker (Nginx + Node/Express/TypeORM + MariaDB)
- Forbedret mobil arbeidsflyt og konsistent UI
- Beholde eksisterende Leaflet-popup-klassenavn og API-kontrakter

## Status (kort)
- Infrastruktur: Lokal stack og ekstern dev-DB fungerer. Prod-oppsett klart; HTTP→HTTPS i prod, HTTP i dev.
- Backend: Express/TypeORM stabilt, health-endepunkt OK, login fra mobil løst (trust proxy, CORS, sameSite=lax).
- Frontend: Felles PageHeader innført, «Oppdater»-handlinger lagt til, delt ikonsett og kompakt .btn-icon-stil rullet ut. Flere sider standardisert. Bygg grønt.

## Sjekkliste (arbeidspakker)

### 1) Infrastruktur & drift
- [x] Docker-compose for dev/prod (Nginx SPA + /api-proxy)
- [x] Docker-compose for hot-reload (frontend Vite + backend tsx) via `docker-compose.local.vite.yml`
- [x] Ekstern dev-DB via .env-override; DB_SYNC=false i dev
- [x] Health-ender: /health (backend) via Nginx
- [ ] Prod-SSL med Certbot (sjekk fornying og reload-rutine)
- [x] CI: enkel build-sjekk (frontend+backend) ved PR

### 2) Backend (Node/Express/TypeORM)
- [x] trust proxy aktivert for riktig cookie-oppførsel
- [x] CORS i dev, sameSite=lax for mobil login
- [x] Konsistente API-svar via toDict() og EU-datoformat der det gjelder
- [ ] Ekstra logging rundt auth-feil (lav prioritet)
- [x] «Tilordne nærmeste» åpnet for alle innloggede (sesjon/JWT). Ikke krav om admin.
- [ ] Rydd opp midlertidig fallback (aktiv-kolonne-mangel) når migrasjoner er på plass

### 3) Frontend – felles UI-mønstre
- [x] PageHeader-komponent i hovedvisninger
- [x] «Oppdater»-handling i headere, kompakt .btn-icon-stil
- [x] Delt ikonsett (Refresh/Plus/Back/ChevronUp/Down/Edit)
- [x] PageHeader også i VisitDetail (hvis ikke allerede)

### 4) Frontend – mobil arbeidsflyt (pågående)
- [x] Hjem-fane: FAB «Start neste besøk» åpner bunnark «Rask start» med neste planlagte besøk og handlinger (åpne/start)
- [x] Kontekstuell FAB:
  - [x] VisitDetail: FAB «Start/Fullfør» basert på status
  - [x] CustomerDetail: FAB «Opprett besøk»
- [x] Forberedt MapView → BottomSheet: globalt event `app:openSheet` (feature-flagget) for å åpne kundedetalj i bunnark uten endring av popup-klasser
- [x] Prefetch og lette skeletons for hovedlister
- [ ] Enkle offline-forbedringer (service worker + idb) – lav prioritet
- [ ] WCAG/tilgjengelighet: fokusrekkefølge, label-for, kontrast (pågår – fokus forbedret i BottomSheet)

### 5) Kvalitet & test
- [x] Manuell smoketest-rutine (dev): app opp, login, kart, lister, detaljer
- [ ] Lint/format i begge prosjekter ved commit (CI eller huskeregel)
- [ ] Enkle e2e-røyktester for nøkkelstier (senere)

### 6) Database & migrasjoner (ekstern dev-DB)
- [ ] Gi `bsk_user` nødvendige rettigheter for migrasjoner (kjør `scripts/grant_extdb.sql` som root)
- [x] Kjør migrasjoner mot ekstern DB: `docker compose run --rm backend node dist/run-migrations.js`
  - [x] Verifisert: ingen pending migrasjoner (auto-run ved oppstart ga «pending: false»)
- [ ] Hvis låst/uten rettigheter: manuell én-gangs kolonne-fix i HeidiSQL
  - [ ] `ALTER TABLE customers ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;`
  - [ ] `ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) NULL;`
  - [ ] (fra eldre skjema) `ALTER TABLE employees ADD COLUMN phone VARCHAR(30) NULL;`
  - [ ] (fra eldre skjema) `ALTER TABLE employees ADD COLUMN title VARCHAR(100) NULL;`
- [ ] Verifiser etterpå: /api/customers, /api/map/customers, /api/employees gir 200
- [ ] Fjern eventuelle «defensive» kodebaner når skjema er i sync

## Nylige beslutninger (beslutningslogg)
- Nginx som SPA-server og /api-proxy. Dev uten TLS, prod med Certbot.
- Beholde Leaflet-popup-HTML-klasser (event-binding avhenger av disse).
- Standardisere headere med PageHeader og ikonknapper for handlinger.
- Aktivere trust proxy + sameSite=lax for mobil-innlogging.
- To dev-modi i Docker: 1) Nginx tjener bygget SPA (speil av prod) og 2) hot-reload (Vite/tsx) for rask utvikling.
- Tilgangskrav for utstyrs-tilordning mykes opp: alle innloggede (sesjon/JWT) kan kjøre «tilordne nærmeste».

## Milepæler
- M1: Infrastruktur stabil (dev) og mobil login OK – Ferdig
- M2: Felles headere og ikonstandard – Ferdig
- M3: Hjem-fane med «I dag»-kort og FAB – Neste
- M4: BottomSheet-integrasjon fra kart – Planlagt
- M5: FAB i VisitDetail/CustomerDetail – Planlagt

## Hvordan vi oppdaterer dokumentet
- Når en oppgave fullføres: kryss av i sjekklista og flytt eventuelle deloppgaver som gjenstår.
- Legg til korte notater i «Nylige beslutninger» når vi endrer retning.
- Hold «Milepæler» i sync (Ferdig/Neste/Planlagt).

## Relevante filer i repoet
- backend-nodejs/src/app.ts, src/data-source.ts, src/routes/*
- frontend/src/components/*, frontend/src/api.js, vite.config.js
- docker-compose*.yml, nginx/nginx.conf, docs/WORKFLOWS.md

## Neste konkrete steg (nå)
- Finpusse «Rask start»: fallback-tekst når ingen planlagte oppdrag; håndter feil bedre (delvis gjort).
- Innføre kontekstuell FAB i VisitDetail og CustomerDetail.
- Kjør migrasjoner (eller manuell kolonne-fix) på ekstern DB for å fjerne 500 på employees/kunder.
