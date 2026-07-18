
# Plan v0.5.4 — CI reparieren, Security-Header wiederherstellen, Upload härten

Alle Punkte deiner Review, sortiert nach Wichtigkeit. Keine Änderungen an bereits funktionierender Logik (Galerie-Query, Story-Mapping, Editor-Mapping).

## 1. CI grün bekommen (höchste Priorität)

**`package.json`**
- `"typecheck": "tsc --noEmit"` ergänzen.
- Zusätzlich `"check": "bun run typecheck && bun run lint && bun run build"` als lokales Gate.
- Version auf `0.5.4` bumpen.

Der Workflow-Step `bun run typecheck` läuft dann durch, ohne die CI-Datei anzufassen.

## 2. nginx-Security-Header in Produktion wiederherstellen

**`docker-compose.yml`** (nginx-Service)
- Snippet-Verzeichnis mounten:
  ```yaml
  - ./nginx/snippets:/etc/nginx/snippets:ro
  ```

**`nginx/conf.d/site.conf`** (HTTPS-Serverblock)
- `server_tokens off;` (bereits vorhanden, prüfen).
- Auf Server-Ebene:
  ```
  include /etc/nginx/snippets/security-headers.conf;
  include /etc/nginx/snippets/hsts.conf;
  ```
- Im `location /uploads/` Block dieselben Includes wiederholen (wegen `add_header`-Vererbungsregel — das steht bereits als Kommentar drin, die Includes selbst prüfen und ggf. ergänzen).

Die Snippet-Dateien (`security-headers.conf`, `hsts.conf`) existieren bereits — nur Mount und Includes fehlen bzw. sind sicherzustellen.

Selfsigned-Config (`nginx/conf.d.selfsigned/site.conf`) bekommt nur `security-headers.conf`, **kein** HSTS (self-signed → HSTS würde die Domain für Nutzer sperren).

## 3. Upload-Endpunkt härten (`src/routes/api/studio/images.ts`)

Reihenfolge im `POST`-Handler ändern:
1. `tripId` mit Zod als UUID validieren (`z.string().uuid()`).
2. Existenz der Reise per `SELECT id FROM trips WHERE id = ...` prüfen → 404 wenn fehlend.
3. Erst danach `storeImage()` aufrufen.
4. DB-Insert in `try/catch`: bei Fehler `deleteImageFiles(stored)` aufrufen, damit keine Waisen zurückbleiben.

Die Client-MIME-Prüfung (`file.type.startsWith("image/")`) bleibt als billiger Vorfilter erhalten; die echte Prüfung erfolgt weiterhin in `storeImage()` über Sharp-Metadaten (bereits implementiert).

## 4. Galerie-Seite: Duplikate vermeiden (`src/routes/gallery.tsx`)

- `strip` verschiebt sich hinter das Bento:
  ```ts
  const strip = filtered.slice(5, 11);
  ```
- Fallback: falls weniger als 6 Bilder vorhanden sind, den „Lieblingsshots“-Streifen ausblenden statt leer zu rendern.

Keine neue Datenquelle (Favoriten-Flag existiert zwar in Migration 003, wird hier aber noch nicht eingeführt — bewusst außerhalb dieses Bugfix-Umfangs).

## 5. Version + Footer

- `package.json` → `0.5.4`.
- Footer zeigt automatisch die neue Version über die vorhandene Vite-Define-Injection.

## Nicht in diesem Plan

- Keine Änderungen an `getPublishedTrip`, `listPublishedTrips`, `stories.$slug.tsx`, `admin.studio.$slug.tsx` — deine Analyse bestätigt, dass diese Stellen aktuell korrekt sind.
- Keine Umstellung der Galerie auf ein separates „Featured"-Flag — größere Feature-Arbeit, nicht Teil des Bugfix-Sprints.

## Deployment nach Merge

```bash
cd /opt/nahundfern
git pull
docker compose -f docker-compose.yml -f docker-compose.test2.yml down
docker compose -f docker-compose.yml -f docker-compose.test2.yml build --no-cache app
./scripts/run.sh test2
```

Danach im Footer `v0.5.4` prüfen und in DevTools → Network die Response-Header einer beliebigen Seite ansehen: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` und (bei Produktions-nginx) `Strict-Transport-Security` müssen gesetzt sein.
