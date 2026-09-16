# Studio-Editor: Speichern, Bearbeiten pro Station, Textformatierung, Orte auf der Karte

## Was sich für dich ändert

**Speichern ohne Rausspringen**
- Jede Station bekommt einen eigenen Knopf „Speichern". Er sichert den gesamten aktuellen Stand von Reise und Stationen, bleibt aber im Editor — kein Zurückspringen zur Reiseübersicht.
- Kurze Rückmeldung am Knopf: „Gespeichert um 22:14".
- Oben im Editor gibt es „Speichern & beenden" — nur damit landest du wieder in der Reiseübersicht unter Studio.

**Bearbeiten pro Station über ein Stiftsymbol**
- Stationen erscheinen als kompakte Liste: Nummer, Name, Datumsspanne, Anzahl Bilder/Videos, Veröffentlicht-Status.
- Ein Stiftsymbol öffnet ein großes Bearbeitungsfenster für genau diese Station: Name, Ort, Daten, Anreiseart, Text, Tageseinträge, Bilder und Videos. Mit „Speichern" und „Schließen".
- Umsortieren, Veröffentlichen und Löschen bleiben in der Liste.

**Rückfrage beim Löschen von Fotos und Videos**
- Vor dem Löschen kommt eine kurze Rückfrage („Dieses Foto wirklich löschen? Das lässt sich nicht rückgängig machen."). Gilt für Galerie, Titelbild, Stationsbilder und Videos.

**Bilder und Videos einem Tag zuordnen**
- Ist bei einer Station die Tagesoption aktiv, kann jedes Bild und Video einem Tag zugeordnet werden (Auswahlliste mit den Aufenthaltstagen, Voreinstellung „ganze Station").
- Im Reisebericht erscheinen diese Medien direkt beim jeweiligen Tag; alles ohne Tag bleibt wie bisher bei der Station.
- Wird die Tagesoption abgeschaltet oder ändert sich die Datumsspanne, fallen betroffene Medien automatisch zurück zur Station — nichts geht verloren.

**Textformatierung im Reisebericht**
- Über jedem längeren Textfeld (Reisebericht, Stationstext, Tageseinträge) erscheint eine Symbolleiste: Fett, Kursiv, Unterstrichen, Durchgestrichen, Überschriften, Aufzählung, Nummerierung, Zitat, Link, sowie Schriftart, Schriftgröße und Textfarbe.
- Bestehende Texte bleiben erhalten und werden weiter korrekt angezeigt.

**Rechtschreibprüfung**
- Alle Textfelder prüfen auf Deutsch: falsch geschriebene Wörter werden unterstrichen, Vorschläge per Rechtsklick. Ohne Zusatzkosten.

**Orte, Restaurants und Cafés als Punkte auf der Karte**
- Im Stationsfenster gibt es eine Ortssuche („Restaurant Bruckmühl", „Café München") auf Basis der bisherigen freien Kartensuche (OpenStreetMap) — kostenlos, ohne Anmeldung.
- Ausgewählte Treffer werden als Punkt der Station gespeichert (Name, Art, Koordinaten) und in der Reisekarte als kleiner Punkt gezeichnet; beim Antippen erscheint der Name. Der Text bleibt unberührt.
- Punkte lassen sich in einer Liste umbenennen und einzeln entfernen; nur veröffentlichte Stationen zeigen ihre Punkte öffentlich.
- Zu Google Maps: dort kosten Ortssuche und Ortsdetails je nach Umfang etwa 5–35 USD pro 1.000 Abfragen, mit monatlichem Freikontingent; für ein Reisetagebuch wäre das meist gratis, aber es braucht Anmeldung und Abrechnung. Deshalb bleibt es bei der freien Kartensuche — auf Wunsch später umstellbar.

## Technische Umsetzung

**Speichern/Beenden** (`src/routes/admin.studio.$slug.tsx`)
- `saveTrip({ closeAfter?: boolean })`; ohne Flag kein `navigate({ to: "/admin/studio" })`, stattdessen `setSavedAt(new Date())`. Bei neuer Reise bleibt die `replace`-Navigation auf den neuen Slug.
- Neuer Kopf-Knopf „Speichern & beenden"; `StationEditor` erhält `onSaveTrip: () => Promise<void>`.

**Bestätigungsdialog**
- Neue Komponente `src/components/studio/ConfirmDialog.tsx` (shadcn `AlertDialog`), eingesetzt in `deleteImage`, Cover-Entfernen, `VideoEditor.tsx`, Stationsbild- und Stationslöschen (ersetzt `window.confirm`).

**Stationsliste + Dialog** (`src/components/studio/StationEditor.tsx`)
- Bisheriger Inhalt wird zu `StationForm`, gerendert in einem breiten, scrollbaren shadcn `Dialog`; `editingId` steuert die offene Station.
- Listenzeile: Drag-Handle, Nummer, Name, Datumsspanne, Medienzähler, Veröffentlicht-Schalter, `Pencil`-Knopf (`aria-label="Station bearbeiten"`), Löschen.

**Medien pro Tag**
- Migration `011_media_day_and_places.sql`: `images.day_date date`, `videos.day_date date`; Indizes auf `(station_id, day_date)`; ergänzt auch `db/schema.sql`.
- `PATCH /api/studio/images` und `/api/studio/videos` akzeptieren `dayDate` (ISO oder null), validieren, dass das Datum in der Spanne der zugeordneten Station liegt und `daily_enabled` gesetzt ist.
- Beim Abschalten von `daily_enabled` oder Änderung von An-/Abreise setzt der Stations-PATCH `day_date = NULL` für nicht mehr passende Medien.
- `trips.functions.ts` liefert `dayDate` je Bild/Video; `StationSections.tsx` gruppiert Medien nach Tag, Rest bleibt bei der Station.

**Rich-Text** (neu `src/components/studio/RichTextEditor.tsx`)
- TipTap (`@tiptap/react`, `starter-kit`, `extension-underline`, `extension-link`, `extension-text-style` mit `Color`/`FontFamily`, eigene `FontSize`-Mark).
- Speicherformat: HTML in den bestehenden `body_md`-Spalten; reiner Markdown-Altbestand wird beim Öffnen einmalig über `marked` konvertiert.
- Öffentliche Anzeige weiter `ReactMarkdown` + `rehype-raw` + `rehype-sanitize`; Sanitize-Schema um `span` mit `style` (`color`, `font-family`, `font-size`) und `u`/`s` erweitert.
- Zod-Grenzen (`max(20000)`) bleiben; Editorfläche und Textfelder erhalten `spellCheck` und `lang="de"`.

**Orte (POIs)**
- Gleiche Migration `011_...`: Tabelle `station_places` (`id`, `station_id` FK ON DELETE CASCADE, `name`, `category`, `latitude numeric(9,6)`, `longitude numeric(9,6)`, `sort_order`, `created_at`) mit Range-Checks und Index auf `station_id`.
- Neue Route `src/routes/api/studio/places.ts` (GET/POST/PATCH/DELETE) mit `requireAuth` + `requireSameOrigin` + Zod, max. 50 Punkte pro Station, Audit-Einträge `place.create|update|delete`.
- Suche über den bestehenden `GET /api/studio/geocode`, erweitert um `limit` und Kategorie-Felder aus Nominatim (`class`/`type`), serverseitiges Throttling und User-Agent bleiben.
- `trips.functions.ts` liefert `places` je veröffentlichter Station; `RouteMap.tsx` zeichnet sie als kleine Circle-Layer mit Popup-Namen (kein Routen-Einfluss, keine Änderung der Bounds-Logik außer Einbeziehung der Punkte).

**Version**: 0.9.0, danach neu bauen und ausrollen (Migrationen laufen beim Start mit).
