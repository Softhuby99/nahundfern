#!/usr/bin/env bash
# Start the stack in one of four modes:
#   test1  Test,  HTTP-only         (any IP/hostname, no TLS)
#   test2  Test,  self-signed TLS   (local HTTPS testing)
#   test3  Live,  HTTP-only         (productive domain, behind reverse-proxy)
#   test4  Live,  Let's Encrypt TLS (production)
set -euo pipefail

MODE="${1:-}"
case "$MODE" in
  test1|test2|test3|test4) ;;
  *)
    echo "Usage: $0 {test1|test2|test3|test4}" >&2
    echo "  test1  Test  HTTP-only" >&2
    echo "  test2  Test  self-signed HTTPS" >&2
    echo "  test3  Live  HTTP-only (behind proxy)" >&2
    echo "  test4  Live  Let's Encrypt HTTPS" >&2
    exit 2
    ;;
esac

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
