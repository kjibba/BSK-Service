# Arkitektur- og datamodellmapping (BSK Service App)

Denne siden mapper den foreslåtte datamodellen og systemskissen til faktiske entiteter, API-er og praksis i denne koden (React/Vite + Node/Express/TypeORM + MariaDB).

## Oppsummert status
- UUID vs int: Vi bruker autoinkrement `int` primærnøkler i DB. Migrering til UUID er mulig, men ikke nødvendig nå.
- Entiteter finnes allerede med tilsvarende funksjon: Kunde=Customer, Servicebesøk=Visit, Tekniker=Employee, Materialbruk=MaterialUsage, Rapport=ServiceReport.
- Roller og autentisering: JWT + session brukes. Rolle er `admin`/`manager`/`technician` (manager≈admin for tilgang). Nginx auth_request + backend-guards.
- Tidsstempling: Flere entiteter bruker EU-format i API (`dateUtils`). Noen har `created_at`/`updated_at` felt, andre kan utvides.

## Mapping av foreslåtte entiteter

1) Kunde (Customer)
- Foreslått: id(UUID), navn, adresse, kontaktperson, telefon, epost, orgnr, opprettet_dato
- I kode: `backend-nodejs/src/entities/Customer.ts`
  - id: int (PrimaryGeneratedColumn)
  - name, address, contact_person, phone, email, postal_code, city, visits_per_year, start_date, latitude, longitude, active
  - Mangler: organisasjonsnummer, opprettet_dato (kan legges til ved behov)

2) Servicebesøk (Visit)
- Foreslått: id(UUID), kunde_id, tekniker_id, dato, start/slutt, beskrivelse, observasjoner, anbefalinger, signaturer, status
- I kode: `backend-nodejs/src/entities/Visit.ts`
  - id:int, customer_id:int, visit_date:datetime, assigned_technician_id:int, owner_technician_id:int, technician(varchar), notes(text), status(varchar), started_at, completed_at
  - Sjekklistefelter: sjekk_* samt oppsummering_notat (dekker observasjoner/anbefalinger delvis)
  - Mangler: egne signaturfelt, eksplisitte start_tid/slutt_tid (kan avledes fra started_at/completed_at), mer finmasket struktur for observasjoner/anbefalinger

3) Tekniker (Employee)
- Foreslått: id(UUID), navn, epost, telefon, rolle, aktiv
- I kode: `backend-nodejs/src/entities/Employee.ts`
  - id:int, name, email, role, phone, title, active, password_hash
  - Roller i bruk: admin/manager/technician

4) Materialbruk (MaterialUsage)
- Foreslått: id, servicebesok_id, produktnavn, mengde, enhet, batchnummer, risikovurdering, godkjent_av, avfallshåndtering
- I kode: `backend-nodejs/src/entities/Material.ts`, `MaterialUsage.ts`
  - Material: produktnavn mm.
  - MaterialUsage: service_log_id, material_id, amount
  - Mangler i Usage: enhet, batchnummer, risikovurdering, godkjent_av, avfallshåndtering (kan utvides)

5) Rapport (ServiceReport)
- Foreslått: id, servicebesok_id, pdf_url, generert_dato
- I kode: `backend-nodejs/src/entities/ServiceReport.ts`
  - id:int, visit_id, customer_id, file_path, created_at (CreateDateColumn)
  - URL genereres fra file_path via toDict.

## Systemskisse og API
- Frontend: React/Vite, ruter for kart, kunder, besøk, adminpanel.
- Backend: Express-ruter under `/api/*`. Nøkkelruter finnes allerede:
  - Kunder: `/api/customers` (GET/POST/PUT/…) og kart `/api/map/customers`.
  - Servicebesøk: `/api/visits` inkl. arbeidsflyt `/start`, `/complete`, logger mm.
  - Materialer/forbruk: `/api/materials`, `/api/service-logs`, `MaterialUsage` tilknyttet service-logs.
  - Rapporter: `/api/reports` + `ServiceReport`-entitet.
  - Autentisering/roller: `/api/auth/*`, guards `requireAuthenticated`, `requireJwt`, `requireAdmin()`.

Validering
- Vi bruker servervalidering ad hoc (sjekker integers, påkrevde felt, osv.). Innføring av Zod/Joi kan gjøres stegvis pr. rute.

Sikkerhet og samsvar
- JWT-basert auth + Nginx auth_request. CORS tillater lokale og konfigurerte origins.
- GDPR: Eksport/sletting av persondata ikke fullført som egne ruter ennå. Vi har klientfeil-logging og audit via service logs, men ikke full audit trail på alle endringer.

## Foreslåtte småtilpasninger (kompatible og lav risiko)
- Customer: legg til `org_number` (varchar(20), nullable) og `created_at` (datetime default now). Eksponer i toDict.
- Visit: vurder `customer_signature_url` og `technician_signature_url` (varchar(500), nullable). 
- MaterialUsage: legg til `unit` (varchar(20)), `batch_number` (varchar(50)), `risk_assessment` (text), `approved_by` (int, FK employee), `waste_handling` (text). Alle nullable.
- Innfør lett validering med Zod for nye felter i relevante POST/PUT-ruter.
- GDPR: legg to hjelpruter (admin): `GET /api/admin/users/:id/export` og `DELETE /api/admin/users/:id` (myk-slett/anon) — kun skjelett først.
- Behold int PK nå; vurder UUID ved større migrasjon senere.

## Neste steg (valgfritt)
1) Migrasjoner (TypeORM): opprett nye kolonner som foreslått (generer + kjør).
2) Oppdater toDict og ruter til å lese/skrive nye felter.
3) Legg minimal Zod-validering i nye ruter.
4) Dokumenter i README og CHANGELOG.
