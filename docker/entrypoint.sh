#!/bin/sh
set -e

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set."
  echo "Set it via environment or --env-file .env when running the container."
  exit 1
fi

export PYTHONPATH=${PYTHONPATH:-/app}
export FLASK_APP=${FLASK_APP:-app.py}
cd /app/backend

# Wait for DB to be reachable (up to ~60s)
echo "Waiting for database to be ready..."
python - <<'PY'
import os, sys, time
from sqlalchemy import create_engine, text

url = os.environ.get('DATABASE_URL')
if not url:
    print('DATABASE_URL missing in environment')
    sys.exit(1)

for i in range(30):
    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        print('Database is reachable')
        sys.exit(0)
    except Exception as e:
        print(f'Database not ready ({i+1}/30): {e}')
        time.sleep(2)

print('Database did not become ready in time')
sys.exit(1)
PY

# Run DB migrations
echo "Running database migrations..."
python -m flask db upgrade -d ../migrations || {
  echo "Migration failed";
  exit 1;
}

# Start the app via waitress, with configurable PORT (default 8000)
PORT=${PORT:-8000}
HOST=${HOST:-0.0.0.0}
echo "Starting waitress on ${HOST}:${PORT}..."
exec waitress-serve --listen=${HOST}:${PORT} backend.app:app
