-- Repariert Tagestexte, die durch wiederholtes Speichern mehrfach als
-- JSON-Text kodiert wurden. Nur auspacken, nichts löschen.
DO $$
DECLARE i int;
BEGIN
  FOR i IN 1..5 LOOP
    UPDATE trip_stations
       SET day_entries = (day_entries #>> '{}')::jsonb
     WHERE jsonb_typeof(day_entries) = 'string'
       AND (day_entries #>> '{}') ~ '^\s*[\[\{"]';
  END LOOP;
END $$;
