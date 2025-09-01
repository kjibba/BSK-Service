#!/bin/sh
set -e

# If BASIC_AUTH_USER and BASIC_AUTH_PASS are provided, create htpasswd
if [ -n "${BASIC_AUTH_USER}" ] && [ -n "${BASIC_AUTH_PASS}" ]; then
  echo "Creating htpasswd for user ${BASIC_AUTH_USER}"
  # create directory if not exists
  mkdir -p /etc/nginx
  # Use openssl to generate bcrypt if htpasswd not available
  if command -v htpasswd >/dev/null 2>&1; then
    htpasswd -b -c /etc/nginx/.htpasswd "${BASIC_AUTH_USER}" "${BASIC_AUTH_PASS}"
  else
    # Fallback: use openssl to create MD5-style password entry
    # Note: openssl passwd -apr1 produces an Apache MD5 password
    PASS_HASH=$(openssl passwd -apr1 "${BASIC_AUTH_PASS}")
    echo "${BASIC_AUTH_USER}:${PASS_HASH}" > /etc/nginx/.htpasswd
  fi
else
  echo "BASIC_AUTH_USER or BASIC_AUTH_PASS not set; leaving /etc/nginx/.htpasswd as-is"
fi

# Execute the original command
exec "$@"
