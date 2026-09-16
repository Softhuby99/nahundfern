-- Tageseinträge pro Station: optional kann eine Station für jeden Tag des
-- Aufenthalts einen eigenen Text bekommen.
--   daily_enabled = true  → im Bericht werden die Tage einzeln gezeigt
--   day_entries          → [{ "date": "2026-05-01", "bodyMd": "…" }, …]

ALTER TABLE trip_stations
  ADD COLUMN IF NOT EXISTS daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS day_entries   jsonb   NOT NULL DEFAULT '[]'::jsonb;
