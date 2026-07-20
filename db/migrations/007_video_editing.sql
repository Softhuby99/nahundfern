-- v0.6.1: Non-destruktives Trimmen + Poster-Auswahl.
-- Trim-Werte beziehen sich IMMER aufs Original -> beliebig wiederholbar.
-- video_version/poster_version wachsen bei jeder neuen Ausgabedatei,
-- damit Browser-Caches nie eine alte Datei unter gleichem Pfad zeigen.

ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS trim_start_ms         integer,
  ADD COLUMN IF NOT EXISTS trim_end_ms           integer,
  ADD COLUMN IF NOT EXISTS poster_at_ms          integer,        -- Zeit im ORIGINAL
  ADD COLUMN IF NOT EXISTS original_duration_ms  integer,        -- nullable, lazy nachtragen
  ADD COLUMN IF NOT EXISTS video_version         integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS poster_version        integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS processing            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_token      uuid;

DO $$ BEGIN
  ALTER TABLE videos ADD CONSTRAINT videos_trim_pair_check CHECK (
    (trim_start_ms IS NULL AND trim_end_ms IS NULL)
    OR (trim_start_ms IS NOT NULL AND trim_end_ms IS NOT NULL
        AND trim_start_ms >= 0 AND trim_end_ms > trim_start_ms)
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE videos ADD CONSTRAINT videos_poster_at_check CHECK (
    poster_at_ms IS NULL OR poster_at_ms >= 0
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
