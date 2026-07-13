#!/bin/sh
# Daily PostgreSQL backup with rolling retention.
# Runs inside the `backup` container; connects to the `db` service using the
# credentials injected via environment variables.
set -eu

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR="/backups"
OUT_FILE="${OUT_DIR}/nahundfern_${STAMP}.sql.gz"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "${OUT_DIR}"

echo "backup: dumping ${PGDATABASE:-?} to ${OUT_FILE}"
pg_dump --clean --if-exists --no-owner --no-privileges | gzip -9 > "${OUT_FILE}.part"
mv "${OUT_FILE}.part" "${OUT_FILE}"

# Retention: delete dumps older than KEEP_DAYS.
find "${OUT_DIR}" -type f -name 'nahundfern_*.sql.gz' -mtime "+${KEEP_DAYS}" -print -delete || true

echo "backup: done (${OUT_FILE})"
