## Ziel (v0.6.1)

Video-Upload in der Reisebericht-Bearbeitung + kleiner, robuster Editor: Metadaten, **nicht-destruktives** Trimmen (immer aus dem Original), freies Poster. Serverseitige Job-Beanspruchung ohne offene DB-Transaktion während ffmpeg.

## 1. Migration `007_video_editing.sql`

```sql
ALTER TABLE videos
  ADD COLUMN trim_start_ms         integer,
  ADD COLUMN trim_end_ms           integer,
  ADD COLUMN poster_at_ms          integer,        -- Zeit im ORIGINAL
  ADD COLUMN original_duration_ms  integer,        -- nullable, lazy nachtragen
  ADD COLUMN video_version         integer NOT NULL DEFAULT 1,
  ADD COLUMN poster_version        integer NOT NULL DEFAULT 1,
  ADD COLUMN processing            boolean NOT NULL DEFAULT false,
  ADD COLUMN processing_started_at timestamptz,
  ADD COLUMN processing_token      uuid;

ALTER TABLE videos ADD CONSTRAINT videos_trim_pair_check CHECK (
  (trim_start_ms IS NULL AND trim_end_ms IS NULL)
  OR (trim_start_ms IS NOT NULL AND trim_end_ms IS NOT NULL
      AND trim_start_ms >= 0 AND trim_end_ms > trim_start_ms)
);
ALTER TABLE videos ADD CONSTRAINT videos_poster_at_check CHECK (
  poster_at_ms IS NULL OR poster_at_ms >= 0
);
```
Getrennte `video_version` / `poster_version`, damit Poster-Wechsel keine Video-Datei umbenennt.

## 2. Dateilayout — versionierte Pfade, temp im selben Volume

```
videos/originals/<id>.<ext>              # unantastbar, Basis jedes Re-Trim
videos/mp4/<id>_v<video_version>.mp4
videos/mp4/.tmp/<id>-<uuid>.mp4          # → rename() atomar (gleiches Volume)
videos/poster/<id>_v<poster_version>.jpg
videos/poster/.tmp/<id>-<uuid>.jpg
```

## 3. Job-Beanspruchung ohne lange DB-Transaktion

Kein `pg_try_advisory_xact_lock` (würde Transaktion 60–120 s offenhalten).

**Claim** (kurze Transaktion, sofort committen):
```sql
UPDATE videos
   SET processing = true,
       processing_started_at = now(),
       processing_token      = $token
 WHERE id = $id
   AND (processing = false
        OR processing_started_at < now() - interval '5 minutes')
RETURNING *;
```
Keine Zeile → HTTP **409**. Danach TX beenden, dann ffmpeg starten.

**Release** (nur eigener Lock):
```sql
UPDATE videos
   SET processing = false, processing_token = NULL, processing_started_at = NULL
 WHERE id = $id AND processing_token = $token;
```

**Aufräumen abgestürzter Jobs** beim App-Start in `src/lib/videos.server.ts`:
```sql
UPDATE videos SET processing=false, processing_token=NULL, processing_started_at=NULL
 WHERE processing=true AND processing_started_at < now() - interval '10 minutes';
```

**Nach dem Claim erneut lesen** — nie auf Werte vertrauen, die vor dem Lock geladen wurden (Trim/Poster/Version können sich geändert haben).

## 4. Endpunkte — eigene Routendateien

TanStack Start: Dot-Naming, dieselbe URL-Basis:
```
src/routes/api/studio/videos.ts          # GET (list), POST (upload), PATCH (metadata), DELETE
src/routes/api/studio/videos.trim.ts     # POST  /api/studio/videos/trim
src/routes/api/studio/videos.poster.ts   # POST  /api/studio/videos/poster
```
Jede Route: `requireSameOrigin` + `requireAuth` + Zod-UUID + eigener Audit-Eintrag (`video.update|trim|poster|delete`).

## 5. Atomarer Verarbeitungsablauf

1. Claim (§3).
2. Row **erneut lesen**, Trim/Poster-Werte validieren gegen `original_duration_ms` (falls NULL → jetzt via `ffprobe` auf Original nachtragen und speichern).
3. `ffmpeg` in `videos/mp4/.tmp/<id>-<uuid>.mp4` schreiben.
4. `ffprobe` auf Ausgabe: Dauer > 0, ≥1 Videostream.
5. `fs.rename` in `videos/mp4/<id>_v<video_version+1>.mp4` (atomar, gleiches Volume).
6. **Kurze** DB-Transaktion: `mp4_720_path`, `video_version+1`, `duration_ms`, `bytes`, `trim_start_ms`, `trim_end_ms` (+ ggf. Poster-Felder wenn im selben Job neu gerendert) setzen.
7. Nach Commit: alte `_v<N>.mp4` **best-effort** löschen (Fehler nur loggen, Request bleibt erfolgreich).
8. Release-Update (§3), in `finally`.
9. Bei jedem Fehler vor Commit: temporäre Datei entfernen, DB unverändert.

Analog für Poster: `_v<poster_version+1>.jpg`, Validierung via `sharp().metadata()` (width>0, height>0, `format==='jpeg'`).

## 6. ffmpeg — exaktes Re-Encode

`spawn("ffmpeg", […])`, nie Shell-Konkatenation. Kein `-c copy`.
```
-hide_banner -nostdin
-i <originalPath>
-ss <startSec> -t <durationSec>            # start/dauer, nach -i
-map 0:v:0 -map 0:a:0?                     # Audio optional
-sn -dn -map_metadata -1
-vf scale=min(1280\,iw):-2:flags=lanczos,format=yuv420p
-c:v libx264 -preset veryfast -crf 23
-c:a aac -b:a 128k
-movflags +faststart
-y <tmpPath>
```
Zeitlimit 120 s (`setTimeout` + `child.kill('SIGKILL')`), stdout/stderr auf ~10 KB begrenzt.

**Request-Abbruch (v0.6.1, einfache Variante):** `AbortSignal` → ffmpeg killen, Temp entfernen, `409/499`-Doku im Endpoint-Kommentar. Persistente Server-Jobs bleiben v0.7.

**Eingabe-Grenzen (via ffprobe vor Verarbeitung):** ≤3840×2160, ≤120 fps, genau 1 Videostream, max. 1 Audiostream übernommen; sonst 422.

## 7. Poster-Semantik

- UI-Slider = **sichtbare** (getrimmte) Zeit.
- Server: `posterAtSource = (trim_start_ms ?? 0) + atMs`, gespeichert als `poster_at_ms` (Originalzeit). Rendering aus Original.
- Nach Trim: `poster_at_ms` außerhalb `[trim_start_ms, trim_end_ms]`? → automatisch `trim_start_ms + min(1000, newDuration/2)` und Poster im selben Job neu rendern (beide Versionen inkrementieren).
- **Trim-Reset** (`{startMs:null, endMs:null}`, beide oder keiner — sonst 422): rendert Original neu, `trim_start_ms/trim_end_ms=NULL`, Poster bleibt.

## 8. Fehler-Statuscodes

| Fall | Code |
|---|---|
| Ungültiger Body / UUID | 400 |
| Video nicht gefunden | 404 |
| Upload zu groß | 413 |
| Start/Ende/Poster ungültig, Trim-Pair inkonsistent, Rest <1 s, Auflösung/FPS zu hoch | 422 |
| In Bearbeitung | 409 |
| ffprobe/ffmpeg intern | 500 |
| ffmpeg-Timeout | 504 |

Deutsche `error`-Message im Body.

## 9. Nginx / Upload-Limits konsistent

In allen Site-Configs (`nginx/conf.d/site.conf`, `conf.d.http`, `conf.d.selfsigned`):
```
location ^~ /api/studio/videos {
  client_max_body_size 160m;
  proxy_connect_timeout 10s;
  proxy_send_timeout   180s;
  proxy_read_timeout   180s;
  proxy_pass http://app:3000;
}
```
App-seitig weiter hartes 150-MB-Limit, ffprobe-Dauer ≤ 60 s, ffmpeg-Timeout 120 s.

## 10. Editor-UI in `src/routes/admin.studio.$slug.tsx`

Neue Sektion **„Videos"** unter der Galerie:
- Upload (multi) mit `uploadWithProgress`; **zweiphasiger Status**: XHR-Progress 0–100 % → dann „Video wird verarbeitet …" bis Server-Antwort.
- Grid: Poster-Thumb (Cache-safe durch neuen Dateinamen), Dauer, Name.
- Editor-Panel pro Video:
  - Alt-Text, Reihenfolge → PATCH `/api/studio/videos`.
  - HTML5-Preview des aktuellen `mp4_720_path`.
  - **Trim**: Doppel-Slider auf `duration_ms` (bzw. `original_duration_ms` wenn kein Trim), Live-Seek, „Trim anwenden" / „Trim zurücksetzen" → POST `/videos/trim`.
  - **Poster**: Slider über sichtbare Dauer, „Aktuellen Frame als Poster" → POST `/videos/poster`.
  - Löschen → DELETE.
- Alle Buttons `disabled` während Requests; 409 → „Video wird bereits bearbeitet, bitte kurz warten".

## 11. Audit-Metadaten (keine Pfade, keine ffmpeg-Cmds)

```jsonc
// video.trim
{ "oldDurationMs":60000, "newDurationMs":11000,
  "trimStartMs":1000, "trimEndMs":12000,
  "videoVersion":3, "posterVersionBumped": false }
// video.poster
{ "posterAtMs":4500, "posterVersion":4 }
```

## 12. Tests (vitest)

`src/lib/videos.server.test.ts`, `src/routes/api/studio/*.test.ts`:
- Validierung: start<0, end>original, start≥end, Rest<1 s, ungültige UUID, fremde ID, Trim-Pair inkonsistent, Poster außerhalb, Auflösung/FPS über Limit.
- Sicherheit: fehlende Auth→401, fremde Origin→403, Client-Pfade ignoriert, ffmpeg-Args als Array (Regression).
- Verarbeitung (mit gemocktem `spawn`/`fs`): Trim erfolgreich → neue Version + Dauer/Bytes; ffmpeg-Fehler → DB unverändert, Temp weg; parallel → 409; Poster-Wechsel → nur `poster_version` steigt; Reset → `_v_next.mp4` aus Original, Trim-Spalten NULL.
- Cleanup: abgestürzter Job (`processing=true`, alt) wird nach 5 min übernommen.

**Zusätzlicher Integrationstest** `src/lib/videos.integration.test.ts` (separater Script-Eintrag `test:video-integration`):
- Kleine, selbst erzeugte 2 s-Fixture (H.264/AAC, ~200 KB) in `src/lib/__fixtures__/tiny.mp4`.
- Real-`ffmpeg` Trim auf 1 s → `ffprobe` prüft Dauer ~1 s, `codec_name=h264`, moov-atom vorne.
- Nur ausgeführt wenn `ffmpeg`/`ffprobe` auf `PATH` (skip sonst); im CI-Docker-Container aktiv.

`package.json`:
```json
"test": "vitest run",
"test:video-integration": "vitest run src/lib/videos.integration.test.ts"
```

## 13. Version-Bump

`package.json` → **v0.6.1**.

## Änderungen ggü. voriger Version

| Punkt | Alt | Neu |
|---|---|---|
| Lock | `pg_try_advisory_xact_lock` in offener TX | kurzer `UPDATE`-Claim + `processing_token` + 5-min-Takeover |
| Absturz-Schutz | keiner | Startup-Cleanup + Token-scoped Release |
| Temp-Verzeichnis | `os.tmpdir()` (EXDEV-Risiko) | `.tmp/` im selben Volume |
| Version | gemeinsame `media_version` | getrennt `video_version` / `poster_version` |
| Originaldauer | nicht gespeichert | `original_duration_ms` (lazy nachtragen) |
| Trim-Pair-Konsistenz | nur Server | zusätzlich CHECK-Constraint |
| Endpunkte | ein Handler | separate Dateien (`videos.ts`, `videos.trim.ts`, `videos.poster.ts`) |
| ffmpeg-Args | `-to`, Filter mit Quotes | `-t` Dauer, `-ss` nach `-i`, `-nostdin`, `-map 0:a:0?`, Filter ohne Quotes |
| Eingabe-Grenzen | keine | ≤4K, ≤120 fps, 1 V-/1 A-Stream |
| Nginx | nur `client_max_body_size` | zusätzlich `proxy_*_timeout 180s` für `/api/studio/videos` |
| Tests | nur Mocks | + realer ffmpeg-Smoke-Test mit Fixture |
