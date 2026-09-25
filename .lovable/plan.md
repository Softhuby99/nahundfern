# Plan: Verkehrsmittel-Symbol pro Kartenverbindung

## Ziel
In der Karte soll jede Verbindung zwischen zwei Stationen ein kleines Symbol in der Mitte anzeigen, das zeigt, wie das Ziel erreicht wurde: Auto, Zug, Fahrrad, zu Fuß oder Flug.

## Umsetzung
1. **Verbindungen auswerten**
   - Die Karte nutzt bereits pro Abschnitt die vorhandene Anreiseart (`drive`, `train`, `cycle`, `walk`, `air`).
   - Diese Information wird an die gezeichnete Verbindung weitergegeben.

2. **Symbol in der Linienmitte anzeigen**
   - Für jeden Abschnitt wird ein Mittelpunkt aus der Liniengeometrie berechnet.
   - Dort erscheint ein dezentes, rundes Symbol direkt auf der Karte.
   - Vorgesehene Symbole:
     - Auto: 🚗
     - Zug: 🚆
     - Fahrrad: 🚲
     - Zu Fuß: 🚶
     - Flug: ✈️

3. **Nur sinnvolle Anzeigen**
   - Das Symbol erscheint pro Verbindung, nicht pro Station.
   - Wenn die Routenlinie ausgeblendet ist, werden auch die Verbindungssymbole ausgeblendet.
   - Bei gestrichelten Bögen wird das Symbol ebenfalls mittig auf dem Bogen angezeigt.

4. **Stil und Bedienbarkeit**
   - Die Symbole bekommen einen kleinen hellen Hintergrund, damit sie auf Karte und Route gut lesbar sind.
   - Sie blockieren keine Marker-Klicks unnötig.
   - Auf kleinen Bildschirmen bleiben sie kompakt.

5. **Prüfung**
   - Karte im Reisebericht prüfen.
   - Große Kartenansicht prüfen.
   - Startseiten-Karte prüfen, damit dort weiterhin nur die gewünschten Reise-Punkte ohne Routen-Symbole erscheinen.

## Technische Details
- Die Änderung betrifft voraussichtlich `RouteMap.tsx` und die zugehörigen Karten-Styles.
- Die vorhandene Routenlogik liefert bereits den Abschnittsmodus (`mode`), daher ist keine Datenbankänderung nötig.
- Die Symbolposition wird clientseitig aus der sichtbaren Liniengeometrie berechnet.
