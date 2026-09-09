-- Initial schema for nahundfern.servuswir.de
-- Runs once on first container start (docker-entrypoint-initdb.d).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS images (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        uuid,
  original_path  text NOT NULL,
  webp_400       text NOT NULL,
  webp_1200      text NOT NULL,
  webp_2000      text NOT NULL,
  avif_400       text NOT NULL,
  avif_1200      text NOT NULL,
  avif_2000      text NOT NULL,
  width          int  NOT NULL,
  height         int  NOT NULL,
  mime           text NOT NULL,
  alt            text,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trips (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              text UNIQUE NOT NULL,
  title             text NOT NULL,
  kicker            text,
  region            text NOT NULL,
  where_text        text NOT NULL,
  when_text         text NOT NULL,
  month_label       text NOT NULL,
  who_text          text NOT NULL,
  excerpt           text NOT NULL,
  body_md           text NOT NULL,
  cover_image_id    uuid REFERENCES images(id) ON DELETE SET NULL,
  trip_start_date   date,
  trip_end_date     date,
  country_code      char(2),
  city              text,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  travel_type       text,
  featured          boolean NOT NULL DEFAULT false,
  published         boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE images
  ADD CONSTRAINT images_trip_fk
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX IF NOT EXISTS idx_images_trip           ON images(trip_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_trips_published       ON trips(published, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trips_trip_start_date ON trips(trip_start_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_trips_country_code    ON trips(country_code);
CREATE INDEX IF NOT EXISTS idx_trips_featured        ON trips(featured) WHERE featured;

-- Reisestationen (siehe migration 008). Unveröffentlichte Stationen sind
-- öffentlich vollständig verborgen.
CREATE TABLE IF NOT EXISTS trip_stations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id         uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name            text NOT NULL,
  country_code    char(2),
  latitude        numeric(9,6) NOT NULL,
  longitude       numeric(9,6) NOT NULL,
  arrival_date    date,
  departure_date  date,
  body_md         text NOT NULL DEFAULT '',
  sort_order      int  NOT NULL DEFAULT 0,
  published       boolean NOT NULL DEFAULT false,
  is_destination  boolean NOT NULL DEFAULT false,
  marker_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  leg_mode        text NOT NULL DEFAULT 'drive',
  leg_geometry    jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_stations_dates_ordered
    CHECK (departure_date IS NULL OR arrival_date IS NULL OR departure_date >= arrival_date),
  CONSTRAINT trip_stations_destination_published
    CHECK (is_destination = false OR published = true),
  CONSTRAINT trip_stations_leg_mode
    CHECK (leg_mode IN ('drive', 'cycle', 'walk', 'air')),
  CONSTRAINT trip_stations_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT trip_stations_lon_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_trip_stations_trip ON trip_stations(trip_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS trip_stations_one_destination
  ON trip_stations (trip_id) WHERE is_destination = true;

ALTER TABLE images
  ADD COLUMN IF NOT EXISTS station_id uuid REFERENCES trip_stations(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_images_station ON images(station_id, sort_order);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit log for sensitive Studio actions. Kept in the base schema
-- so a fresh docker-entrypoint-initdb.d run creates it; also delivered as
-- migration 004 for existing deployments.
CREATE TABLE IF NOT EXISTS audit_log (
  id          bigserial PRIMARY KEY,
  request_id  text,
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_id   text,
  ip          text,
  user_agent  text,
  email_hash  text,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action     ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user       ON audit_log(user_id, created_at DESC);

