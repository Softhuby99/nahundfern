# v0.7.0 — Reiseroute auf der Weltkarte (Polarsteps-Stil)

## Was gebaut wird

Jede Reise bekommt **Stationen** (z. B. München → Verona → Rom). Stationen liegen auf einer drehbaren 3D-Weltkarte (OpenStreetMap-Daten via MapLibre, Globus-Ansicht), verbunden durch gestrichelte Bögen. Jede Station hat Name, Ankunft/Abreise, eigenen Text, eigene Bilder und Videos sowie ein rundes Mini-Bild als Marker.

Getroffene Entscheidungen:

- Karte: MapLibre GL mit Globus-Projektion, Kacheln von OpenFreeMap (kostenlos, kein Key). Die Kartenquelle ist eine einzige Einstellung (`VITE_MAP_STYLE_URL`), damit später ein selbst gehosteter Kachelserver eingetragen werden kann.
- Routenlinie: gestrichelte Großkreis-Bögen zwischen aufeinanderfolgenden Stationen, kein Straßen-Routing.
- Bestehender Bericht-Text + Galerie bleiben als Einleitung; Stationen kommen darunter. Alte Reisen ohne Stationen sehen aus wie heute (keine Karte).
- Reihenfolge: manuell (Pfeile hoch/runter) plus Button „nach Ankunftsdatum sortieren“.
- Marker-Bild: pro Station explizit wählbar; Fallback: erstes Stationsbild; ohne Bild nummerierter Punkt.
- Sichtbarkeit: Haken „Veröffentlicht“ pro Station. Unveröffentlichte Stationen werden öffentlich nur **angedeutet**: grauer, halbtransparenter Marker ohne Bild, gepunktete Linie dorthin, im Text ein gedämpfter Platzhalter „Station N – folgt“ (nur Name, kein Text/Bilder, kein Datum). Der Trip-Schalter „Veröffentlicht“ bleibt übergeordnet.

## Öffentliche Berichtsseite (`/stories/<slug>`)

Layout ab Desktop: **links** die Stationen untereinander (Name, Datum, Text, Bilder mit Lightbox, Videos), **rechts** die Karte, die beim Scrollen stehen bleibt. Auf dem Handy: Karte oben fixiert (ca. 40 % Höhe), Stationen darunter.

- Beim Öffnen: kurze Animation – die Route zeichnet sich Station für Station, Kamera folgt (ca. 1 s pro Abschnitt, max. ~8 s gesamt), Klick/Tap überspringt; bei „weniger Bewegung“ (Systemeinstellung) sofort komplett.
- Beim Scrollen fliegt die Karte zur gerade gelesenen Station; der aktive Marker wird größer.
- Klick auf Marker scrollt zur Station. Buttons „Ganze Route“, Zoom +/−.
- Marker = rundes Mini-Bild (aus vorhandener 400px-Variante), Nummer als kleines Badge.
- Sofort-Fallback ohne JavaScript/vor dem Laden: Stationenliste ist normaler HTML-Text (SEO, Barrierefreiheit). Die Karte lädt erst im Browser.

## Neue Seite „Karte“ (`/map`, Menüpunkt zwischen Timeline und Reiseberichte)

Globus mit **einem Marker pro veröffentlichter Reise** am Zielort: standardmäßig die letzte veröffentlichte Station; im Editor kann pro Reise eine andere Station als „Zielort“ markiert werden. Marker zeigt das Cover als rundes Bild; Klick öffnet eine kleine Karte mit Titel/Zeitraum und Link zum Bericht. Reisen ohne Stationen nutzen die bestehenden Trip-Koordinaten, wenn vorhanden.

## Studio-Editor (Bearbeiten einer Reise)

Neuer Abschnitt „Reiseroute“ unter den bisherigen Feldern:

- Karte (gleiche Komponente) mit allen Stationen, links daneben die Stationsliste.
- Station anlegen per **Ortssuche** (Eingabefeld mit Vorschlägen, z. B. „München“), per **Klick auf die Karte** (Name wird per Rücksuche vorgeschlagen) – Marker anschließend per **Drag** verschiebbar.
- Pro Station: Name, Land (automatisch vorbelegt), Ankunft, Abreise, Text (Markdown), Veröffentlicht-Haken, „Zielort dieser Reise“-Haken, Marker-Bild wählen.
- Bilder: Upload direkt in die Station (mit Fortschrittsbalken wie heute) oder „Aus Galerie zuordnen“ (Auswahl-Dialog; Bild wandert in die Station, „Zurück in Galerie“ möglich). Reihenfolge per Pfeile.
- Videos: bestehender Video-Editor bekommt eine Zuordnung zur Station (Auswahlfeld pro Video).
- Reihenfolge: Pfeile + „nach Datum sortieren“. Löschen mit Rückfrage; Bilder/Videos der Station wandern zurück in die allgemeine Galerie (werden nicht gelöscht).
- Speichern der Stationen erfolgt einzeln (pro Station „Speichern“) – unabhängig vom großen Trip-Speichern, damit nichts verloren geht.

Die Ortssuche läuft über deinen Server (Nominatim von OpenStreetMap, 1 Anfrage/s, Ergebnis-Cache), nur eingeloggt nutzbar, mit Eingabeverzögerung – die Nutzungsregeln von OSM erlauben das für diesen Umfang.

## Zu beachten (Kosten, Datenschutz, Betrieb, GPS)

- **GPS-Tracking nicht nötig:** Echtes Tracking (Handy-App, die den Weg automatisch aufzeichnet) wäre ein eigenes App-Projekt mit Standort-Freigaben. Der Plan setzt Stationen bewusst von Hand – schneller, exakter, privatsphärefreundlich.
- **GPX-Import (Option für später):** Wer Tracks aus Komoot, Garmin & Co. hat, kann später einen GPX-Upload ergänzen, der daraus Stationen ableitet. Im Datenmodell ist das mitgedacht; jetzt noch nicht umgesetzt.
- Keine Kosten, keine Accounts. Besucher-Browser laden Kartenkacheln von openfreemap.org (Hinweis in der Datenschutzerklärung ergänzen: IP-Adresse geht an OpenFreeMap). Später austauschbar gegen eigenen Kachelserver (~80 GB Planet-Daten + Container).
- Kartenbibliothek ist ~250 KB zusätzlich – wird nur auf Seiten mit Karte und erst im Browser geladen (SSR-sicher).
- Backup: keine neuen Dateiordner; Stationsbilder liegen im bestehenden `uploads`-Volume, Migration ist Teil des normalen Migrationslaufs.
- Datenschutz Fotos: EXIF wird wie bisher entfernt; Standort kommt nur aus der manuell gesetzten Station.
- OSM-Nutzungsregeln: Ortssuche serverseitig gedrosselt (1 req/s, Cache) – für deine Bearbeitungs-Frequenz ausreichend.

## Technische Details

**Migration `008_trip_stations.sql`**

- Tabelle `trip_stations`: `id`, `trip_id` (FK, cascade), `name`, `country_code`, `latitude`, `longitude` (NOT NULL), `arrival_date`, `departure_date` (date, null), `body_md` (default ''), `sort_order` int, `published` bool default false, `is_destination` bool default false, `marker_image_id` (FK images, set null), `created_at`, `updated_at`. Check `departure_date >= arrival_date`. Index `(trip_id, sort_order)`. Partieller Unique-Index: ein `is_destination` pro Trip.
- `images` und `videos`: neue Spalte `station_id uuid NULL REFERENCES trip_stations ON DELETE SET NULL`, Index. NULL = allgemeine Galerie (bestehendes Verhalten). Trigger/Check in der API stellt sicher, dass Station und Bild zum selben Trip gehören.
- `db/schema.sql` entsprechend nachziehen.

**API (Studio, alle mit `requireAuth` + `requireSameOrigin` + Audit-Log)**

- `src/routes/api/studio/stations.ts`: GET (Liste je tripId), POST, PATCH, DELETE, plus `reorder` (Array von IDs) und `assign-media` (imageId/videoId → stationId|null mit Trip-Gleichheitsprüfung).
- `src/routes/api/studio/geocode.ts`: GET `?q=` (Suche) und `?lat=&lon=` (Rücksuche) → Nominatim mit `User-Agent`, `accept-language=de`, serverseitige Warteschlange 1 req/s, In-Memory-Cache 24 h, max 5 Ergebnisse. Zod-Validierung, nie ungefiltert durchreichen.
- `images.ts` POST akzeptiert optional `stationId`; `videos.ts` ebenso.

**Öffentliche Daten (`src/lib/trips.functions.ts`)**

- `PublicTrip` erhält `stations: PublicStation[]` (nur `published`, sortiert; unveröffentlichte als `{ id, name, latitude, longitude, teaser: true }` ohne Text/Medien/Datum), pro Station `images`/`videos`, `markerImage` (400er-Variante), `destinationStationId`.
- Galerie/Videos der Einleitung = nur Medien mit `station_id IS NULL`.
- Neue Serverfunktion `listMapTrips` für `/map`: Slug, Titel, Zeitraum, Cover-400, Zielkoordinate (Destination-Station → letzte veröffentlichte Station → Trip-Koordinaten).
- `/gallery` zeigt weiterhin alle Bilder (inkl. Stationsbilder), Untertitel um Stationsname ergänzt.

**Frontend-Komponenten**

- `src/components/map/RouteMap.tsx` (browser-only, `React.lazy` + `<ClientOnly>`): MapLibre GL, `projection: globe`, Style aus `VITE_MAP_STYLE_URL` (Default OpenFreeMap „liberty“), Großkreis-Bögen (Turf `greatCircle`), Linie gestrichelt (`line-dasharray`), Teaser-Segmente gepunktet/grau, HTML-Marker mit rundem `<img>` + Nummer, Props: `stations`, `activeIndex`, `onSelect`, `editable` (Klick/Drag), `animateIntro`. Respektiert `prefers-reduced-motion`. Kein Import dieser Datei aus SSR-Routen außer via lazy.
- `src/components/map/route-geometry.ts` (SSR-sicher): Typen + Bogenberechnung, gemeinsam für Public und Studio.
- `src/components/trip/StationTimeline.tsx`: Stationenliste links, IntersectionObserver meldet aktive Station an die Karte; Sticky-Container rechts (`lg:sticky top-24 h-[calc(100vh-7rem)]`), mobil `sticky top-16 h-[40vh]`.
- `src/components/studio/StationEditor.tsx`: Liste + Formular + Ortssuche (cmdk-Combobox, 400 ms Debounce) + Medienzuordnung; eingebunden in `admin.studio.$slug.tsx` unter der Galerie. `VideoEditor` bekommt Prop `stations` für das Zuordnungsfeld.
- `src/routes/map.tsx`: Seite „Karte“ mit eigenem `head()`; `SiteHeader` Nav-Eintrag `{ to: "/map", label: "Karte" }`.
- Lightbox wird pro Station wiederverwendet.

**Pakete**: `maplibre-gl`, `@turf/great-circle` (klein). CSS von MapLibre per `<link>` im Root-Head bzw. Import in der lazy Komponente.

**Betrieb**

- `.env.example`: `VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty` (Build-Arg in docker-compose wie `VITE_PUBLIC_BASE_URL`), `GEOCODER_USER_AGENT=nahundfern.servuswir.de (kontakt@…)`.
- nginx: keine Änderung nötig (Geocoding läuft über die App; Kacheln direkt vom Browser). CSP-Snippet um `img-src`/`connect-src https://tiles.openfreemap.org` ergänzen.
- Tests: Unit-Test für Bogengeometrie und Sortierlogik; Integrations-Test für Stations-API (Trip-Gleichheitsprüfung bei Medienzuordnung, Destination-Eindeutigkeit).
- Version-Bump auf **v0.7.0**, Deployment wie gewohnt (`git pull`, `build --no-cache`, `run.sh`), Migration 008 läuft automatisch.

## Umsetzungsreihenfolge

1. Migration 008 + Schema + Public/Studio-Datenfunktionen.
2. Stations-API + Geocoding-Proxy.
3. RouteMap-Komponente (Globus, Bögen, Marker, Animation).
4. Studio-StationEditor inkl. Medienzuordnung.
5. Öffentliche Berichtsseite (Split-Layout, Scroll-Sync, Teaser-Stationen).
6. Seite „Karte“, Nav, Datenschutz-Hinweis, Tests, Version.
