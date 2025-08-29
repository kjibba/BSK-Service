"""
Kjører scripts/grant_extdb.sql mot lokal MySQL/MariaDB for å gi ekstern tilgang
for brukeren bsk_user fra containere (host.docker.internal).

Bruk:
  # PowerShell
  $env:MYSQL_ROOT_PASSWORD = "<root-passord>"
  python scripts/apply_extdb_grants.py --host 127.0.0.1 --port 3306

Leser root-passord fra env MYSQL_ROOT_PASSWORD. Avbryter hvis mangler.
"""

import os
import sys
import argparse
from pathlib import Path

try:
    import mysql.connector as mc
except Exception as e:
    print("Mangler mysql-connector-python. Installer først: pip install mysql-connector-python", file=sys.stderr)
    raise


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=3306)
    args = parser.parse_args()

    root_pw = os.environ.get("MYSQL_ROOT_PASSWORD")
    if not root_pw:
        print("Feil: Sett MYSQL_ROOT_PASSWORD i miljøet først.", file=sys.stderr)
        sys.exit(1)

    sql_path = Path(__file__).parent / "grant_extdb.sql"
    if not sql_path.exists():
        print(f"Finner ikke SQL-fil: {sql_path}", file=sys.stderr)
        sys.exit(1)

    # Koble til som root
    conn = mc.connect(user="root", password=root_pw, host=args.host, port=args.port)
    cur = conn.cursor()
    try:
        # Kjør hver statement i fila (enkelt split på ';' og dropp tomme)
        raw = sql_path.read_text(encoding="utf-8")
        statements = [s.strip() for s in raw.split(";") if s.strip()]
        for stmt in statements:
            cur.execute(stmt)
        conn.commit()
        print("Grants anvendt OK.")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
