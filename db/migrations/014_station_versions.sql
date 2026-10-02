-- Frühere Fassungen von Stationstexten. Ohne Fremdschlüssel, damit Fassungen
-- auch nach versehentlichem Löschen einer Station erhalten bleiben.
CREATE TABLE IF NOT EXISTS trip_station_versions (
  id          bigserial PRIMARY KEY,
  station_id  uuid NOT NULL,
  trip_id     uuid,
  name        text NOT NULL,
  body_md     text NOT NULL DEFAULT '',
  day_entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_enabled boolean NOT NULL DEFAULT false,
  user_id     uuid,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_station_versions_station
  ON trip_station_versions(station_id, created_at DESC);
