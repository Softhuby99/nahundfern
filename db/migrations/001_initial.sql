-- Baseline migration. Matches db/schema.sql for fresh installs where the
-- Postgres initdb step already ran; safe to apply on existing databases
-- because every statement is guarded with IF NOT EXISTS.

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
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug           text UNIQUE NOT NULL,
  title          text NOT NULL,
  kicker         text,
  region         text NOT NULL,
  where_text     text NOT NULL,
  when_text      text NOT NULL,
  month_label    text NOT NULL,
  who_text       text NOT NULL,
  excerpt        text NOT NULL,
  body_md        text NOT NULL,
  cover_image_id uuid REFERENCES images(id) ON DELETE SET NULL,
  published      boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'images_trip_fk'
  ) THEN
    ALTER TABLE images
      ADD CONSTRAINT images_trip_fk
      FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_images_trip     ON images(trip_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_trips_published ON trips(published, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
