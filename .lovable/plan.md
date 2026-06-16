## Look & Feel
**Cinematic Noir** — dunkler Hintergrund (fast schwarz, HSL 220 15% 5%), warmes Bernstein-Gelb als Akzent (HSL 38 90% 55%), cremefarbene Schrift. Typo: **Anton** (Display, condensed uppercase), **Inter** (Body), **JetBrains Mono** (Labels). Fotos in Schwarzweiß, die im Hover farbig werden — wie alte Filmstreifen auf einem Leuchttisch.

## Seitenstruktur

**Home (`/`)**
- Sticky Header: Logo "Vagabond." + Hamburger
- Hero: Kicker "The 2024 Collection" + riesige Headline "Northern Hemispheres" + Intro-Text
- **Signature: Horizontaler Zeitstrahl** — durchgehende Linie quer über den Bildschirm, Foto-Karten hängen abwechselnd oben/unten an Knotenpunkten. Jahres-Label + Headline pro Knoten. Beim Hover öffnet sich eine Bloom-Karte mit *Wo / Wann / Mit wem* + Mini-Bilderstreifen + "Read report"-Button. Horizontal scrollbar.
- About-Teaser (heller Block, invertiert)
- Footer mit Kontakt-CTA

**Timeline (`/timeline`)** — Vollbild-Version des Zeitstrahls mit allen Reisen.

**Stories (`/stories`)** — Blog-Übersicht aller Reiseberichte als Kachel-Archiv.

**Story Detail (`/stories/$slug`)** — Einzelner Reisebericht: Cover, Meta (Ort/Zeit/Begleitung), Galerie, Text.

**About (`/about`)** — Portrait, Philosophie, Equipment.

**Tips (`/tips`)** — Pack- & Reisetipps.

**Contact (`/contact`)** — Kontaktformular (Frontend-Demo, kein Versand).

**Studio (`/studio`)** — Geschützter Admin-Bereich, Login per Frontend-Passwort ("demo"). Dort: Liste der Reisen, Editor zum Anlegen/Bearbeiten (Titel, Ort, Datum, Begleitung, Bilder-Upload als lokale Vorschau, Text), "Online stellen"-Toggle. **Daten bleiben nur im Browser (localStorage)** — Demo, kein echtes Backend.

## Beispiel-Inhalte (Europa + Nordamerika)
Lissabon (Mai), Geirangerfjord/Norwegen (Juni), Val d'Orcia/Toskana (Juli), Black Sands/Island (August), New York (September), Banff/Kanada (Oktober), Route 66 (November), Yellowstone (Dezember).

## Technische Details
- TanStack Start, Tailwind v4 Tokens in `src/styles.css` (Background, Foreground, Primary-Bernstein, Border)
- Fonts via `<link>` in `__root.tsx`
- `Timeline.tsx`-Komponente mit horizontalem Scroll-Container, `snap-x`, gezeichneter Spine-Linie (keyframe `drawLine`), Hover-Bloom-Karte
- Trip-Daten zentral in `src/data/trips.ts` (8 Reisen, je mit `where`, `when`, `who`, `cover`, `gallery[]`, `body`)
- Bilder via Generator passend zu jedem Reiseziel, S/W-Filter im Idle, farbig im Hover
- Studio: localStorage-basierter Store + simple Passwort-Gate-Komponente, Bild-Upload via `FileReader` zu Base64

## Was du noch bedenken solltest
- **Echte Inhalte später**: Wenn die Demo überzeugt, kann der Studio-Bereich auf Lovable Cloud umgestellt werden (echter Login + DB + Datei-Storage), damit Reisen persistent gespeichert werden.
- **SEO**: jede Reise-Detailseite bekommt eigenen Title + Meta + og:image (das Cover).
- **Rechtliches**: Impressum & Datenschutz als Stub-Seiten ergänzen, sobald veröffentlicht wird.
- **Bilder-Lizenzen**: aktuell KI-generiert für die Demo; echte Fotos später ersetzen.

Soll ich so loslegen?