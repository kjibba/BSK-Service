# Du er en erfaren Python/Flask-utvikler som jobber i et prosjekt med denne strukturen:
# backend/
#   app.py
#   extensions.py
#   models.py
#   routes/
#       customers.py
#       ...
# Vi bruker Flask, Flask-Migrate, SQLAlchemy og MariaDB.
# Vi har allerede en Customer-modell og fungerende POST/GET-endepunkter for /api/customers.
# Vi ønsker nå å utvide med tre nye modeller: Equipment, Visit og ServiceLog.

# Oppgaven din:
# 1. Oppdater backend/models.py:
#    - Legg til Equipment-modell med feltene:
#        id (PK), customer_id (FK til Customer), name, type, serial_number, installed_at (Date), notes
#    - Legg til Visit-modell med feltene:
#        id (PK), customer_id (FK til Customer), visit_date (DateTime), technician, notes
#    - Legg til ServiceLog-modell med feltene:
#        id (PK), visit_id (FK til Visit), equipment_id (FK til Equipment), log_date (DateTime), description
#    - Sett opp riktige relationship()-koblinger mellom modellene.
#    - Bruk db fra backend.extensions (ikke opprett ny db-instans).

# 2. Lag nye ruter i backend/routes/equipment.py og backend/routes/visits.py:
#    - CRUD-endepunkter (GET alle, GET én, POST, PUT, DELETE) for Equipment og Visit.
#    - Bruk Blueprint med url_prefix /api/equipment og /api/visits.
#    - Returner JSON-respons med riktige statuskoder.
#    - Håndter 404 hvis objekt ikke finnes.

# 3. Oppdater backend/app.py:
#    - Registrer de nye blueprintene.

# 4. Lag migrasjon:
#    - Sørg for at Flask-Migrate oppdager de nye modellene.
#    - Kjør flask db migrate -m "Add equipment, visits, service_logs"
#    - Kjør flask db upgrade

# 5. Lag en enkel testfil test_equipment_post.py:
#    - Bruk Flask test_client til å POSTe et nytt Equipment-objekt til /api/equipment.
#    - Print statuskode og JSON-respons.

# Viktig:
# - Følg samme kodestil som i eksisterende customers.py og models.py.
# - Bruk type hints der det gir mening.
# - Sørg for at alle imports bruker pakkestier (backend.extensions, backend.models).
# - Ikke endre eksisterende Customer-modell eller ruter unødvendig.