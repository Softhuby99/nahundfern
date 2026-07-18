# Backup image = postgres client + gnupg (for optional GPG-encrypted dumps).
# Pinned to the same Postgres major as the db service to keep pg_dump compatible.
FROM postgres:16.6-alpine

RUN apk add --no-cache gnupg findutils coreutils

# The actual backup.sh is bind-mounted from the host in docker-compose.yml,
# so we don't COPY it here. Keeps iteration fast (no rebuild for script edits).
ENTRYPOINT ["/bin/sh"]
