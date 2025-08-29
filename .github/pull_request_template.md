## Beskrivelse
- Hva endres og hvorfor?

## Sjekkliste
- [ ] Bygg og lint passer lokalt
- [ ] Ingen breaking changes uten feature flag (VITE_ENABLE_NEW_UI)
- [ ] Tilgjengelighet: fokus, kontrast, ARIA
- [ ] Ytelse: lazy loading, 60fps interaksjoner, skeletons
- [ ] Mobilvennlig: 48px touch-mål, én-håndsbruk, sticky actions
- [ ] Dokumentasjon oppdatert (README/CHANGELOG)

## Testing
- [ ] Manuell test: Hjem, Kart, Kunder, Meg
- [ ] E2E/smoke: /health 200 via nginx og backend

## Screenshots / Demo
## Hva

Kort beskrivelse av endringen(e).

## Hvorfor

Hvorfor dette trengs (bugfix/forenkling/migrasjon/ytelse/etc.).

## Endringer

- Node-backend: paritet med Flask på utstyr, servicelogger og besøk
- Miljø/compose: ryddet og i synk (DB_USERNAME/DB_DATABASE, .env.example)
- Dokumentasjon: README oppdatert; Flask markert som legacy
- Flask-kode: fjernet app/ruter og gamle Docker-artefakter (arkivert mappe ligger igjen)

## Sjekkliste

- [ ] Bygger backend-nodejs (`npm run build`)
- [ ] Server starter lokalt på 8000 og `/health` svarer
- [ ] Utstyr: kan opprettes/oppdateres med `placement_photo` (data-URL) og properties oppdateres
- [ ] Service log PUT: kan erstatte materialbruk (materials_used/poison_bait/nonpoison_bait)
- [ ] Visits POST: tar `assigned_technician_id`
- [ ] Docker Compose: start opp (Nginx + backend + db) med `.env`
- [ ] Frontend E2E: opprett utstyr med bilde, legg inn servicelog med materialer

## Hvordan teste

1) Backend lokalt
   - `cd backend-nodejs`
   - `npm install`
   - `npm run dev` og åpne `http://localhost:8000/health`

2) Docker Compose
   - `copy .env.example .env` og fyll ut passord/porter
   - `docker compose up -d --build`
   - Nginx eksponerer `${NGINX_HTTP_PORT}`

## Risiko og rollback

- Lav risiko: endringer begrenset til Node og dokumentasjon; Flask er arkivert
- Rollback: revert PR; Flask-mappe eksisterer fortsatt som arkiv (ikke brukt i drift)
