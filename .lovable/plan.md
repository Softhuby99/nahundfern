
# v0.6.0 — Ops-Cockpit, Userverwaltung, Video-Upload

Vier Themenblöcke. Reihenfolge = Umsetzungsreihenfolge. Version-Bump am Ende auf **v0.6.0**.

---

## Block 1 — Video-Upload & Anzeige im Reisebericht

### Datenmodell (Migration `005_add_videos.sql`)

Eigene Tabelle `videos`, nicht in `images` mischen (unterschiedliche Metadaten, Poster, Dauer, MIME).

```sql
CREATE TABLE videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  original_path text NOT NULL,   -- /uploads/videos/originals/<uuid>.mp4
  mp4_720_path  text NOT NULL,   -- H.264/AAC, faststart
  poster_path   text NOT NULL,   -- JPEG-Frame aus 1s
  width         int NOT NULL,
  height        int NOT NULL,
  duration_ms   int NOT NULL,
  bytes         bigint NOT NULL,
  mime          text NOT NULL,
  alt           text,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_videos_trip ON videos(trip_id, sort_order);
```

### Backend

- **`Dockerfile`**: `ffmpeg` per apk/apt hinzufügen (~60 MB Image-Zuwachs, akzeptabel).
- **`src/lib/videos.server.ts`** (neu): `storeVideo(buffer, filename)`
  - `ffprobe` → Dauer, Codec, Auflösung. Reject wenn `duration > 60s` oder `bytes > 150 MB` oder Container nicht in `[mp4, mov, webm]`.
  - `ffmpeg -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -movflags +faststart -vf scale='min(1280,iw)':-2` → `mp4_720_path`.
  - Poster: `ffmpeg -ss 00:00:01 -frames:v 1 -q:v 4` → JPEG.
  - Alle Ausgaben unter `/app/uploads/videos/{originals,mp4,poster}/<uuid>.*`.
- **`src/routes/api/studio/videos.ts`** (neu, Muster wie `images.ts`):
  - `POST` (multipart, `tripId` UUID-validiert, Trip-Existenz vor Verarbeitung, Cleanup bei Insert-Fehler).
  - `GET ?tripId=`.
  - `PATCH` (alt, sortOrder), `DELETE`.
  - Alle Writes: `requireSameOrigin` + `requireAuth` + `auditLog`.
- **`src/lib/trips.functions.ts`**: `getTripBySlug` liefert `videos` mit; JS-side gefiltert wie bei Bildern.

### nginx

- `nginx/conf.d/site.conf` + `conf.d.selfsigned/site.conf`: In `location /uploads/videos/` `mp4`-MIME sicherstellen (bereits ok via nginx-Default), `client_max_body_size 160m;` im `server`-Block auf mind. 160 MB. Byte-Ranges sind nginx-default.

### Frontend

- **`src/components/trip/VideoPlayer.tsx`** (neu): `<video controls preload="metadata" poster={poster}>` + `<source src=mp4 type=video/mp4>`. Kein Autoplay, `playsinline`, `aria-label`.
- **`src/routes/stories.$slug.tsx`**: Sektion „Videos" unterhalb der Galerie, sortiert wie Bilder.
- **`src/routes/admin.studio.$slug.tsx`**: Neuer Uploader mit ProgressBar (gleiches Muster wie Bilder), Liste vorhandener Videos mit Delete + Reorder.

---

## Block 2 — Admin-Dashboard (System-Status)

Neue Route **`/admin/studio/system`** (auth-geschützt via `_authenticated`-Gate bzw. `admin.tsx` beforeLoad).

### Server: `src/routes/api/studio/system-status.ts`

Aggregiert (alle read-only, kein `supabaseAdmin` nötig — reines Postgres/FS):

- **App**: Version aus `import.meta.env`, Node/Bun-Version, Uptime (`process.uptime()`).
- **Datenbank**:
  ```sql
  SELECT pg_database_size(current_database()) AS db_bytes;
  SELECT count(*) FROM trips; SELECT count(*) FROM images; SELECT count(*) FROM videos; SELECT count(*) FROM users;
  SELECT pg_postmaster_start_time();
  ```
- **Uploads**: `fs.stat` + rekursive Größe von `/app/uploads/{originals,webp,avif,videos}` (mit Cache 60 s, damit große Volumes den Endpoint nicht blockieren).
- **Backups**: Liest `/backups` (Volume in App-Container read-only mounten — neuer Mount in `docker-compose.yml`: `backups:/backups:ro`), listet die letzten 10 DB- und Upload-Dumps mit Größe + mtime, markiert „gültig" wenn > 1 KB.
- **nginx**: kein Live-Check aus App-Container möglich → stattdessen `GET /api/health` von nginx aus (bereits vorhanden) plus statische Info „Reverse-Proxy: nginx (siehe `docker compose ps`)". Kein Deep-Check.

### UI: `src/routes/admin.studio.system.tsx`

Karten-Layout (existierendes shadcn `Card`):
- **App-Version & Uptime** | **DB-Größe & Tabellen-Counts** | **Uploads-Größe** | **Backup-Liste** (Tabelle: Datei, Größe, Alter, Typ DB/Uploads, Status-Badge) | **Health** (grün wenn `/api/health` = ok).
- Auto-Refresh via `useQuery` mit `refetchInterval: 30000`.
- Link im Studio-Header: „System".

### Backup/Restore-Handling (transparent, kein Trigger aus UI)

Reine Anzeige — echtes Restore bleibt bewusst CLI:
- **Plan**: „Täglich 04:15 UTC im `backup`-Container".
- **Retention**: aus `BACKUP_KEEP_DAYS`.
- **Speicherort**: `backups`-Volume + Host-Pfad (`docker volume inspect nahundfern_backups`).
- **Restore-Anleitung** als aufklappbarer Block auf der Seite (kopierbare Befehle für DB und uploads).

Restore aus dem UI zu triggern lehne ich bewusst ab: destruktive Operation, RCE-Oberfläche, muss auditierbar CLI bleiben.

---

## Block 3 — Userverwaltung

Neue Route **`/admin/studio/users`**.

### Server: `src/routes/api/studio/users.ts`

Alle Handler: `requireAuth` + `requireSameOrigin` + `auditLog`.

- `GET` → Liste `{id, email, created_at, last_login_at}` (kein `password_hash`).
- `POST` → neuen User anlegen. Zod: `email` (RFC-valid, ≤ 255), `password` (≥ 12 Zeichen, min. 1 Zahl + 1 Buchstabe). Argon2id via `hashPassword`.
- `PATCH /:id` → E-Mail ändern **oder** Passwort setzen. Wenn Passwort: gleiche Regeln; wenn E-Mail: Unique-Check.
- `DELETE /:id` → Löschen. **Selbst-Löschung verbieten** (`id === session.userId → 400`). **Letzten User verbieten** (`SELECT count(*) FROM users` = 1 → 400).

### Migration `006_add_users_last_login.sql`

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_ip text;
```

`api/auth/login.ts` bei Erfolg: `UPDATE users SET last_login_at=now(), last_login_ip=$1 WHERE id=$2`.

### UI: `src/routes/admin.studio.users.tsx`

- Tabelle: E-Mail, angelegt, letzter Login, Aktionen.
- Modals (shadcn `Dialog`): „Neuer User", „E-Mail ändern", „Passwort setzen", „Löschen" (mit Bestätigung + Warnung wenn Selbst).
- Sichtbare Regel: „Der zuletzt eingeloggte User kann nicht gelöscht werden."

### Absicherung

Aktuell ist **jeder eingeloggte User = Admin** (keine Rollen). Für diese Version bewusst so gelassen: die Userverwaltung ist automatisch nur für Eingeloggte erreichbar. Rollen (`user_roles` + `has_role`) sind ein späterer Batch — würde jetzt Scope sprengen. In den Code-Kommentaren markieren.

---

## Block 4 — Erweitertes Audit-Logging

`audit_log`-Tabelle und `auditLog()` existieren bereits. Erweitern:

### Neue Actions

Zusätzlich zu bestehenden (`auth.login.success/failure`, `auth.logout`, `trip.*`, `image.*`):

- `video.upload`, `video.update`, `video.delete` (in Block 1 direkt).
- `user.create`, `user.update.email`, `user.update.password`, `user.delete` (in Block 3 direkt).
- `trip.publish` / `trip.unpublish` — separat vom generischen `trip.update`, damit Status-Wechsel eindeutig auffindbar sind. In `api/studio/trips.ts` beim PATCH prüfen ob `published` sich ändert und einen zweiten `auditLog`-Eintrag schreiben.

### Login-Anzeige & Audit-Übersicht

Zwei neue Studio-Routen (in vorheriger Runde bereits geplant, jetzt umsetzen):

- **`/admin/studio/logins`** — Filter auf `action IN ('auth.login.success','auth.login.failure')`, Spalten: Zeit, Aktion, `email_hash` (verkürzt), IP, User-Agent, `request_id`. Keyset-Pagination via `created_at, id`.
- **`/admin/studio/audit`** — Filter (Action-Dropdown, `request_id`-Suche, User-Filter, Zeitraum), gleiche Pagination.

Backend-Route: `src/routes/api/studio/audit.ts` mit `GET` (auth), Zod-validierten Query-Params (`action?`, `requestId?`, `userId?`, `before?` ISO, `limit ≤ 100`).

### Logging-Policy (dokumentieren in `DEPLOYMENT.md`)

Was wird geloggt: **alle Auth-Events**, **alle Schreiboperationen auf trips/images/videos/users**, **Publish/Unpublish**. Was NICHT: GET-Requests, Klartext-Passwörter, JWTs, Klartext-Emails (nur `email_hash`). Retention: keine automatische Löschung in v0.6.0 (Tabelle wächst langsam), Log-Bereinigungsjob in späterem Batch.

---

## Technische Details / Risiken

- **FFmpeg im App-Image**: Erhöht Build-Zeit spürbar. Video-Transcoding blockiert den Worker während der Verarbeitung — für v0.6.0 akzeptabel (Uploads sind selten), spätere Queue via BullMQ/pg-boss möglich.
- **`backups`-Volume in App**: read-only Mount reicht für die Anzeige. Kein Restore-Trigger aus UI.
- **`system-status` FS-Scans**: bei sehr vielen Uploads teuer → 60 s In-Memory-Cache im Server-Handler.
- **User-Löschung + Foreign Keys**: `users.id` wird nirgends referenziert außer `audit_log.user_id` (ON DELETE SET NULL) — sicher.
- **Version-Bump**: `package.json` → `0.6.0`, Footer & Studio zeigen automatisch.
- **CI**: Vitest-Tests aus v0.5.8-Plan bleiben; neue Tests für `videos.server` (Reject-Fälle: zu lang, zu groß, falsches Format) und `users.ts` (Selbst-Löschung, letzter User).

## Bewusst außen vor

- Rollen/Permissions (RBAC) — eigener Batch.
- Restore-Trigger aus UI — Sicherheitsrisiko, bleibt CLI.
- Video-Untertitel/HLS/AV1 — später, MP4/H.264 reicht als Baseline.
- 2FA für Admin-Login — eigener Batch.
