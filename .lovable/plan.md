# Studio-Editor: Speichern, Bearbeiten pro Station, Textformatierung

## Was sich für dich ändert

**Speichern ohne Rausspringen**
- Jede Station bekommt einen eigenen Knopf „Speichern". Er sichert den gesamten aktuellen Stand von Reise und Stationen, bleibt aber im Editor stehen — kein Zurückspringen zur Reiseübersicht.
- Kurze Rückmeldung direkt am Knopf: „Gespeichert um 22:14".
- Oben im Editor gibt es zusätzlich „Speichern & beenden" — nur damit landest du wieder in der Reiseübersicht unter Studio. Der bisherige Hauptknopf speichert ebenfalls nur noch, ohne zu wechseln.

**Bearbeiten pro Station über ein Stiftsymbol**
- Die Stationen werden als kompakte Liste angezeigt: Nummer, Name, Datumsspanne, Anzahl Bilder/Videos, Veröffentlicht-Status.
- Ein Stiftsymbol je Station öffnet ein großes Bearbeitungsfenster für genau diese Station: Name, Ort/Koordinaten, Daten, Anreiseart, Text, Tageseinträge, Bilder und Videos.
- Das Fenster hat „Speichern" und „Schließen"; Ziehen zum Umsortieren, Veröffentlichen und Löschen bleiben in der Liste.

**Rückfrage beim Bildlöschen**
- Vor dem Löschen eines Fotos oder Videos erscheint eine kurze Rückfrage („Dieses Foto wirklich löschen? Das lässt sich nicht rückgängig machen."). Erst nach Bestätigen wird gelöscht. Gilt für Galerie, Cover und Stationsbilder.

**Textformatierung im Reisebericht**
- Über jedem längeren Textfeld (Reisebericht, Stationstext, Tageseinträge) erscheint eine Symbolleiste mit:
  - Fett, Kursiv, Unterstrichen, Durchgestrichen
  - Überschriften, Aufzählung, Nummerierung, Zitat, Link
  - Schriftart (kleine, zur Seite passende Auswahl), Schriftgröße, Textfarbe
- Bestehende Texte bleiben erhalten und werden weiter korrekt angezeigt.

**Rechtschreibprüfung**
- Alle Textfelder prüfen auf Deutsch: falsch geschriebene Wörter werden unterstrichen, Verbesserungsvorschläge per Rechtsklick. Keine zusätzlichen Kosten.

## Technische Umsetzung

**Speichern/Beenden** (`src/routes/admin.studio.$slug.tsx`)
- `saveTrip` erhält `{ closeAfter?: boolean }`. Ohne Flag: kein `navigate({ to: "/admin/studio" })`, stattdessen `setSavedAt(new Date())`; bei neuer Reise bleibt die bestehende `replace`-Navigation auf den neuen Slug.
- Neuer Kopfbereich-Knopf „Speichern & beenden" ruft `saveTrip({ closeAfter: true })`.
- `StationEditor` bekommt Prop `onSaveTrip: () => Promise<void>`; sein Stations-Speicherknopf ruft erst `patchStation` für offene Felder, dann `onSaveTrip()`.

**Bestätigungsdialog**
- Neue Komponente `src/components/studio/ConfirmDialog.tsx` (shadcn `AlertDialog`) mit `title`, `description`, `confirmLabel`.
- Eingesetzt in `deleteImage`, Cover-Entfernen, Video-Löschen (`VideoEditor.tsx`) und Stationsbild-Löschen; das bestehende `window.confirm` beim Stationslöschen wird ebenfalls darauf umgestellt.

**Stationsliste + Bearbeitungsfenster** (`src/components/studio/StationEditor.tsx`)
- Bisheriger Stationsinhalt wird in `StationForm` ausgelagert und in einem `Dialog` (shadcn, große Breite, scrollbar) gerendert; `editingId` steuert, welche Station offen ist.
- Listenzeile: Drag-Handle, Nummer, Name, Datumsspanne, Medienzähler, Veröffentlicht-Schalter, Stift-Knopf (`Pencil` aus lucide-react, `aria-label="Station bearbeiten"`), Löschen.

**Rich-Text** (neu `src/components/studio/RichTextEditor.tsx`)
- TipTap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-link`, `@tiptap/extension-text-style` mit `Color`, `FontFamily`, `TextStyle`, plus eigene `FontSize`-Mark).
- Speicherformat: HTML in den bestehenden `body_md`-Spalten. Beim Laden wird erkannt, ob der Wert HTML ist; reiner Markdown-Text wird beim Öffnen einmalig über `marked` nach HTML gewandelt.
- Öffentliche Anzeige (`stories.$slug.tsx`, `StationSections.tsx`): weiterhin `ReactMarkdown` mit `rehype-raw` + `rehype-sanitize`; das Sanitize-Schema wird um `span`/`style` (nur `color`, `font-family`, `font-size`) und `u`/`s` erweitert, damit die Formatierung durchkommt und kein Script möglich ist.
- Serverseitig bleiben die Zod-Grenzen (`max(20000)`) bestehen; HTML wird beim Rendern sanitisiert, nicht beim Speichern.
- Editorfläche und alle verbleibenden `textarea`/`input[type=text]` erhalten `spellCheck` mit `lang="de"`.

**Version**: 0.9.0, danach neu bauen und ausrollen.
