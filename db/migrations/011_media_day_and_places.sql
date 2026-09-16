-- Medien können einem einzelnen Aufenthaltstag einer Station zugeordnet werden
-- (nur sinnvoll, wenn die Station `daily_enabled` gesetzt hat). NULL bedeutet:
-- gehört zur ganzen Station (bisheriges Verhalten).
ALTER TABLE images ADD COLUMN IF NOT EXISTS day_date date;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS day_date date;

CREATE INDEX IF NOT EXISTS idx_images_station_day ON images(station_id, day_date);
CREATE INDEX IF NOT EXISTS idx_videos_station_day ON videos(station_id, day_date);

-- Orte, Restaurants, Cafés: kleine Punkte auf der Karte, pro Station.
CREATE TABLE IF NOT EXISTS station_places (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id  uuid NOT NULL REFERENCES trip_stations(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text,
  latitude    numeric(9,6) NOT NULL,
  longitude   numeric(9,6) NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT station_places_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT station_places_lon_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_station_places_station
  ON station_places(station_id, sort_order);
