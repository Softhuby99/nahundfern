#!/usr/bin/env bash
# check-tls.sh — Prüft, ob die Let's Encrypt Zertifikate für den Live-Modus
# (test4) vorhanden und gültig sind, *bevor* der Stack umgestellt wird.
#
# Führt vier Checks aus:
#   1. Existieren fullchain.pem und privkey.pem?
#   2. Subject, Issuer und Ablaufdatum des Zertifikats
#   3. Passen Zertifikat und privater Schlüssel zusammen? (Modulus-Vergleich)
#   4. (optional) Live-Check von außen via openssl s_client
#
# Aufruf:
#   ./scripts/check-tls.sh
#   ./scripts/check-tls.sh nahundfern.servuswir.de
#
# Exit-Codes:
#   0  alle (verfügbaren) Checks bestanden
#   1  mindestens ein Check ist fehlgeschlagen
set -euo pipefail

cd "$(dirname "$0")/.."

DOMAIN="${1:-nahundfern.servuswir.de}"
LE_BASE="/etc/letsencrypt/live/${DOMAIN}"
FULLCHAIN="${LE_BASE}/fullchain.pem"
PRIVKEY="${LE_BASE}/privkey.pem"

# Standard-Einstiegspunkt überschreiben, damit wir Shell-Befehle ausführen können.
CERTRUN=(docker compose run --rm --no-deps --entrypoint "")

PASS=0
FAIL=0

ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
fail() { printf "  \033[31m✗\033[0m %s\n" "$1"; FAIL=$((FAIL + 1)); }
head() { printf "\n\033[1m━━ %s ━━\033[0m\n" "$1"; }

# ────────────────────────────────────────────────────────────────
# Vorab: läuft Docker / ist der certbot-Service definiert?
# ────────────────────────────────────────────────────────────────
if ! docker compose config --services 2>/dev/null | grep -q '^certbot$'; then
  echo "ERROR: Service 'certbot' nicht gefunden — führe dieses Skript im" >&2
  echo "       Projektverzeichnis /opt/nahundfern aus." >&2
  exit 1
fi

# ────────────────────────────────────────────────────────────────
head "1/4  Existenz der Zertifikatsdateien"
printf "  Domain: %s\n" "$DOMAIN"
printf "  Pfad:   %s\n" "$LE_BASE\n"

FILES_OUT="$("${CERTRUN[@]}" certbot ls -1 "$LE_BASE" 2>/dev/null || true)"

if echo "$FILES_OUT" | grep -q 'fullchain.pem' && \
   echo "$FILES_OUT" | grep -q 'privkey.pem'; then
  ok "fullchain.pem und privkey.pem vorhanden"
  echo "$FILES_OUT" | sed 's/^/      /'
else
  fail "Zertifikatsdateien fehlen unter ${LE_BASE}"
  echo "      Gefunden:"
  echo "$FILES_OUT" | sed 's/^/      /'
  echo
  echo "  → Zertifikate sind noch nicht ausgestellt."
  echo "    Führe zunächst den TLS-Bootstrap aus (siehe DEPLOYMENT.md),"
  echo "    bevor du auf Modus test4 wechselst."
  echo
  exit 1
fi

# ────────────────────────────────────────────────────────────────
head "2/4  Zertifikat: Subject, Issuer, Gültigkeit"
CERT_INFO="$("${CERTRUN[@]}" certbot openssl x509 \
  -in "$FULLCHAIN" -noout -subject -issuer -dates 2>/dev/null || true)"

if [[ -z "$CERT_INFO" ]]; then
  fail "Zertifikat konnte nicht gelesen werden (korrupt?)"
else
  SUBJECT_CN="$(echo "$CERT_INFO" | grep -i '^subject=' \
    | sed -E 's/.*CN[[:space:]]*=[[:space:]]*([^,]+).*/\1/' || true)"
  echo "$CERT_INFO" | sed 's/^/      /'

  if [[ "$SUBJECT_CN" == "$DOMAIN" ]]; then
    ok "Subject-CN stimmt mit Domain überein (${DOMAIN})"
  else
    fail "Subject-CN ist '${SUBJECT_CN}', erwartet '${DOMAIN}'"
  fi

  # Ablaufdatum prüfen
  NOT_AFTER="$(echo "$CERT_INFO" | grep -i '^notAfter=' \
    | cut -d= -f2 | xargs || true)"
  if [[ -n "$NOT_AFTER" ]]; then
    EXPIRES_EPOCH="$(date -d "$NOT_AFTER" +%s 2>/dev/null || true)"
    NOW_EPOCH="$(date +%s)"
    if [[ -n "$EXPIRES_EPOCH" && "$EXPIRES_EPOCH" -gt "$NOW_EPOCH" ]]; then
      DAYS_LEFT=$(( (EXPIRES_EPOCH - NOW_EPOCH) / 86400 ))
      ok "Zertifikat gültig bis ${NOT_AFTER} (noch ${DAYS_LEFT} Tage)"
    else
      fail "Zertifikat ist abgelaufen (notAfter: ${NOT_AFTER})"
    fi
  fi
fi

# ────────────────────────────────────────────────────────────────
head "3/4  Übereinstimmung Zertifikat ↔ privater Schlüssel"
CERT_MOD="$("${CERTRUN[@]}" certbot openssl x509 \
  -in "$FULLCHAIN" -noout -modulus 2>/dev/null | openssl md5 || true)"
KEY_MOD="$("${CERTRUN[@]}" certbot openssl rsa \
  -in "$PRIVKEY" -noout -modulus 2>/dev/null | openssl md5 || true)"

printf "      Zertifikat-Modulus: %s\n" "$CERT_MOD"
printf "      Schlüssel-Modulus:   %s\n" "$KEY_MOD"

if [[ -n "$CERT_MOD" && -n "$KEY_MOD" && "$CERT_MOD" == "$KEY_MOD" ]]; then
  ok "Zertifikat und Schlüssel passen zusammen"
else
  fail "Modulus stimmt nicht überein — Zertifikat/SchlüsselMismatch"
  echo "      Das Zertifikat wurde wahrscheinlich für einen anderen Schlüssel"
  echo "      ausgestellt. Erneuere es mit dem TLS-Bootstrap."
fi

# ────────────────────────────────────────────────────────────────
head "4/4  Live-Check von außen (openssl s_client)"
printf "  Versuche https://%s:443 …\n\n" "$DOMAIN"

if command -v openssl >/dev/null 2>&1; then
  LIVE_OUT="$(openssl s_client -connect "${DOMAIN}:443" \
    -servername "$DOMAIN" </dev/null 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates 2>/dev/null || true)"

  if [[ -n "$LIVE_OUT" ]]; then
    echo "$LIVE_OUT" | sed 's/^/      /'
    LIVE_CN="$(echo "$LIVE_OUT" | grep -i '^subject=' \
      | sed -E 's/.*CN[[:space:]]*=[[:space:]]*([^,]+).*/\1/' || true)"
    if [[ "$LIVE_CN" == "$DOMAIN" ]]; then
      ok "Live-Server liefert korrektes Zertifikat für ${DOMAIN}"
    else
      fail "Live-Server liefert Zertifikat für '${LIVE_CN}' statt '${DOMAIN}'"
    fi
  else
    echo "      (keine Antwort — Server noch nicht gestartet oder Port 443"
    echo "       noch nicht erreichbar; dieser Check ist optional und kann"
    echo "       nach dem ersten Start wiederholt werden)"
  fi
else
  echo "      openssl nicht auf dem Host verfügbar — Check übersprungen."
fi

# ────────────────────────────────────────────────────────────────
echo
if [[ "$FAIL" -eq 0 ]]; then
  printf "\033[32m✓ Alle Checks bestanden.\033[0m\n"
  echo "  Die Zertifikate sind gültig und bereit für Modus test4."
  echo "  Start:  ./scripts/run.sh test4"
  exit 0
else
  printf "\033[31m✗ %d Check(s) fehlgeschlagen.\033[0m\n" "$FAIL"
  echo "  Behebe die Probleme oben, bevor du auf test4 wechselst."
  exit 1
fi
