-- Videos live in their own table: metadata is different from images
-- (duration, poster frame, bytes, container) and mixing them into `images`
-- would make every downstream JOIN/rendering conditional.
CREATE TABLE IF NOT EXISTS videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id       uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  original_path text NOT NULL,   -- /uploads/videos/originals/<uuid>.<ext>
  mp4_720_path  text NOT NULL,   -- H.264/AAC MP4, faststart, ≤720p
  poster_path   text NOT NULL,   -- JPEG poster frame
  width         int  NOT NULL,
  height        int  NOT NULL,
  duration_ms   int  NOT NULL,
  bytes         bigint NOT NULL,
  mime          text NOT NULL,
  alt           text,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_videos_trip ON videos(trip_id, sort_order);
