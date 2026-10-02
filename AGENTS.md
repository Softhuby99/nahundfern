# Project Architecture

- Treat stored map route geometry as untrusted input and fall back to a generated route when any coordinate is invalid, because one malformed point must never crash a travel report.- Station text saves send the loaded text as a baseline and the server rejects mismatches (409) and archives the previous text in trip_station_versions, because stale tabs on another device silently overwrote travel texts.
- Backups dump to a raw file, verify the pg_dump completion marker and minimum size before keeping it, and retry on failure, because a piped pg_dump failure produced empty "valid" backups.
