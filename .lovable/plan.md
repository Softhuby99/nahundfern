
# Plan v0.5.5 — Sicherheit „Sofort" (Rev. 4, freigabereif)

Alle 4 verbindlichen Korrekturen + Kleinverbesserungen aus der letzten Review sind eingearbeitet.

## 1. Origin-/CSRF-Schutz — mit serverseitiger Runtime-URL

**Neu `src/lib/public-origin.server.ts`** (getrennt von `public-base-url.ts`, das build-time bleibt für Social-Metadaten):

```ts
export function getServerPublicOrigin(): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (!configured) throw new Error("PUBLIC_BASE_URL is required");
  const url = new URL(configured);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("PUBLIC_BASE_URL must use HTTP or HTTPS");
  }
  return url.origin;
}
```

Kein stiller Fallback auf Produktionsdomain. Bei fehlender ENV → 500 beim ersten geschützten Request (deutlich diagnostizierbar).

**`src/lib/auth.server.ts` — `requireSameOrigin(request)`:**

```ts
import { getServerPublicOrigin } from "@/lib/public-origin.server";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

export function requireSameOrigin(request: Request): void {
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return;

  const expectedOrigin = getServerPublicOrigin();
  const originHeader = request.headers.get("origin");
  if (!originHeader) throw new Response("Forbidden", { status: 403 });

  let requestOrigin: string;
  try {
    requestOrigin = new URL(originHeader).origin;
  } catch {
    throw new Response("Forbidden", { status: 403 });
  }
  if (requestOrigin !== expectedOrigin) {
    throw new Response("Forbidden", { status: 403 });
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new Response("Forbidden", { status: 403 });
  }
}
```

Aufgerufen VOR `requireAuth` in: `POST /api/auth/login`, `POST /api/auth/logout`, `POST|PATCH|DELETE /api/studio/trips`, `POST|PATCH|DELETE /api/studio/images`.

**ENV-Setup:**
- Produktion (`.env`): `PUBLIC_BASE_URL=https://nahundfern.servuswir.de`
- test2 (`.env` oder `docker-compose.test2.yml`): `PUBLIC_BASE_URL=https://test2.example.internal`
- `docker-compose.yml` reicht `PUBLIC_BASE_URL` bereits als Runtime-ENV in den App-Container weiter — kein Rebuild nötig für Origin-Änderungen.

## 2. Validierung + Cover-Guard

`src/routes/api/studio/trips.ts`:
- Slug-Regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`.
- `countryCode`: trim → uppercase → leerer String → `null`; sonst `/^[A-Z]{2}$/`.
- Datums-Cross-Check per `.superRefine` (String-Vergleich bei streng validiertem `YYYY-MM-DD`).
- **POST:** `if (data.coverImageId) → 400 "Cover kann erst nach Erstellung zugewiesen werden"`.
- **PATCH:** wenn `coverImageId` gesetzt → `SELECT id FROM images WHERE id=$1 AND trip_id=$2`; kein Treffer → 400.

`src/routes/api/studio/images.ts`:
- `DELETE`: `id` mit `z.string().uuid()` validieren.

## 3. Audit-Log

**Migration `db/migrations/004_audit_log.sql` + Ergänzung in `db/schema.sql`:**

```sql
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  success boolean NOT NULL DEFAULT true,
  request_id text,
  ip inet,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_id_idx  ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx   ON audit_log (entity_type, entity_id, created_at DESC);
```

**Neu `src/lib/audit.server.ts`:**
- Client-IP aus `X-Forwarded-For[0]` → fallback `X-Real-IP`, getrimmt, dann `isIP(candidate) !== 0` aus `node:net`; sonst `null`.
- `request_id` aus `X-Request-Id`.
- `emailHash`: `sha256(normalizedEmail)` — identisches Verfahren bei User existent/nicht existent.
- Fehler `console.error`, kein Rethrow. „Best effort" in `DEPLOYMENT.md`.

**Aufrufe (immer NACH der Aktion, mit korrektem `success`):** `login.success` / `login.failure`, `logout`, `trip.create`, `trip.update` (`{ slug, published }`), `trip.delete` (Slug VOR DELETE lesen), `image.upload`, `image.update`, `image.delete` (Pfad + `trip_id` VOR DELETE lesen). **Keine Klartext-E-Mail, keine Tokens, keine Bodies** in `metadata`.

**Retention:** Doku in `DEPLOYMENT.md` (365d success / 90d failure). Auto-Cleanup in v0.5.6.

## 4. Backup — atomar, aufräumend, mit Verzeichnis-Mount

### 4.1 Dockerfile (kein ENTRYPOINT)

`docker/backup/Dockerfile`:

```dockerfile
FROM postgres:16.6-alpine
RUN apk add --no-cache bash gnupg tar gzip coreutils findutils
COPY scripts/backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh
```

### 4.2 Compose — Verzeichnis-Mount statt einzelner Datei

`docker-compose.yml`, Service `backup`:

```yaml
backup:
  build:
    context: .
    dockerfile: docker/backup/Dockerfile
  container_name: nahundfern-backup
  restart: unless-stopped
  depends_on:
    db: { condition: service_healthy }
  environment:
    PGHOST: db
    PGPORT: "5432"
    PGUSER: ${DB_USER}
    PGPASSWORD: ${DB_PASSWORD}
    PGDATABASE: ${DB_NAME}
    BACKUP_KEEP_DAYS: ${BACKUP_KEEP_DAYS:-14}
    BACKUP_INTERVAL_SECONDS: ${BACKUP_INTERVAL_SECONDS:-86400}
    BACKUP_GPG_RECIPIENT: ${BACKUP_GPG_RECIPIENT:-}
    BACKUP_REQUIRE_ENCRYPTION: ${BACKUP_REQUIRE_ENCRYPTION:-false}
  volumes:
    - backups:/backups
    - uploads:/var/www/uploads:ro
    - ./secrets:/etc/backup:ro
  command:
    - /bin/bash
    - -c
    - |
      while true; do
        if /usr/local/bin/backup.sh; then
          date -u +%FT%TZ > /tmp/backup-last-success
          rm -f /tmp/backup-last-failure
        else
          date -u +%FT%TZ > /tmp/backup-last-failure
          echo "backup: run failed" >&2
        fi
        sleep "${BACKUP_INTERVAL_SECONDS}"
      done
  networks: [internal]
```

**Host-Setup** (in `DEPLOYMENT.md`):
```bash
mkdir -p secrets && chmod 700 secrets
# optional:
cp /pfad/zum/public-key.asc secrets/backup-pubkey.asc
```

`.gitignore`:
```
secrets/*
!secrets/.gitkeep
```
`secrets/.gitkeep` wird commited.

**Env-Empfehlung:**
- Produktion: `BACKUP_GPG_RECIPIENT=<keyid>` + `BACKUP_REQUIRE_ENCRYPTION=true`.
- test2/dev: `BACKUP_REQUIRE_ENCRYPTION=false`, GPG optional.

### 4.3 `scripts/backup.sh` (Ersatz — aufräumend)

```bash
#!/usr/bin/env bash
set -euo pipefail

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
OUT=/backups
mkdir -p "$OUT"

DB_FILE="$OUT/db-${STAMP}.sql.gz"
UP_FILE="$OUT/uploads-${STAMP}.tar.gz"
DB_PART="${DB_FILE}.part"
UP_PART="${UP_FILE}.part"
DB_GPG_PART=""
UP_GPG_PART=""
GNUPG_TEMP=""
SUCCESS=false

cleanup() {
  rm -f "$DB_PART" "$UP_PART" "$DB_GPG_PART" "$UP_GPG_PART"
  if [ "$SUCCESS" != "true" ]; then
    # Ganzen Run entfernen: entweder alles fertig oder nichts.
    rm -f "$DB_FILE" "$UP_FILE" "${DB_FILE}.gpg" "${UP_FILE}.gpg"
  fi
  [ -n "$GNUPG_TEMP" ] && rm -rf "$GNUPG_TEMP" || true
}
trap cleanup EXIT

# 0) Verschlüsselungspflicht
if [ "${BACKUP_REQUIRE_ENCRYPTION:-false}" = "true" ] && [ -z "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "backup: BACKUP_REQUIRE_ENCRYPTION=true but BACKUP_GPG_RECIPIENT is empty" >&2
  exit 1
fi

# 1) GPG-Voraussetzungen prüfen
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  if [ ! -r /etc/backup/backup-pubkey.asc ]; then
    echo "backup: BACKUP_GPG_RECIPIENT is set, but /etc/backup/backup-pubkey.asc is missing" >&2
    exit 1
  fi
  GNUPG_TEMP=$(mktemp -d)
  export GNUPGHOME="$GNUPG_TEMP"
  gpg --batch --import /etc/backup/backup-pubkey.asc
  gpg --batch --list-keys "$BACKUP_GPG_RECIPIENT" >/dev/null
fi

# 2) DB
pg_dump --clean --if-exists --no-owner --no-privileges | gzip -9 > "$DB_PART"
gzip -t "$DB_PART"
mv "$DB_PART" "$DB_FILE"

# 3) Uploads
tar -C /var/www/uploads -czf "$UP_PART" .
tar -tzf "$UP_PART" >/dev/null
mv "$UP_PART" "$UP_FILE"

FINAL=("$DB_FILE" "$UP_FILE")

# 4) Optional verschlüsseln — beide GPG-Dateien erst am Ende veröffentlichen
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  DB_GPG_PART="${DB_FILE}.gpg.part"
  UP_GPG_PART="${UP_FILE}.gpg.part"

  gpg --batch --yes --trust-model always --encrypt \
      --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$DB_GPG_PART" "$DB_FILE"
  test -s "$DB_GPG_PART"

  gpg --batch --yes --trust-model always --encrypt \
      --recipient "$BACKUP_GPG_RECIPIENT" \
      --output "$UP_GPG_PART" "$UP_FILE"
  test -s "$UP_GPG_PART"

  mv "$DB_GPG_PART" "${DB_FILE}.gpg"; DB_GPG_PART=""
  mv "$UP_GPG_PART" "${UP_FILE}.gpg"; UP_GPG_PART=""

  rm -f "$DB_FILE" "$UP_FILE"
  FINAL=("${DB_FILE}.gpg" "${UP_FILE}.gpg")
fi

# 5) Retention erst nach erfolgreichem Lauf
find "$OUT" -type f \( -name 'db-*.sql.gz*' -o -name 'uploads-*.tar.gz*' \) \
  -mtime "+${BACKUP_KEEP_DAYS:-14}" -print -delete

SUCCESS=true
echo "backup: done (${FINAL[*]})"
```

## 5. Request-ID — nginx ohne Header-Vererbungsbruch

**Regel:** `add_header X-Request-Id` steht **nur im Serverblock** (dort erben normale Locations mit); Locations, die bereits eigene `add_header` haben, wiederholen die kompletten Header inklusive Request-ID.

**`nginx/conf.d/site.conf`** (HTTPS-Serverblock):

```nginx
server {
    listen 443 ssl;
    ...
    server_tokens off;
    client_max_body_size 25M;

    include /etc/nginx/snippets/security-headers.conf;
    include /etc/nginx/snippets/hsts.conf;
    add_header X-Request-Id $request_id always;

    location /uploads/ {
        alias /var/www/uploads/;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header X-Request-Id $request_id always;
        include /etc/nginx/snippets/security-headers.conf;
        include /etc/nginx/snippets/hsts.conf;
        try_files $uri =404;
    }

    location = /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
    }

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-Id $request_id;
        proxy_read_timeout 60s;
        # kein add_header hier — Serverblock-Header werden geerbt
    }
}
```

**`nginx/conf.d.selfsigned/site.conf`:** identisch, aber **ohne** HSTS-Include.
**`nginx/conf.d.http/site.conf`:** `add_header X-Request-Id $request_id always;` im Serverblock; `proxy_set_header X-Request-Id $request_id;` in beiden Proxy-Locations. Keine Security-Header-Includes (Front-Proxy setzt sie in test3).

## 6. Login-Timing-Härtung

`src/routes/api/auth/login.ts`:

```ts
// Vorab einmalig generierter Argon2id-Hash für ein zufälliges, weggeworfenes Passwort.
// Zweck: konstante CPU-Kosten für nicht existente User, damit die Antwortzeit
// keine User-Existenz preisgibt.
const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$<base64salt>$<base64hash>";
```

Ablauf identisch für existent/nicht existent: `verifyPassword(realOrDummyHash, submittedPassword)` → Fehler `"Invalid credentials"` (401). `emailHash` identisch berechnet. Audit `login.success` oder `login.failure` in beiden Zweigen.

## 7. Tests im selben Batch — nur Vitest

`bun add -d vitest @vitest/coverage-v8` (falls fehlend). `package.json`: `"test": "vitest run"`.

**Unit-Tests:**
- `src/lib/__tests__/auth.origin.test.ts` — GET erlaubt; POST ohne/fremd/kaputt → 403; POST expected mit Trailing-Slash → ok (Normalisierung); `Sec-Fetch-Site: cross-site` → 403; `same-origin` → ok. `PUBLIC_BASE_URL` per `vi.stubEnv`.
- `src/routes/api/auth/__tests__/login.test.ts`, `logout.test.ts` — CSRF-Blocker + Legit-Login → 401 (nicht 403) + Logout `Set-Cookie: Max-Age=0`.
- `src/routes/api/studio/__tests__/trips.test.ts` — Slug (`toskana-`, `-toskana`, `toskana--2026` → 400), `endDate < startDate` → 400, POST mit `coverImageId` → 400, PATCH fremdes `coverImageId` → 400.
- `src/lib/__tests__/audit.test.ts` — Insert-Fehler → aufrufende Aktion bleibt 200; `X-Forwarded-For` mit `not-an-ip` → `ip = null`; `emailHash` identisch für existent/nicht existent; **`JSON.stringify(metadata)` enthält keine Klartext-E-Mail** (`.not.toContain(email)`).

**Backup-Tests (`.github/workflows/ci.yml`, neuer Job `backup-smoke`):**
- `bash -n scripts/backup.sh` + `shellcheck scripts/backup.sh`.
- Auf Ubuntu-Runner mit `services: postgres`:
  1. Ohne GPG: zwei Läufe mit `sleep 1` dazwischen → zwei getrennte Dateipaare.
  2. `BACKUP_GPG_RECIPIENT` gesetzt, Schlüsseldatei fehlt → exit 1, keine finalen Dateien.
  3. `BACKUP_REQUIRE_ENCRYPTION=true` + leerer Recipient → exit 1.
  4. `pg_dump`-Fehler (PGHOST unerreichbar) → keine `db-*.sql.gz`, keine `.part`-Reste.
  5. Retention: `touch -d '30 days ago'` auf Alt-Datei + neuer Lauf → alte weg, neue bleibt.

**Deployment-Verifikation (manuell nach Rollout):**
```bash
curl -kI https://nahundfern.servuswir.de/
curl -kI https://nahundfern.servuswir.de/uploads/<beliebiges-webp>
```
Beide Responses müssen enthalten: `X-Request-Id`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, in Produktion zusätzlich `Strict-Transport-Security` (in test2 nicht).

CSRF:
```bash
curl -X POST -H 'Origin: https://evil.example' https://…/api/auth/login   # → 403
curl -i -X POST -H 'Origin: https://nahundfern.servuswir.de' \
     -H 'Sec-Fetch-Site: same-origin' -H 'Content-Type: application/json' \
     --data '{"email":"x@y.z","password":"nope"}' \
     https://nahundfern.servuswir.de/api/auth/login                        # → 401
```

## 8. Version + Deploy

`package.json` → `0.5.5`.

```bash
cd /opt/nahundfern
git pull
# neue ENV setzen:
#   PUBLIC_BASE_URL=https://nahundfern.servuswir.de
#   BACKUP_GPG_RECIPIENT=<optional>
#   BACKUP_REQUIRE_ENCRYPTION=true  (Produktion)
mkdir -p secrets && chmod 700 secrets   # falls noch nicht vorhanden
docker compose -f docker-compose.yml -f docker-compose.test2.yml down
docker compose -f docker-compose.yml -f docker-compose.test2.yml build --no-cache app backup
./scripts/run.sh test2
```

Footer zeigt `v0.5.5`; `audit_log` füllt sich; `docker compose exec backup /usr/local/bin/backup.sh` erzeugt Timestamped-Paar; zweiter Lauf überschreibt nichts; `X-Request-Id` in allen Responses.

## Explizit nicht enthalten (v0.5.6+)

- Off-Site-Upload (rclone/S3/SFTP nach Zielwahl).
- Automatische Audit-Retention (`DELETE FROM audit_log WHERE …`).
- Backup-Healthcheck, der `/tmp/backup-last-success` als „zu alt" erkennt (Datei-Schreibvorgang ist bereits vorhanden — Auswertung folgt).
- Widerrufbare Sessions (`session_version`), CSP Report-Only, Rollenmodell.
- GC verwaister Uploads, Trivy/Gitleaks/Dependabot, Container-Härtung.
- Account-basiertes Rate-Limit + exponentielles Backoff.
