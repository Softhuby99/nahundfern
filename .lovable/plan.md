# Plan: Kartenverbindungen und laufende Reise sichtbar machen

## Ziel
Die Karten sollen zwei Dinge besser zeigen:
- In Reiseberichten steht pro Verbindung ein kleines Symbol in der Linienmitte: Auto, Zug, Fahrrad, zu Fuß oder Flug.
- Auf der großen Kartenansicht wird eine gerade laufende Reise wie Korsika mit einem eigenen Kreis-Symbol sichtbar gemacht.

## Umsetzung
1. **Verkehrsmittel pro Verbindung anzeigen**
   - Jede Verbindung nutzt die bereits gespeicherte Anreiseart (`drive`, `train`, `cycle`, `walk`, `air`).
   - In der Mitte jeder Verbindung erscheint ein kleines Symbol:
     - Auto: 🚗
     - Zug: 🚆
     - Fahrrad: 🚲
     - Zu Fuß: 🚶
     - Flug: ✈️
   - Das Symbol erscheint auch auf gestrichelten Bögen.
   - Wenn eine Karte keine Routenlinie zeigt, erscheinen dort auch keine Verbindungssymbole.

2. **Laufende Reise auf der Kartenansicht kennzeichnen**
   - Eine Reise gilt als laufend, wenn ihr Startdatum erreicht ist und ihr Enddatum fehlt oder noch in der Zukunft liegt.
   - Laufende Reisen bekommen auf `/map` ein auffälliges Kreis-Symbol statt eines normalen Reisemarkers.
   - Der Kreis signalisiert „läuft gerade“ und bleibt anklickbar zum Reisebericht.
   - Wenn kein Zielort gesetzt ist, nutzt die Karte die letzte veröffentlichte Station als Position; falls nötig wird zusätzlich die erste veröffentlichte Station als Fallback geprüft.

3. **Beschriftung und Liste anpassen**
   - In der Kartenliste bekommt eine laufende Reise einen kurzen Hinweis wie „läuft gerade“.
   - Die übrigen Reisen bleiben unverändert.

4. **Prüfung**
   - Reisebericht-Karte prüfen: Symbole sitzen mittig auf den Verbindungen.
   - Vergrößerte Reisebericht-Karte prüfen: Symbole sind ebenfalls sichtbar.
   - `/map` prüfen: Korsika bzw. laufende Reisen sind sichtbar und anklickbar.
   - Startseiten-Mini-Karte prüfen: Sie bleibt schlicht und ohne Verbindungssymbole.

## Technische Details
- Betroffen sind voraussichtlich die Kartenkomponente, die Kartenansicht und die öffentliche Reisedaten-Abfrage.
- Es ist keine Datenbankänderung nötig, weil Start- und Enddatum sowie Anreiseart bereits vorhanden sind.
- Die Symbolposition wird clientseitig aus der vorhandenen Liniengeometrie berechnet.
