# Karte zeigt keine Marker/Routen — Diagnose & Behebung (v0.7.5)

## Bestätigte Ursache (per Live-Test ermittelt, nicht geraten)

Die Live-Seite `https://nahundfern.servuswir.de/map` liefert die Daten korrekt
(im Text steht z. B. „fdgdfg — 1 Station“), die Kartenfläche erscheint, aber es
werden **0 Marker und keine Routenlinie** gezeichnet.

Netzwerk-Mitschnitt der Live-Seite zeigt zwei Auffälligkeiten:

1. `404  /assets/maplibre-gl-worker.mjs`
2. `401  /api/auth/me`

- Nr. 2 (`/api/auth/me` → 401) ist **erwartet und harmlos**: man ist auf der
  öffentlichen `/map` nicht eingeloggt. Das blockiert die Karte nicht.
- Nr. 1 ist das eigentliche Problem: MapLibre braucht einen Web-Worker, um
  Layer/Marker zu rendern. Fehlt der Worker, wird die Karte nie „ready“, und
  die Effekte für Marker + Route laufen nie → 0 Marker.

Der Footer der Live-Seite zeigt **`v0.7.4`**. Im Repository ist bereits
**`v0.7.5`** (Commit `04027cd` / Merge `39be118` „Kartenhelfer im Serverpaket“),
das genau diesen Fehler behebt, indem der Worker per Vite-`?url`-Import
als versioniertes Build-Asset ausgeliefert und per `setWorkerUrl` gesetzt wird.

→ **v0.7.5 ist committed, aber noch nicht auf dem Server deployt.**
   Der Worker-Fix existiert also schon, er fehlt nur im laufenden Build.

Verifiziert im Repo:
- `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` existiert (maplibre-gl 6.8.0).
- `src/components/map/RouteMap.tsx` importiert diese Datei mit `?url` und ruft
  `maplibregl.setWorkerUrl(mapWorkerUrl)` auf — der kanonische Vite-Weg.

## Was zu tun ist

Es ist **keine Code-Änderung** nötig. v0.7.5 muss nur gebaut und gestartet werden.

Deployment auf dem Server (`/opt/nahundfern`):

```bash
cd /opt/nahundfern
git fetch origin
git status                      # nur zur Kontrolle
git reset --hard origin/main    # nur, wenn lokale Änderungen bewusst verworfen werden sollen
grep '"version"' package.json   # muss jetzt 0.7.5 zeigen
docker compose build --no-cache app
./scripts/run.sh test2          # oder prod
docker compose logs -f app      # kurz prüfen: Start ohne Fehler
```

Keine neue Datenbank-Migration nötig. Ein zweiter `run.sh`-Aufruf entfällt.

## Prüfung nach dem Deployment (was du mir vom WebServer geben kannst)

1. Versionsnummer bestätigen:
   ```bash
   grep '"version"' package.json
   ```
   → muss `0.7.5` sein.

2. Footer im Browser zeigt `v0.7.5` (ggf. Hard-Reload / Cache leeren).

3. Live-Worker ist erreichbar (hash-Präfix kann variieren):
   ```bash
   curl -sk -o /dev/null -w '%{http_code}\n' https://nahundfern.servuswir.de/assets/maplibre-gl-worker.mjs
   ```
   Hinweis: Mit v0.7.5 heißt die Datei typischerweise
   `/assets/maplibre-gl-worker-<hash>.mjs`. Den exakten Namen findest du z. B.:
   ```bash
   curl -sk https://nahundfern.servuswir.de/ | grep -oiE '/assets/[^"]*worker[^"]*\.mjs'
   ```
   → die gefundene URL muss `200` liefern.

4. `/map` im Browser: Marker erscheinen, Routenlinie sichtbar.

## Falls es nach dem Deploy immer noch 0 Marker gibt

Dann liefert der Build den Worker trotz `?url`-Import nicht aus. In dem Fall
ich zusätzlich eine robustere Worker-Einbindung (z. B. explizites Kopieren der
Worker-Datei in den Build-Output oder Nutzung des MapLibre-Vite-Worker-Plugins)
und vergebe v0.7.6.

## Notizen

- Datenpunkt ist vorhanden (Reise „fdgdfg“ mit 1 Station lädt korrekt in der
  Liste) — kein Datenbank-/Geocoding-Problem.
- Tile-Server (OpenFreeMap) antwortet 200, Style lädt — nur der Worker fehlt.
