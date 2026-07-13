-- Structured trip metadata for filters, maps and statistics.
-- All fields are optional so existing rows keep working unchanged.
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS country_code  char(2),
  ADD COLUMN IF NOT EXISTS city          text,
  ADD COLUMN IF NOT EXISTS latitude      numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude     numeric(9,6),
  ADD COLUMN IF NOT EXISTS travel_type   text,
  ADD COLUMN IF NOT EXISTS featured      boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_trips_country_code ON trips(country_code);
CREATE INDEX IF NOT EXISTS idx_trips_featured     ON trips(featured) WHERE featured;
