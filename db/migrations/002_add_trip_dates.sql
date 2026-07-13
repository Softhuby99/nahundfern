-- Add structured trip start/end dates so the timeline can filter and sort
-- by the actual travel date rather than the record's created_at.

ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS trip_start_date date,
  ADD COLUMN IF NOT EXISTS trip_end_date   date;

CREATE INDEX IF NOT EXISTS idx_trips_trip_start_date
  ON trips(trip_start_date DESC NULLS LAST);
