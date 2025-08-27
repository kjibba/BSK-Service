#!/usr/bin/env bash

set -euo pipefail

# BSK Service App – Hetzner one-shot deploy script
# - Installs Docker & docker compose plugin if missing
# - Clones/updates repo to TARGET_DIR
# - Loads .env (create from .env.prod.example if missing)
# - Cleans old containers/images for this stack
# - Builds and starts services
# - Runs DB migrations
# - Verifies health

# --- Config (override via env or flags) ---
REPO_URL="${REPO_URL:-https://github.com/kjibba/BSK-Service.git}"
BRANCH="${BRANCH:-feature/visit-workflow}"
TARGET_DIR="${TARGET_DIR:-/opt/bsk-service}"
HTTP_PORT="${HTTP_PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"

usage() {
  cat <<USAGE
Usage: env [REPO_URL=...] [BRANCH=...] [TARGET_DIR=...] [HTTP_PORT=80] [HTTPS_PORT=443] $0
USAGE
}

log() { echo "[deploy] $*"; }

need_cmd() { command -v "$1" >/dev/null 2>&1; }

install_docker() {
  if need_cmd docker && docker compose version >/dev/null 2>&1; then
    log "Docker + compose already installed"
    return
  fi
  log "Installing Docker Engine and compose plugin..."
  curl -fsSL https://get.docker.com | sh
  # Enable and start
  systemctl enable docker || true
  systemctl start docker || true
  # Verify compose plugin
  if ! docker compose version >/dev/null 2>&1; then
    log "docker compose plugin not found. Please ensure docker-compose-plugin is installed."
    exit 1
  fi
}

ensure_dirs() {
  mkdir -p "$TARGET_DIR"
}

clone_or_pull() {
  if [ ! -d "$TARGET_DIR/.git" ]; then
    log "Cloning repo $REPO_URL -> $TARGET_DIR"
    git clone "$REPO_URL" "$TARGET_DIR"
  else
    log "Repo already present, pulling latest..."
    (cd "$TARGET_DIR" && git fetch --all --prune && git reset --hard "origin/$BRANCH")
  fi
  (cd "$TARGET_DIR" && git checkout "$BRANCH" && git pull --rebase origin "$BRANCH")
}

prepare_env() {
  cd "$TARGET_DIR"
  # Create .env if missing
  if [ ! -f .env ]; then
    if [ -f .env.prod ]; then
      cp .env.prod .env
    elif [ -f .env.prod.example ]; then
      cp .env.prod.example .env
      log "Created .env from .env.prod.example. Update secrets as needed."
    else
  cat > .env <<EOF
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
MYSQL_DATABASE=bsk_service_db
MYSQL_USER=bsk_user
MYSQL_PASSWORD=$(openssl rand -hex 16)
BACKEND_PORT=8000
NGINX_HTTP_PORT=${HTTP_PORT}
NGINX_HTTPS_PORT=${HTTPS_PORT}
NODE_ENV=production
SECRET_KEY=$(openssl rand -hex 32)
EOF
      log "Generated minimal .env with random passwords."
    fi
  fi
}

compose_down_clean() {
  cd "$TARGET_DIR"
  if [ -f docker-compose.yml ]; then
    log "Stopping existing stack (if any)..."
    docker compose down --remove-orphans || true
  fi
  log "Pruning dangling images/containers..."
  docker system prune -f || true
}

compose_up() {
  cd "$TARGET_DIR"
  log "Building and starting containers..."
  docker compose pull || true
  docker compose build
  docker compose up -d
}

wait_for_db() {
  cd "$TARGET_DIR"
  log "Waiting for database to be healthy..."
  local retries=60
  local sleep_s=2
  local svc=db
  for i in $(seq 1 $retries); do
    status=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "$(docker compose ps -q $svc)" 2>/dev/null || echo "unknown")
    if [ "$status" = "healthy" ]; then
      log "DB is healthy."
      return 0
    fi
    sleep "$sleep_s"
  done
  log "DB did not become healthy in time."
  docker compose ps
  exit 1
}

run_migrations() {
  cd "$TARGET_DIR"
  log "Running DB migrations (backend)..."
  # Use built JS to avoid relying on dev deps
  set +e
  docker compose run --rm -e NODE_ENV=production backend node dist/run-migrations.js
  local rc=$?
  set -e
  if [ $rc -ne 0 ]; then
    log "Migrations failed (rc=$rc). Attempting one-time schema bootstrap (DB_SYNC) and retry..."
    # One-time schema sync for fresh databases
    docker compose run --rm -e DB_SYNC=true -e NODE_ENV=development backend node -e "require('./dist/data-source.js').AppDataSource.initialize().then(ds=>ds.synchronize().then(()=>ds.destroy())).catch(e=>{console.error(e); process.exit(1)})"
    log "Retrying migrations after bootstrap..."
    docker compose run --rm -e NODE_ENV=production backend node dist/run-migrations.js
  fi
}

seed_admin_if_requested() {
  cd "$TARGET_DIR"
  if [ -n "${ADMIN_EMAIL:-}" ] || [ -n "${ADMIN_USERNAME:-}" ]; then
    log "Seeding admin user (email/username: ${ADMIN_EMAIL:-$ADMIN_USERNAME})..."
  docker compose run --rm -e DB_SYNC=true -e ADMIN_EMAIL -e ADMIN_USERNAME -e ADMIN_NAME -e ADMIN_PASSWORD -e ADMIN_ROLE backend node dist/scripts/seedAdmin.js || true
  else
    log "No ADMIN_EMAIL/ADMIN_USERNAME provided; skipping admin seed."
  fi
}

verify_health() {
  cd "$TARGET_DIR"
  log "Stack status:"
  docker compose ps
  log "Testing HTTP health on :${HTTP_PORT}/health ..."
  set +e
  curl -fsS "http://localhost:${HTTP_PORT}/health" && echo || true
  set -e
}

main() {
  if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then usage; exit 0; fi

  install_docker
  ensure_dirs
  clone_or_pull
  prepare_env
  compose_down_clean
  compose_up
  wait_for_db
  run_migrations
  seed_admin_if_requested
  verify_health

  log "Deployment complete. Visit http://<server-ip>:${HTTP_PORT}/ to use the app."
}

main "$@"
