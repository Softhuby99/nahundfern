#!/usr/bin/env bash
# Start the stack in one of five modes:
#   test1  Test,  HTTP-only         (any IP/hostname, no TLS)
#   test2  Test,  self-signed TLS   (local HTTPS testing)
#   test3  Live,  HTTP-only         (productive domain, behind reverse-proxy)
#   test4  Live,  Let's Encrypt TLS (certbot inside this stack)
#   test5  Live,  external TLS      (certs from TLS_CERT_DIR, no certbot)
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  test1|test2|test3|test4|test5) ;;
  *)
    echo "Usage: $0 {test1|test2|test3|test4|test5}" >&2
    echo "  test1  Test  HTTP-only" >&2
    echo "  test2  Test  self-signed HTTPS" >&2
    echo "  test3  Live  HTTP-only (behind proxy)" >&2
    echo "  test4  Live  Let's Encrypt HTTPS (certbot)" >&2
    echo "  test5  Live  HTTPS with external certificates" >&2
    exit 2
    ;;
esac

# Verify the external certificate files before starting nginx.
if [[ "$MODE" == "test5" ]]; then
  TLS_CERT_DIR="${TLS_CERT_DIR:-/opt/tls-certs/nahundfern}"
  for f in fullchain.pem key.pem; do
    if [[ ! -f "$TLS_CERT_DIR/$f" ]]; then
      echo "ERROR: $TLS_CERT_DIR/$f fehlt — TLS_CERT_DIR anpassen." >&2
      exit 1
    fi
  done
  echo "==> Verwende Zertifikate aus $TLS_CERT_DIR"
  openssl x509 -in "$TLS_CERT_DIR/fullchain.pem" -noout -subject -issuer -dates || true
  export TLS_CERT_DIR
fi

cd "$(dirname "$0")/.."

# Generate self-signed cert for test2 on first run.
if [[ "$MODE" == "test2" ]]; then
  CERT_DIR="./nginx/certs"
  mkdir -p "$CERT_DIR"
  if [[ ! -f "$CERT_DIR/fullchain.pem" || ! -f "$CERT_DIR/privkey.pem" ]]; then
    echo "==> Generating self-signed certificate in $CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout "$CERT_DIR/privkey.pem" \
      -out    "$CERT_DIR/fullchain.pem" \
      -subj   "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
  fi
fi

echo "==> Starting stack in mode: $MODE"
docker compose -f docker-compose.yml -f "docker-compose.${MODE}.yml" up -d --build

echo
docker compose -f docker-compose.yml -f "docker-compose.${MODE}.yml" ps
