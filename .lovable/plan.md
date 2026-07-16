# Plan: Sicherheits- & Qualitätsverbesserungen v0.5.0 (final)

## 1. Uploads & Bildverarbeitung (`src/lib/uploads.server.ts`)

**EXIF/Metadaten-Leak beheben**
- `.withMetadata({ orientation: undefined })` ersatzlos entfernen. Sharp schreibt EXIF ohne `withMetadata()` nicht in die Ausgabe → keine GPS-Daten, Kamera-Seriennummer, Aufnahmezeit im gespeicherten Original.

**Bildmaße nach Rotation korrekt speichern**
- `output.width` / `output.height` aus dem `OutputInfo`-Rückgabewert von `.toFile()` verwenden. `metadata()` liefert bei Hochkant-Handybildern vertauschte Werte.

**Eingangs-Whitelist + echte HEIC→JPEG-Konvertierung**
- Whitelist: `jpeg`, `png`, `webp`, `avif`, `heif`. GIF explizit ablehnen mit klarer Fehlermeldung; TIFF und alle anderen Formate ablehnen.
- HEIC/HEIF wird echt konvertiert: Sharp liest HEIF, Ausgabe erzwungen `.jpeg({ quality: 92, mozjpeg: true })`, Extension `.jpg`, MIME `image/jpeg`. `originalDiskPath` erst nach Festlegung der finalen Extension bauen.
- Getrennte Maps `FORMAT_TO_EXT` und `FORMAT_TO_MIME` (nur Ausgabeformate).
- **Keine zweite `.rotate()`** beim Erzeugen der webp/avif-Varianten — das Original ist bereits physisch rotiert und EXIF-frei.
- **Manueller HEIC-Test** beim Release: echtes iPhone-HEIC hochladen, verifizieren dass libvips (bereits über `vips-dev` installiert) HEIF dekodiert.

**Cleanup bei Fehlern in der Pipeline**
- Alle geplanten Zielpfade vorab in `potentialFiles: string[]` sammeln (Original + webp/avif pro Größe).
- Ganze Pipeline in `try`; im `catch` `Promise.allSettled(potentialFiles.map(fs.unlink))`, dann Fehler weiterwerfen. Deckt auch teilweise geschriebene Dateien ab.

## 2. Story-Seite (`src/routes/stories.$slug.tsx` + `src/lib/trips.functions.ts`)

**Nur eine öffentliche Basis-URL — `VITE_PUBLIC_BASE_URL`**
- Neuer Helper `getPublicBaseUrl()` liest ausschließlich `import.meta.env.VITE_PUBLIC_BASE_URL`, normalisiert per `new URL().origin`, validiert http/https, fällt bei Fehlkonfiguration auf `https://nahundfern.servuswir.de` zurück. Kein `process.env` in gemeinsam gebündeltem Code.
- `Dockerfile` bekommt `ARG VITE_PUBLIC_BASE_URL` + `ENV`-Export vor `bun run build`.
- `docker-compose.yml`: `build.args.VITE_PUBLIC_BASE_URL: ${PUBLIC_BASE_URL:-https://nahundfern.servuswir.de}`. Runtime-`PUBLIC_BASE_URL` bleibt unverändert für rein serverseitigen Code.
- `.env.example` dokumentiert beide Varianten.

**Absolute Social- und Canonical-URLs**
- `storyUrl = new URL('/stories/' + encodeURIComponent(slug), baseUrl).toString()`.
- `coverUrl` analog aus `t.cover.webp[1200]`.
- Ergänzte Meta-Tags: `og:image`, `og:url`, `twitter:image`, `og:type: article`, `twitter:card: summary_large_image`.
- Canonical als `links: [{ rel: 'canonical', href: storyUrl }]` (nicht ins `meta`-Array).

**Nicht-zyklische Navigation mit klarer Semantik**
```ts
const index = navigationEntries.findIndex(e => e.slug === trip.slug);
const newer = index > 0 ? navigationEntries[index - 1] : null;
const older = index >= 0 ? (navigationEntries[index + 1] ?? null) : null;
```
- Footer-Layout mit 3 Spalten: links `newer` (oder leerer Platzhalter), Mitte immer „Alle Reisen", rechts `older` (oder leerer Platzhalter). Kein asymmetrisches Umschalten.
- Beschriftungen: „Neuere Reise: {title}" / „Ältere Reise: {title}".

**Schmale Navigations-Query**
- Neue Server-Fn `listTripNavigationEntries` selektiert nur `slug` + `title`.
- SQL: `ORDER BY COALESCE(trip_start_date, created_at::date) DESC, created_at DESC` (stabiler Zweitschlüssel).
- Loader lädt `getPublishedTrip` und `listTripNavigationEntries` parallel via `Promise.all`.

**„Nicht gefunden" per `null` statt Fehlerklasse**
- `getPublishedTrip` liefert `PublicTrip | null` (keine `TripNotFoundError`-Klasse — umgeht Serialisierungs-Fallstricke bei `createServerFn`).
- Loader:
  ```ts
  const [trip, navigationEntries] = await Promise.all([...]);
  if (!trip) throw notFound();
  return { trip, navigationEntries };
  ```
- Ergebnis: fehlende Story → sauberer 404; DB-/Programmierfehler werden geworfen und landen in Error-Boundary / 500-Middleware.

## 3. nginx Security-Header via Snippets

**Zwei getrennte Snippets** unter `nginx/snippets/`:

`security-headers.conf`:
```
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy        "strict-origin-when-cross-origin" always;
add_header Permissions-Policy     "camera=(), microphone=(), geolocation=()" always;
add_header X-Frame-Options        "DENY" always;
```

`hsts.conf`:
```
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

`docker-compose.yml`: zusätzlicher Read-Only-Mount `./nginx/snippets:/etc/nginx/snippets:ro`.

Include-Verwendung (absolute Pfade):
- `nginx/conf.d/site.conf` (produktive TLS): `server_tokens off;` + `include /etc/nginx/snippets/security-headers.conf;` + `include /etc/nginx/snippets/hsts.conf;` — **sowohl im `server`-Block als auch im `location /uploads/`-Block** (der eigene `add_header Cache-Control` würde sonst die Vererbung durchbrechen).
- `nginx/conf.d.selfsigned/site.conf`: nur `security-headers.conf`, **kein HSTS** (selbstsigniertes Zertifikat + HSTS blockiert lokale Tests dauerhaft).
- `nginx/conf.d.http/site.conf`: `server_tokens off;`; Header hier wenig nützlich (Redirect zu HTTPS), Snippet-Include optional.

**Verifikation nach Deployment**:
- `curl -I https://.../` (Root)
- `curl -I https://.../uploads/webp/…` (Location mit eigenem `add_header`)
- `curl -I https://.../nicht-vorhanden` (Fehlerpfad)
- Prüfen: HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-Frame-Options, Cache-Control.

CSP bleibt bewusst außen vor (späterer Report-only-Rollout).

## 4. CI + reproduzierbare Bun-Version

`package.json`:
```json
"typecheck": "tsc --noEmit",
"check": "bun run typecheck && bun run lint && bun run build"
```

**Feste Bun-Version an drei Stellen**: die aktuelle lokale Bun-Version wird ermittelt und als Konstante `BUN_VERSION` konsistent gesetzt in:

- `.github/workflows/ci.yml` → `oven-sh/setup-bun@v2` mit `bun-version: <fixiert>`
- `Dockerfile` → `ARG BUN_VERSION=<fixiert>` + `RUN npm install -g bun@${BUN_VERSION}` statt `npm i -g bun`
- `docker-compose.yml` → `build.args.BUN_VERSION: ${BUN_VERSION:-<fixiert>}`
- `.env.example` dokumentiert `BUN_VERSION`

CI-Workflow-Struktur:
- Trigger: `push`, `pull_request`
- `permissions: { contents: read }`, `concurrency` mit Cancel auf `github.ref`, `timeout-minutes: 15`
- Getrennte Steps: `install --frozen-lockfile` → `typecheck` → `lint` → `build` (für Diagnose)
- `env: VITE_PUBLIC_BASE_URL: https://nahundfern.servuswir.de` beim Build
- Kein Deploy, keine Secrets nötig.

## 5. Versionierung als Build-Konstante

- Single Source of Truth: `package.json` → `"version": "0.5.0"`.
- `vite.config.ts`:
  ```ts
  import packageJson from "./package.json";
  export default defineConfig({
    define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
    // ...
  });
  ```
- `src/vite-env.d.ts`: `declare const __APP_VERSION__: string;`
- `SiteFooter.tsx`: `<span>v{__APP_VERSION__}</span>` — kein manuelles Nachziehen mehr, keine künstliche `import.meta.env.VITE_APP_VERSION`-Variable.
- Release-Hinweis an den Nutzer: `package.json` und Git-Tag `v0.5.0` gemeinsam bewegen (Tagging läuft außerhalb der Lovable-Umgebung).

## Nicht enthalten (bewusst später)

- Off-Site-Backup (NAS/S3) und Test-Restore
- Vollständige CSP (erst Asset-Inventar, Report-only-Rollout)
- Vitest / E2E-Testsuite
- Weitere DB-Query-Optimierungen

## Technische Fallstricke — kompakt

- **`add_header`-Vererbung in nginx**: sobald ein `location` eigene `add_header` hat, verwirft er alle server-level Header → Snippets in JEDEM solchen Block per `include` erneut einbinden.
- **HSTS + selbstsigniertes Zertifikat**: HSTS speichert HTTPS-Pflicht im Browser → nur in produktive TLS-Konfig, nicht in `conf.d.selfsigned`.
- **`includeSubDomains`**: wirkt nur unterhalb der gesetzten Host-Ebene; `nahundfern.servuswir.de` betrifft nur `*.nahundfern.servuswir.de`, nicht Geschwister-Subdomains.
- **Sharp `.toFile()` OutputInfo** enthält `width`/`height` nach Rotation.
- **HEIC-Ausgabepfad**: `originalDiskPath` erst nach Ermittlung der finalen Extension bauen.
- **`null`-Rückgabe statt Fehlerklasse**: TypeScript-Typ `PublicTrip | null`, Loader macht den `notFound()`-Throw — kein `instanceof` über die RPC-Grenze.
- **`VITE_PUBLIC_BASE_URL`**: Vite bettet zur Build-Zeit ein — Runtime-`PUBLIC_BASE_URL` allein reicht für Client-Bundle nicht; deshalb Build-Arg im Dockerfile.
- **Bun-Version**: einheitlich in CI, Dockerfile, Compose-Args, `.env.example`.
