-- Reisestationen: eine geordnete Liste von Orten pro Reise, aus denen die
-- Route auf der Weltkarte gezeichnet wird. Jede Station hat eigenen Text,
-- eigene Bilder/Videos und einen optionalen Marker-Bildbezug.
--
-- Sichtbarkeit: `published = false` bedeutet öffentlich VOLLSTÄNDIG verborgen
-- (kein Name, keine Koordinate, keine Zählung).

CREATE TABLE IF NOT EXISTS trip_stations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name            text NOT NULL,
  country_code    char(2),                       -- ISO-3166-1 alpha-2, lowercase
  latitude        numeric(9,6) NOT NULL,
  longitude       numeric(9,6) NOT NULL,
  arrival_date    date,
  departure_date  date,
  body_md         text NOT NULL DEFAULT '',
  sort_order      int  NOT NULL DEFAULT 0,
  published       boolean NOT NULL DEFAULT false,
  is_destination  boolean NOT NULL DEFAULT false,
  marker_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  -- Abschnitt VON der vorherigen Station ZU dieser Station.
  leg_mode        text NOT NULL DEFAULT 'drive',
  leg_geometry    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_stations_dates_ordered
    CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date),
  -- Nur veröffentlichte Stationen dürfen öffentlicher Zielort sein.
  CONSTRAINT trip_stations_destination_published
    CHECK (is_destination = false OR published = true),
  CONSTRAINT trip_stations_leg_mode
    CHECK (leg_mode IN ('drive', 'cycle', 'walk', 'air')),
  CONSTRAINT trip_stations_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_stations_lon_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_trip_stations_trip ON trip_stations(trip_id, sort_order);

-- Höchstens ein Zielort pro Reise.
CREATE UNIQUE INDEX IF NOT EXISTS trip_stations_one_destination
  ON trip_stations (trip_id)
  WHERE is_destination = true;

-- Medien können einer Station zugeordnet werden. NULL = allgemeine Galerie
-- (bisheriges Verhalten). Beim Löschen einer Station wandern die Medien
-- automatisch zurück in die allgemeine Galerie.
ALTER TABLE images
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES trip_stations(id) ON DELETE SET NULL;
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES trip_stations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_images_station ON images(station_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_videos_station ON videos(station_id, sort_order);
