# Self-Hosting-Architektur — nahundfern.servuswir.de

Alles in Docker, ein einziges `docker compose up -d` startet den kompletten Stack auf deinem Debian-12-Server.

## Gesamtarchitektur

```text
                 Internet :80 / :443
                          │
                          ▼
        ┌─────────────────────────────────┐
        │  nginx (Container)              │
        │  nahundfern.servuswir.de        │
        │  TLS via certbot-Volume         │
        │  /uploads/*  → statisch aus     │
        │               shared-Volume     │
        │  /*          → proxy app:3000   │
        └────────┬────────────────────────┘
                 │ intern (Docker-Netz)
                 ▼
   ┌──────────────────────────┐        ┌────────────────────┐
   │ app (Node 20)            │◀──────▶│ db (Postgres 16)   │
   │ TanStack Start SSR       │  :5432 │ Volume: pgdata     │
   │ + /api/* Server-Routes   │        └────────────────────┘
   │ + sharp (Thumbs WebP+AVIF)│
   │ schreibt → uploads-Volume│
   └────────┬─────────────────┘
            │
            ▼
   ┌──────────────────────────┐
   │ certbot (Container)      │  erneuert Let's-Encrypt-Zertifikate,
   │ läuft periodisch         │  teilt Volume mit nginx
   └──────────────────────────┘

   Gemeinsame Volumes:
     • uploads     → app schreibt, nginx liest
     • letsencrypt → certbot schreibt, nginx liest
     • pgdata      → nur db
```

Nach außen offen: nur Ports **80** und **443** auf nginx. `app` und `db` sind ausschließlich im internen Docker-Netz erreichbar.

## Container-Übersicht

| Service   | Image                | Zweck                                              | Volumes                          |
|-----------|----------------------|----------------------------------------------------|----------------------------------|
| `nginx`   | `nginx:alpine`       | Reverse-Proxy, TLS, statisches `/uploads`          | `uploads` (ro), `letsencrypt` (ro), `./nginx/conf.d` |
| `app`     | Eigenes Dockerfile   | SSR-App + API + Upload/Thumbnail-Pipeline          | `uploads` (rw)                   |
| `db`      | `postgres:16-alpine` | Datenbank                                          | `pgdata`                         |
| `certbot` | `certbot/certbot`    | TLS-Zertifikat, Auto-Renew                          | `letsencrypt`, `./certbot/www`   |

## Datenbank-Schema

Bilder liegen als **Dateien im Volume**, in Postgres stehen nur Pfade + Metadaten (klein, schnell, gutes Backup-Verhalten).

```sql
CREATE TABLE trips (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  title          text NOT NULL,
  kicker         text,
  region         text NOT NULL,        -- 'Europe' | 'North America' | ...
  where_text     text NOT NULL,
  when_text      text NOT NULL,
  month_label    text NOT NULL,
  who_text       text NOT NULL,
  excerpt        text NOT NULL,
  body_md        text NOT NULL,        -- Markdown, Absätze per Leerzeile
  cover_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  published      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        uuid REFERENCES trips(id) ON DELETE CASCADE,
  original_path  text NOT NULL,        -- /uploads/originals/<uuid>.jpg
  webp_400       text NOT NULL,
  webp_1200      text NOT NULL,
  webp_2000      text NOT NULL,
  avif_400       text NOT NULL,
  avif_1200      text NOT NULL,
  avif_2000      text NOT NULL,
  width          int  NOT NULL,
  height         int  NOT NULL,
  mime           text NOT NULL,
  alt            text,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,         -- argon2id
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

Migrations via einfacher SQL-Datei (`db/schema.sql`), ausgeführt beim App-Start wenn Tabellen fehlen.

## Bild-Pipeline (Upload → Thumbnails)

Für **jedes** hochgeladene Bild erzeugt `sharp` **6 Varianten**:
- WebP in 400 / 1200 / 2000 px
- AVIF in 400 / 1200 / 2000 px

Ablage:
```
/uploads/
  originals/<uuid>.<ext>
  webp/<uuid>_400.webp   <uuid>_1200.webp   <uuid>_2000.webp
  avif/<uuid>_400.avif   <uuid>_1200.avif   <uuid>_2000.avif
```

Im Frontend wird pro `<img>` ein `<picture>` mit AVIF-first, WebP-Fallback und `srcset` (400/1200/2000) gerendert. nginx liefert das ganze `/uploads/*` direkt mit `Cache-Control: public, max-age=31536000, immutable` aus (App wird dafür nicht geweckt).

EXIF-Rotation wird vor dem Resize angewendet (`.rotate()`), Metadaten werden gestrippt (Privatsphäre, kleinere Dateien).

## Admin-Bereich (`/studio`) — Reise-Editor

Ablösung des Demo-Passwort-Gates durch echten Login mit signiertem httpOnly-Cookie (JWT, HS256).

**Reise anlegen/bearbeiten** — ein Formular pro Reise:
- Basis: Titel, Slug, Region, Ort, Zeitraum, Monats-Label, Begleitung
- Teaser (kurz) + Reisebericht (Markdown, Absätze durch Leerzeile)
- **Cover-Bild** (Dropzone, Vorschau nach Upload)
- **Galerie** (Multi-Upload, Drag-zum-Umsortieren, Alt-Text pro Bild, Löschen)
- Toggle „Online stellen" (published)
- Speichern → `POST/PATCH /api/studio/trips`, Bilder → `POST /api/studio/images`
- Löschen entfernt Zeile + alle 7 Dateien (Original + 6 Thumbs) vom Volume

**Übersicht** — Liste aller Reisen mit Status (online/entwurf), Bearbeiten, Vorschau, Löschen.

**User-Verwaltung** — bewusst kein UI. Neuer Redakteur wird per CLI angelegt:
```bash
docker compose exec app node scripts/create-user.js redakteur@example.com
# fragt interaktiv das Passwort ab, hasht mit argon2id
```

## Was ich zusätzlich empfehle („was noch?")

1. **Sitemap + robots.txt** dynamisch aus DB — jede veröffentlichte Reise erscheint automatisch (`/sitemap.xml`, `/robots.txt` als Server-Routes).
2. **RSS-Feed** (`/feed.xml`) für die Reiseberichte — für Leser mit Feedreader.
3. **Impressum + Datenschutz** als statische Route-Stubs — für die deutsche Rechtslage nötig, sobald `nahundfern.servuswir.de` öffentlich ist.
4. **Health-Endpoint** (`/api/health`) — prüft DB-Verbindung; nginx-Healthcheck nutzt das.
5. **Rate-Limit auf `/api/auth/login`** — nginx-Direktive `limit_req_zone`, 5 Versuche/Minute pro IP, schützt vor Brute-Force.
6. **Automatisches DB-Backup** — kleiner `backup`-Container, führt nächtlich `pg_dump | gzip` in `/backups/` aus, hält 14 Tage vor. `uploads/` per `rsync`/`restic` extern sichern (Cron auf dem Host, nicht im Compose).
7. **Bild-Optimierung asynchron** — Upload gibt sofort das Original zurück, Thumbnails werden in einem `setImmediate`-Job erzeugt; Studio zeigt „Wird verarbeitet..." bis fertig. Bei 6 Varianten × 3–5 MB lohnt sich das.
8. **Deploy-Update-Skript** (`deploy.sh` auf dem Host): `git pull && docker compose build app && docker compose up -d`. Kein Runtime-Downtime für nginx/db.

## Konkrete Datei-Änderungen

**Neu:**
- `docker-compose.yml` (4 Services, 3 Volumes, 1 Netz)
- `Dockerfile` (Multi-Stage: Bun-Build → Node 20 Alpine Runner, non-root)
- `.dockerignore`, `.env.example`
- `nginx/conf.d/site.conf` (Vhost, TLS, `/uploads` statisch, Proxy, Rate-Limit)
- `nginx/Dockerfile` (falls Custom-Config nötig)
- `db/schema.sql`
- `scripts/create-user.js` (CLI: argon2id-Hash + INSERT)
- `scripts/seed.js` (übernimmt aktuelle 8 Demo-Reisen inkl. Bilder in die DB)
- `scripts/backup.sh` (für Backup-Container)
- `src/lib/db.server.ts` — `postgres`-Client (Singleton)
- `src/lib/uploads.server.ts` — sharp-Pipeline (WebP + AVIF, 3 Größen)
- `src/lib/auth.server.ts` — argon2id-Verify + JWT-Sign/Verify + Cookie
- `src/routes/api/auth/login.ts`, `logout.ts`
- `src/routes/api/studio/trips.ts` (`GET`/`POST`/`PATCH`/`DELETE`)
- `src/routes/api/studio/images.ts` (`POST`/`DELETE`/`PATCH` für sort/alt)
- `src/routes/api/health.ts`, `src/routes/sitemap[.]xml.ts`, `src/routes/feed[.]xml.ts`, `src/routes/robots[.]txt.ts`
- `src/routes/_admin/route.tsx` (auth-gate), `src/routes/_admin/studio.tsx`, `_admin/studio.$slug.tsx` (Editor)
- `src/routes/impressum.tsx`, `src/routes/datenschutz.tsx`
- `DEPLOYMENT.md` — komplette Schritt-Anleitung Debian 12

**Geändert:**
- `vite.config.ts` — Build-Target `node-server`
- `src/lib/studio-store.ts` — **entfernt** (localStorage weg, DB-basiert)
- `src/routes/index.tsx`, `timeline.tsx`, `stories.tsx`, `stories.$slug.tsx` — Loader ziehen aus DB via `/api/…`
- `src/components/HorizontalTimeline.tsx` — `<picture>` mit AVIF/WebP/srcset
- alter `/studio`-Pfad → Redirect nach `/_admin/studio`

**Neue npm-Pakete:** `postgres`, `sharp`, `argon2`, `jose`.

## Offene Punkte — bitte klären, bevor ich anfange

1. **Migration der aktuellen 8 Demo-Reisen**: Beim ersten Container-Start automatisch in die DB seeden (inkl. der KI-generierten Bilder aus `src/assets/`, die dann durch die Thumb-Pipeline laufen)? Oder mit leerer DB starten und du legst alles neu an?
2. **Certbot-Setup**: Beim ersten Deploy braucht certbot einen Bootstrap-Schritt (HTTP-01-Challenge, bevor TLS steht). Soll ich das in `DEPLOYMENT.md` als „Erst-Setup" beschreiben, oder ist dir lieber, du nutzt weiter certbot **auf dem Host** und ich baue nur einen HTTP-only-nginx-Container mit dokumentierter TLS-Terminierung außen herum? Erste Variante ist „alles in Docker", zweite ist einfacher zu debuggen.
3. **Umfang jetzt**: Soll ich alle Extras (Sitemap, RSS, Impressum-Stub, Health, Rate-Limit, Backup-Container, Async-Thumbs) direkt mitbauen — oder in Etappen (erst Kernstack: Docker + nginx + Postgres + Editor + Bilder, danach die Extras)?
