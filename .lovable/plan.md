# v0.7.0 — Reiseroute auf der Weltkarte (Polarsteps-Stil)

## Was gebaut wird

Jede Reise bekommt **Stationen** (z. B. München → Verona → Rom). Stationen liegen auf einer drehbaren 3D-Weltkarte (OpenStreetMap-Daten via MapLibre, Globus-Ansicht), verbunden durch gestrichelte Bögen. Jede Station hat Name, Ankunft/Abreise, eigenen Text, eigene Bilder und Videos sowie ein rundes Mini-Bild als Marker.

Grundentscheidungen:

- Karte: MapLibre GL mit Globus-Projektion, Kacheln von OpenFreeMap (kostenlos, kein Konto). Kartenquelle austauschbar über eine einzige Einstellung (`VITE_MAP_STYLE_URL`).
- Routenlinie: **Straßen-Routing** zwischen aufeinanderfolgenden Stationen (echter Straßenverlauf), gestrichelte Großkreis-Bögen als Alternative für Flug-/Fährabschnitte und als automatischer Ausweich, wenn keine Straßenroute möglich ist. Pro Abschnitt wählbar: Auto, Fahrrad, zu Fuß oder Flug/Bogen.
- Bisheriger Berichtstext + Galerie bleiben als Einleitung; Stationen kommen darunter. Reisen ohne Stationen sehen aus wie heute (keine Karte).
- Reihenfolge: manuell (Pfeile) plus Button „nach Ankunftsdatum sortieren“.
- Marker-Bild: pro Station wählbar; Fallback zur Laufzeit (erstes Stationsbild, sonst nummerierter Punkt).
- **Kein GPS-Tracking.** Stationen werden von Hand gesetzt – exakt, privat, ohne App. GPX-Import ist ausdrücklich Priorität 3.

## Datenschutz: unveröffentlichte Stationen sind vollständig verborgen

Verbindliche Regel für v0.7.0: Die öffentliche Antwort enthält **ausschließlich veröffentlichte Stationen** – keine ID, keinen Namen, keine Koordinaten, kein Datum, keine Medien und **keine Gesamtzahl**, die über die veröffentlichten Stationen hinausgeht. Die öffentliche Route endet bei der letzten veröffentlichten Station. Fortschrittsanzeigen („Station 3 von 8“) zählen nur öffentlich sichtbare Stationen. Ein anonymisierter Teaser („Nächste Station“) ist Priorität 3; würde er kommen, wird er als eigener Typ (Discriminated Union `PublicStation | TeaserStation`) modelliert, damit ein Zugriff auf Text/Bilder schon beim Kompilieren scheitert.

## Öffentliche Berichtsseite (`/stories/<slug>`)

Ab Desktop: **links** die Stationen untereinander (Name, Datum, Text, Bilder mit Lightbox, Videos), **rechts** die mitlaufende Karte. Mobil: Karte oben, 35–40 % der Fensterhöhe mit Mindest-/Maximalhöhe, Stationsliste darunter unabhängig scrollbar, Button „Zur Karte“.

- Beim Öffnen zeichnet sich die Route Station für Station, Kamera folgt. Dauer dynamisch: `min(8000, max(1500, stationCount * 450))` ms, jederzeit über sichtbaren Button „Animation überspringen“ abbrechbar; bei „weniger Bewegung“ sofort komplett. Einmalige Statusmeldung „Die Reiseroute wird angezeigt.“
- Beim Scrollen fliegt die Karte zur gelesenen Station, aktiver Marker wird größer. Zoomt oder verschiebt der Nutzer selbst, pausiert die automatische Nachführung kurz; ein Klick auf eine Station bewegt die Karte weiterhin gezielt.
- Klick auf Marker scrollt zur Station. Buttons „Ganze Route“ und Zoom +/− werden als eigene, designkonforme Schaltflächen umgesetzt (nicht MapLibres Standard-Control) und erfüllen die Tastatur-/Fokus-Anforderungen.
- Stationenliste ist normales HTML (SEO, funktioniert ohne Karte). Die Karte ist **nie** Voraussetzung für den Bericht: schlägt sie fehl, erscheint an ihrer Stelle eine verständliche Meldung mit „Erneut versuchen“, der Bericht bleibt vollständig nutzbar. Attribution wird angezeigt, sobald Karteninhalte sichtbar sind.

**Vor dem Split-Layout: kurzer Prototyp (halber Tag).** Zu klären: wirkt die Globus-Kamerafahrt in ~250 px Höhe sinnvoll oder unruhig? Ergebnis wird als Regel festgeschrieben – entweder Intro-Animation nur ab großem Bildschirm, oder mobil nur Linienaufbau ohne Kamerafahrt.

## Barrierefreiheit

- Stationsliste als semantische Abschnitte mit Überschriften, aktive Station mit `aria-current="true"`, jede Station mit Button „Auf Karte anzeigen“, komplett per Tastatur bedienbar.
- Marker sind echte Buttons mit sichtbarem Fokus und sprechendem Label („Station 2: Verona“), Enter/Leertaste aktivieren sie.
- Keine Information nur über Bewegung; `prefers-reduced-motion` wird respektiert.

## Neue Seite „Karte“ (`/map`, Menüpunkt neben Timeline)

Globus mit **einem Marker pro veröffentlichter Reise** am Zielort. Zielort-Reihenfolge: (1) manuell markierte, veröffentlichte Station, (2) letzte veröffentlichte Station, (3) bestehende Trip-Koordinaten, (4) keine Koordinate → Reise erscheint nicht auf `/map`. Eine unveröffentlichte Station wird nie öffentlicher Zielort.

Marker zeigt das Cover rund; Klick öffnet eine kleine Karte mit Titel/Zeitraum und Link zum Bericht. Der Menüpunkt bleibt immer sichtbar; gibt es keine Reise mit Kartenposition, bleibt der Globus sichtbar und zeigt: „Noch keine Reisen mit Kartenposition veröffentlicht.“

## Studio-Editor (Bearbeiten einer Reise)

Neuer Abschnitt „Reiseroute“:

- Karte mit allen Stationen (auch unveröffentlichten), daneben die Stationsliste.
- Station anlegen per **Ortssuche**, per **Klick auf die Karte**, Marker danach per **Drag** verschiebbar, Koordinaten immer auch manuell eingebbar (Breite −90…90, Länge −180…180).
- Schlägt die Rücksuche nach einem Kartenklick fehl, bleibt das Namensfeld **leer** (kein „Unbekannt“, keine Rohkoordinaten) – die Koordinaten werden übernommen.
- Pro Station: Name, Land (vorbelegt), Ankunft, Abreise, Text (Markdown), Haken „Veröffentlicht“, Haken „Zielort dieser Reise“, Marker-Bild.
- Bilder: Upload in die Station (mit Fortschritt, Abbrechen, Wiederholen) oder „Aus Galerie zuordnen“; jederzeit „Station ändern“ bzw. „In allgemeine Galerie verschieben“, optional Mehrfachauswahl, eigene Reihenfolge je Station, sichtbare Anzeige der Zuordnung. Eine Zuordnung entsteht erst nach erfolgreichem Upload.
- Videos: Zuordnungsfeld pro Video im bestehenden Video-Editor.
- Reihenfolge: Pfeile + „nach Datum sortieren“.
- Löschen mit Rückfrage, die benennt, **wie viele** Bilder und Videos betroffen sind; Medien wandern zurück in die allgemeine Galerie, werden nicht gelöscht.
- Speichern pro Station, mit klaren Zuständen „Speichern …“, „Gespeichert“, „Fehler“ und Wiederholen. Ein Fehler betrifft nur die betroffene Station; Eingaben bleiben erhalten.
- Bei Reisen mit vorhandenen Trip-Koordinaten und noch keiner Station: Button **„Trip-Koordinaten als erste Station übernehmen“** (legt eine unveröffentlichte Station an, Name per Rücksuche vorgeschlagen). Keine automatische Massenmigration.

Die Ortssuche läuft über deinen Server (Nominatim, nur eingeloggt, Eingabeverzögerung, Ergebnis-Cache).

## Betrieb, Datenschutz, Backup

- Keine Kosten, keine Konten. Besucher laden Kacheln von openfreemap.org → Datenschutzerklärung ergänzen (OpenFreeMap; Nominatim nur im Studio). Später gegen eigenen Kachelserver austauschbar.
- Kartenbibliothek lädt nur auf Kartenseiten und erst im Browser.
- Fotos: EXIF wird wie bisher entfernt. **Zusätzlich prüfen**, ob die Video-Pipeline GPS-Daten aus MP4/MOV-Containern (moov-Atom, Apple `©xyz`) entfernt – falls nicht, wird das ergänzt.
- Vor dem Deployment prüfen: Upload-Volume ist im Backup, Datenbank-Backup enthält Migration 008, gemeinsame Wiederherstellung von DB + Uploads funktioniert.

## Technische Details

**Migration `008_trip_stations.sql`**

- `trip_stations`: `id`, `trip_id` (FK cascade), `name`, `country_code char(2)`, `latitude`/`longitude` NOT NULL, `arrival_date`, `departure_date`, `body_md` default `''`, `sort_order int`, `published bool default false`, `is_destination bool default false`, `marker_image_id` (FK images ON DELETE SET NULL), `created_at`, `updated_at NOT NULL`.
- `CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date)`
- `CHECK (is_destination = false OR published = true)`
- `CREATE UNIQUE INDEX trip_stations_one_destination ON trip_stations (trip_id) WHERE is_destination = true;`
- Index `(trip_id, sort_order)`.
- `images` und `videos`: `station_id uuid NULL REFERENCES trip_stations(id) ON DELETE SET NULL` + Index. NULL = allgemeine Galerie.
- `db/schema.sql` nachziehen.
- `country_code`: ISO-3166-1 alpha-2, **immer lowercase** (`de`, `it`, `fr`), aus `address.country_code` von Nominatim, serverseitig auf zwei Zeichen validiert; unplausibel → leer und manuell editierbar.

**API (Studio; alle Mutationen mit `requireAuth`, `requireSameOrigin`, Zod, Trip-Zugehörigkeitsprüfung, Audit-Log; keine zustandsverändernden GETs)**

- `POST /api/studio/stations`, `PATCH /api/studio/stations/:id`, `DELETE /api/studio/stations/:id`
- `POST /api/studio/stations/reorder` — Array **aller** Stationen des Trips (vollständiger Ersatz). Fehlende, doppelte oder fremde IDs → `400` mit klarer Meldung; Neuvergabe der `sort_order` in einer Transaktion.
- `POST /api/studio/stations/:id/set-destination` — in einer Transaktion: alte Markierungen des Trips entfernen, Station als Ziel setzen, prüfen dass sie veröffentlicht ist und zum Trip gehört.
- `POST /api/studio/stations/assign-media` — `imageId`/`videoId` → `stationId | null`; prüft Existenz, Trip-Gleichheit von Medium und Station, Rechte.
- Alle Antworten liefern `updated_at` mit. Clients senden `expectedUpdatedAt`; die serverseitige `409 Conflict`-Prüfung ist vorbereitet, wird aber erst später scharf geschaltet (Priorität 2).
- Serverseitige Obergrenze **100 Stationen pro Reise**, sonst klare Fehlermeldung.
- Audit-Log erfasst: Anlegen, Ändern, Löschen, Reorder, Zielort-Wechsel, Wechsel von `published`, Medienzuordnung.
- `src/routes/api/studio/geocode.ts`: GET `?q=` und `?lat=&lon=` → Nominatim mit `User-Agent`, `accept-language=de`, Timeout, **globale** Warteschlange 1 req/s (Nominatim sieht die Server-IP; mehrere Redakteure teilen diese Schlange — Editor-Debounce darauf abgestimmt), Cache 24 h, max. 5 Ergebnisse, Antworten gefiltert, verständliche Fehlercodes, keine Speicherung vollständiger Suchtexte.
- `images.ts`/`videos.ts` POST akzeptieren optional `stationId`.

**Öffentliche Daten (`src/lib/trips.functions.ts`)**

```ts
type PublicStation = {
  id: string; name: string; countryCode: string | null;
  latitude: number; longitude: number;
  arrivalDate: string | null; departureDate: string | null;
  bodyMd: string; images: GalleryImage[]; videos: TripVideo[];
  markerImage: GalleryImage | null;
};
// PublicTrip erhält: stations: PublicStation[]; destinationStationId: string | null;
```

- Nur veröffentlichte Stationen; Filterung im SQL, nicht im Frontend.
- Einleitungsgalerie/-videos = Medien mit `station_id IS NULL`.
- Marker-Bild-Fallback **beim Rendern**: gewähltes Bild → erstes Stationsbild → nummerierter Punkt. Fehlt die 400px-Variante, wird der nummerierte Punkt genutzt (nie das Original).
- Neue Serverfunktion `listMapTrips` für `/map` mit der Zielort-Reihenfolge von oben.
- `/gallery` zeigt weiterhin alle Bilder; Untertitel um Stationsname ergänzt.

**Sortierung**

`sort_order` ist primär. „Nach Datum sortieren“: `arrival_date` aufsteigend, Stationen ohne Datum ans Ende; bei gleichem oder fehlendem Datum bleibt die bisherige Reihenfolge stabil (stabile Sortierung). Danach werden neue `sort_order`-Werte gespeichert.

**Straßen-Routing pro Abschnitt**

- Migration 008 erweitert `trip_stations` um `leg_mode text NOT NULL DEFAULT 'drive'` (`drive` | `cycle` | `walk` | `air`) und `leg_geometry jsonb NULL` — die Verbindung *zur jeweiligen Station von der vorherigen*. Die erste Station hat keinen Abschnitt.
- Die Straßenroute wird **einmalig im Studio berechnet und gespeichert** (nicht bei jedem Seitenaufruf). Neue Server-Route `POST /api/studio/stations/:id/route` (Auth, Same-Origin, Audit) holt die Geometrie über OSRM (öffentlicher Demo-Server `router.project-osrm.org`, austauschbar über `ROUTING_BASE_URL`; ein eigener OSRM-Container ist später möglich), vereinfacht sie serverseitig (Douglas-Peucker, Ziel ≤ 500 Punkte / ~50 KB je Abschnitt) und legt sie in `leg_geometry` ab. Timeout, serverseitiges Rate-Limit und Cache wie beim Geocoding.
- Neuberechnung automatisch beim Ändern von Koordinaten oder `leg_mode`, zusätzlich Button „Route neu berechnen“; Statusanzeige „berechne …“ / „gespeichert“ / „nicht möglich“.
- Fallback-Kette beim Zeichnen: `leg_geometry` → Großkreis-Bogen. `leg_mode = 'air'`, fehlgeschlagenes Routing, keine Landverbindung (z. B. über den Atlantik) oder Abschnitte über ~2000 km ergeben automatisch den gestrichelten Bogen. Ein fehlendes Routing blockiert nie die Anzeige.
- Darstellung: Straßenabschnitte durchgezogen, Flug-/Bogenabschnitte gestrichelt, Abschnitte zu unveröffentlichten Stationen entfallen öffentlich vollständig.
- Öffentlich wird nur die gespeicherte Geometrie ausgeliefert; die Besucherseite fragt **keinen** externen Routing-Dienst. Datenschutzerklärung nennt OSRM als Studio-Dienst.

**Routengeometrie / Antimeridian**

`src/components/map/route-geometry.ts` (SSR-sicher) liefert `LineString | MultiLineString` — sowohl für gespeicherte Straßengeometrie als auch für berechnete Bögen. Linien, die den 180. Längengrad kreuzen, werden dort in getrennte Segmente geteilt (`@turf/great-circle` mit MultiLineString-Ausgabe bzw. Split der Straßengeometrie). Auch die Kamerafahrt nimmt den kurzen Weg über die Datumsgrenze. Tests: Tokio→San Francisco, Auckland→Santiago, Station exakt auf ±180, Route mit mehreren Kreuzungen.

**Frontend-Komponenten**

- `src/components/map/RouteMap.tsx` (browser-only via `React.lazy` + `<ClientOnly>`): MapLibre `projection: globe`, Style aus `VITE_MAP_STYLE_URL`, HTML-Marker als Buttons mit rundem Bild + Nummer, Props `stations`, `activeIndex`, `onSelect`, `editable`, `animateIntro`; eigener Fehlerzustand mit Retry; Marker werden aktualisiert, nicht neu erzeugt.
- `src/components/trip/StationTimeline.tsx`: Liste links, IntersectionObserver für die aktive Station, Sticky-Container rechts (`lg:sticky top-24`), mobil begrenzte Höhe.
- `src/components/studio/StationEditor.tsx`: Liste, Formular, Ortssuche (Debounce), Medienzuordnung; eingebunden in `admin.studio.$slug.tsx`. `VideoEditor` erhält Prop `stations`.
- `src/routes/map.tsx` mit eigenem `head()`; Nav-Eintrag „Karte“ in `SiteHeader`.
- Lightbox wird pro Station wiederverwendet.

**Pakete**: `maplibre-gl`, `@turf/great-circle`, `@turf/simplify` (Geometrie-Vereinfachung).

**Konfiguration**: `.env.example` + docker-compose Build-Arg `VITE_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/liberty`, `GEOCODER_USER_AGENT=…`, `ROUTING_BASE_URL=https://router.project-osrm.org`. CSP-Snippet um `img-src`/`connect-src https://tiles.openfreemap.org` ergänzen (OSRM nur serverseitig, daher keine CSP-Änderung nötig).

**Tests**

- Unit: Großkreis + Antimeridian-Fälle, ungültige Koordinaten, Sortierung (inkl. fehlende/gleiche Daten), Datumsvalidierung, Zielort-Fallback, Filterung veröffentlichter Stationen, Routen mit 0/1/2 Stationen, Marker-Fallback-Kette inkl. fehlender 400px-Variante, Fallback Straßengeometrie → Bogen, Vereinfachung hält die Punktobergrenze ein.
- API/Integration: Auth, Same-Origin, Trip-Gleichheit bei Medienzuordnung, `station_id = NULL` setzen, Station löschen, Zielort-Eindeutigkeit, unveröffentlichten Zielort ablehnen, Reorder mit fremden/fehlenden/doppelten/unvollständigen IDs, Geocoding-Cache/Rate-Limit/Timeout, Routing-Timeout und „keine Route möglich“, `leg_mode = 'air'` erzeugt keinen OSRM-Aufruf, Public-Payload ohne jede Spur unveröffentlichter Stationen (auch keine Gesamtzahl), Stationsobergrenze.
- E2E: Karte lädt, alte Reise ohne Stationen bleibt funktional, Markerklick, Scroll-Sync, Animation überspringen, Reduced Motion, Station anlegen/bearbeiten/löschen, Medien hin und zurück, mobile Ansicht, `/map` Empty State.

**Logging**: Fehler bei Geocoding (inkl. Timeout/Rate-Limit), Stationsspeicherung, Medienzuordnung; Kartenfehler clientseitig. Keine vollständigen Suchtexte, keine privaten Koordinaten ohne Grund. Kein Analytics.

## Nicht Bestandteil von v0.7.0

GPS-Tracking, automatische Trackaufzeichnung, GPX-Import und Trackpunkt-Speicherung, eigener OSRM-Server (vorbereitet, aber nicht Teil dieser Version), Zwischenwegpunkte innerhalb eines Abschnitts, Höhenprofile, Offline-Karten, mehrere Routen pro Reise, Many-to-Many-Medien, AR, KI-Stationsvorschläge, eigene URLs pro Station, Kommentare/Social, Analytics-Dashboard, 3D-Gebäude/POIs, automatische Migration bestehender Trip-Koordinaten (nur der Ein-Klick-Weg), anonymisierter Teaser, Undo-Toast, Clustering, Batch-Speichern aller Stationen.

## Umsetzungsreihenfolge

1. Migration 008 + Schema + öffentliche/Studio-Datenfunktionen (inkl. Sichtbarkeitsregel).
2. Stations-API (inkl. Reorder-, Zielort- und Medien-Semantik) + Geocoding-Proxy mit Fallback.
3. `route-geometry.ts` inkl. Antimeridian + Straßen-/Bogen-Fallback + Unit-Tests; Routing-Endpunkt mit Vereinfachung und Speicherung.
4. RouteMap-Komponente (Globus, Bögen, Marker als Buttons, Fehlerzustand, Animation).
5. Studio-StationEditor inkl. Medienzuordnung und Ein-Klick-Übernahme.
6. **Prototyp mobile Kartenanimation**, dann öffentliche Berichtsseite (Split-Layout, Scroll-Sync).
7. Seite „Karte“ mit Empty State, Nav, Datenschutz-Hinweis, Video-Metadaten-Prüfung, Backup-Check, Tests, Version **v0.7.0**.
