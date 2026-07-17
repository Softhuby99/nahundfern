## Problem

Im Studio werden Galeriebilder korrekt geladen (`GET /api/studio/images?tripId=...` → `SELECT * FROM images WHERE trip_id = ...`), aber auf der öffentlichen Story-Seite bleibt `trip.gallery` leer, sodass die `{trip.gallery.length > 0 && ...}`-Sektion nichts rendert.

## Ursache

In `src/lib/trips.functions.ts` (Zeilen 145–153) filtert der Gallery-Query das Cover direkt in SQL:

```sql
WHERE trip_id = ${row.id}
  AND (${row.cover_image_id}::uuid IS NULL OR id <> ${row.cover_image_id})
```

Diese Konstruktion ist gegenüber der Studio-Abfrage überflüssig komplex und in mehreren Punkten fragil:

- `${row.cover_image_id}` wird zweimal als getrennter Parameter gebunden (postgres.js legt zwei Platzhalter an), Typinferenz und Cast greifen nur beim ersten.
- Bei einem uuid-Parameter, der als Text gebunden wird, kann `id <> $2` je nach Postgres-Version einen Operator-Missmatch auslösen — statt eines Fehlers greift dann evtl. eine leere Ergebnismenge, wenn der Aufruf in einem Batch/Prepared-Kontext schweigend fehlschlägt.
- Der Studio-Endpoint verwendet die einfache Abfrage ohne diese Zusatzklausel und funktioniert — das ist der eindeutige Unterschied.

## Fix

Gleiche Abfragestrategie wie im Studio verwenden und das Cover in JavaScript herausfiltern. Änderung nur in `src/lib/trips.functions.ts` in `getPublishedTrip`:

```ts
const galleryRows = await sql`
  SELECT id, webp_400, webp_1200, webp_2000,
         avif_400, avif_1200, avif_2000,
         width, height, alt
  FROM images
  WHERE trip_id = ${row.id}
  ORDER BY sort_order, created_at
`;
const filtered = row.cover_image_id
  ? galleryRows.filter((g) => g.id !== row.cover_image_id)
  : galleryRows;
return mapRow(row, filtered.map(mapGalleryRow));
```

Verhalten:
- Kein Cover gesetzt → alle Trip-Bilder in Galerie.
- Cover gesetzt → alle Trip-Bilder außer dem Cover.
- Identisch zur Studio-Ansicht, aber ohne das Cover doppelt zu zeigen.

## Verifikation

1. `bun run build:dev` läuft durch.
2. Nach Redeploy (`git pull` + `docker compose … build app` + `run.sh test2`) eine Story mit mehreren Bildern öffnen: Galerie-Sektion mit den Nicht-Cover-Bildern erscheint.
3. Studio-Bearbeitung derselben Reise zeigt weiterhin dieselben Bilder (kein Regressionsrisiko, da diese Route nicht angefasst wird).

## Nicht Teil des Fixes

- Kein Refactor am Studio-Endpoint.
- Keine Änderung an Upload/Insert-Logik.
- Kein neues Feld oder DB-Migration nötig.