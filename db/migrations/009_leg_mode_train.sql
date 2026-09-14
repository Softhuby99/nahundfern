-- Zug als Verkehrsmittel für einen Reiseabschnitt.
-- Für Zugstrecken gibt es kein öffentliches Routing: die Linie wird wie beim
-- Flug als gestrichelter Bogen gezeichnet.

ALTER TABLE trip_stations DROP CONSTRAINT IF EXISTS trip_stations_leg_mode;
ALTER TABLE trip_stations
  ADD CONSTRAINT trip_stations_leg_mode
  CHECK (leg_mode IN ('drive', 'train', 'cycle', 'walk', 'air'));
