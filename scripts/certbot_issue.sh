#!/usr/bin/env bash
set -euo pipefail

# Issue or renew Let's Encrypt cert for given domain using webroot
# Usage: ./scripts/certbot_issue.sh bsk.kjibba.no admin@example.com

DOMAIN=${1:-}
EMAIL=${2:-}
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: $0 <domain> <email>" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

mkdir -p nginx/letsencrypt nginx/certbot

echo "[certbot] Ensuring nginx is up to serve http-01 challenges..."
docker compose up -d nginx

echo "[certbot] Requesting certificate for $DOMAIN ..."
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email

echo "[certbot] Certificate obtained. Reloading nginx..."
docker compose exec -T nginx nginx -s reload || docker compose restart nginx
echo "[certbot] Done."
