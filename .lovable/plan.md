## Ziel

`/gallery` soll **alle** Bilder aus allen veröffentlichten Reisen zeigen (Cover + Galerie), nicht nur die Cover.

## Umsetzung

### 1. Neue Server-Function `listPublishedGalleryImages` in `src/lib/trips.functions.ts`

Liefert eine flache Liste aller Bilder veröffentlichter Reisen mit den nötigen Meta-Feldern zum Filtern und Verlinken:

```sql
SELECT
  i.id, i.webp_400, i.webp_1200, i.webp_2000,
  i.avif_400, i.avif_1200, i.avif_2000,
  i.width, i.height, i.alt, i.sort_order, i.created_at,
  t.slug   AS trip_slug,
  t.title  AS trip_title,
  t.region AS trip_region,
  t.month_label AS trip_month_label
FROM images i
JOIN trips t ON t.id = i.trip_id
WHERE t.published = true
ORDER BY
  COALESCE(t.trip_start_date, t.created_at::date) DESC,
  i.sort_order ASC,
  i.created_at ASC
```

Rückgabetyp `PublicGalleryImage` mit `{ id, webp, avif, width, height, alt, trip: { slug, title, region, monthLabel } }`.

Kein Filter auf Cover — der User will explizit alle Bilder sehen.

### 2. `src/routes/gallery.tsx` umstellen

- Loader ruft `listPublishedGalleryImages()` statt `listPublishedTrips()`.
- Regionen-Filter aus `image.trip.region` ableiten.
- `feature` = erstes Bild, `bento` = nächste 4, `strip` = erste 6 — gleiche Bento-Struktur, aber pro Bild statt pro Reise.
- `<PhotoTile>` bekommt `image` statt `trip`; Titel-Overlay zeigt `trip.title, trip.region` und `trip.monthLabel`.
- Kacheln sind `<Link to="/stories/$slug" params={{ slug: image.trip.slug }}>`, damit ein Klick zur Story führt.

### 3. Versionierung

`package.json` → `0.5.1`.

### 4. Verifikation

- Preview `/gallery` zeigt deutlich mehr Kacheln als bisher, sobald Reisen Zusatzbilder haben.
- Filter „Alle Fotos" und einzelne Regionen funktionieren.
- Klick auf Kachel öffnet die zugehörige Story.
- Startseite `/` und Story-Seiten sind nicht betroffen.

## Nicht Teil

- Story-Seite: bleibt unverändert (rendert bereits `trip.gallery`).
- Kein Umbau von `listPublishedTrips` — die Timeline braucht weiterhin Reisen als Aggregat.