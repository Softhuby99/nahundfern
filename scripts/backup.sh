#!/bin/sh
# Daily PostgreSQL backup with rolling retention.
# Runs inside the `backup` container; connects to the `db` service using the
# credentials injected via environment variables.
#
# Behaviour:
#   - dump is written to a `.part` file first and only renamed to its final
#     name after gzip (and optional gpg) exits cleanly, so partial dumps are
#     never picked up as valid backups
#   - `trap` removes the `.part` file on failure/interrupt
#   - if BACKUP_GPG_RECIPIENT is set AND /run/secrets/backup-public-key.asc
#     exists, the dump is encrypted with that public key (no private key needed
#     on the host — only the operator holds the decryption key)
#   - old dumps beyond BACKUP_KEEP_DAYS are deleted
set -eu

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="/backups"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
GPG_KEY_FILE="/run/secrets/backup-public-key.asc"

mkdir -p "${OUT_DIR}"

if [ -n "${BACKUP_GPG_RECIPIENT:-}" ] && [ -f "${GPG_KEY_FILE}" ]; then
  FINAL="${OUT_DIR}/nahundfern_${STAMP}.sql.gz.gpg"
  ENCRYPT=1
else
  FINAL="${OUT_DIR}/nahundfern_${STAMP}.sql.gz"
  ENCRYPT=0
fi
PART="${FINAL}.part"

cleanup() {
  rm -f "${PART}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "backup: dumping ${PGDATABASE:-?} -> ${FINAL}"

if [ "${ENCRYPT}" -eq 1 ]; then
  # Import the public key into an ephemeral keyring so the operator's key
  # never needs to be pre-installed at container build time.
  GNUPGHOME=$(mktemp -d)
  export GNUPGHOME
  gpg --batch --quiet --import "${GPG_KEY_FILE}"
  pg_dump --clean --if-exists --no-owner --no-privileges \
    | gzip -9 \
    | gpg --batch --yes --trust-model always \
          --recipient "${BACKUP_GPG_RECIPIENT}" \
          --encrypt --output "${PART}"
  rm -rf "${GNUPGHOME}"
else
  pg_dump --clean --if-exists --no-owner --no-privileges | gzip -9 > "${PART}"
fi

mv "${PART}" "${FINAL}"
trap - EXIT INT TERM

# Retention: delete dumps older than KEEP_DAYS.
find "${OUT_DIR}" -type f \
  \( -name 'nahundfern_*.sql.gz' -o -name 'nahundfern_*.sql.gz.gpg' \) \
  -mtime "+${KEEP_DAYS}" -print -delete || true

echo "backup: done (${FINAL})"
