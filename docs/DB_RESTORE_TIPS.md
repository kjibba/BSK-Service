# Tips: Etter restore av ekstern DB

Hvis du har koblet backend mot en ekstern utviklingsdatabase og får 500-feil som sier at kolonner mangler (for eksempel `customers.active` eller `employees.password_hash`), betyr det at migrasjoner må kjøres – eller at vi må gjøre en enkel, manuell «healing» en gang.

## Alternativ A: Gi rettigheter og kjør migrasjoner

1) Kjør `scripts/grant_extdb.sql` som root i HeidiSQL (eller tilsvarende):

   - Oppretter/oppdaterer brukeren `bsk_user` og gir `CREATE/ALTER` mm. på databasen.
   - Pass på riktig databasenavn (`bsk_service_db` er default her).

2) Kjør migrasjonene fra backend‑containeren:

   - `docker compose run --rm backend node dist/run-migrations.js`

Melding «Pending migrations: true» etterfulgt av «Executed migrations: …» betyr OK. Start evt. backend på nytt.

## Alternativ B: Manuell fix av to kolonner

Hvis du ikke vil gi brede rettigheter, kan du legge til to kolonner én gang manuelt i HeidiSQL:

```sql
ALTER TABLE customers ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE employees ADD COLUMN password_hash VARCHAR(255) NULL DEFAULT NULL;
```

Deretter kan backend starte uten 500, og migrasjoner vil senere registrere at kolonnene finnes (defensiv migrasjon sjekker først).

## Bekreftelse

- Backend health: http://localhost:8000/health
- Kundenliste: `GET /api/customers` (eller via UI)
- Kartdata: `GET /api/map/customers`

Når dette fungerer uten 500, er skjema i orden.
