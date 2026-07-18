## Plan

1. **Routing-Fehler beheben**
   - Die Reise-Übersicht wird als Parent-Route behandelt, deshalb bleibt sie sichtbar, obwohl die URL zu `/stories/<slug>` wechselt.
   - Ich mache `/stories` zur Layout-Route mit `<Outlet />`.
   - Die bisherige Übersicht kommt in eine eigene Index-Route für `/stories`.

2. **Detailseite unverändert erreichbar lassen**
   - `/stories/$slug` bleibt die Reisebericht-Detailseite.
   - Bestehende Links von Übersicht, Startseite, Galerie und Timeline bleiben auf `/stories/$slug`.

3. **Galerie-Nebeneffekt prüfen**
   - Danach sollte beim Klick auf `toskana-` wirklich die Detailseite rendern; erst dort kann die Story-Galerie sichtbar werden.
   - Falls die Detailseite dann lädt, aber die Galerie weiterhin leer ist, ist das ein separater Daten-/Bildpfad-Fix.

4. **Version erhöhen**
   - Gemäß deiner Vorgabe erhöhe ich bei dieser Codeänderung die Versionsnummer auf den nächsten Patch-Stand.

## Technische Details

- Betroffene Dateien voraussichtlich:
  - `src/routes/stories.tsx`
  - neue Route für die Übersicht, z. B. `src/routes/stories.index.tsx`
  - Versionsdatei (`package.json` und ggf. Footer-Anzeige, je nachdem wie sie aktuell verdrahtet ist)

- Keine Datenbankänderung nötig.