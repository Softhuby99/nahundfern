# Tagesmodus reparieren und Stationen bewusst speichern

## Änderungen
- Den Tagesmodus gegen alte, ungültige oder ungewöhnlich lange Datumsbereiche absichern, damit die Reise wieder bearbeitet werden kann.
- Im Stationsfenster Änderungen an Name, Datum, Anreiseart, Text, Tagesoption, Tagestexten und Veröffentlichung zunächst nur als Entwurf halten.
- „Station speichern“ übernimmt den Entwurf dauerhaft.
- „Beenden“ schließt ohne Speichern. Bei ungespeicherten Änderungen erscheint vorher eine Rückfrage; nach Bestätigung werden sie verworfen.
- Dasselbe Verhalten gilt für das Schließen über das Kreuz oder einen Klick außerhalb des Fensters.
- Die Schaltflächen oben und unten bleiben gut sichtbar; „Fenster schließen“ wird in „Beenden“ umbenannt.

## Technische Details
- Pro geöffnetem Stationsfenster wird eine lokale Kopie der Station geführt und mit dem gespeicherten Stand verglichen.
- Beim Speichern werden alle geänderten Stationsfelder in einer Anfrage übertragen und anschließend neu geladen.
- Die Tagesfelder werden nur für einen plausiblen Aufenthalt erzeugt; statt einer großen Editoren-Menge erscheint bei fehlerhaften Zeiträumen ein verständlicher Hinweis.
- Bereits gespeicherte Reise-, Bild- und Videodaten bleiben unverändert.
