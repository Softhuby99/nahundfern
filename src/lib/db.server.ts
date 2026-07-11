import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

// `postgres` returns a tagged template function that manages a connection pool.
// We keep a single instance for the Node process.
export const sql = postgres(DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  prepare: false,
});

export async function closeDb() {
  await sql.end();
}

export type TripRow = {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  region: string;
  where_text: string;
  when_text: string;
  month_label: string;
  who_text: string;
  excerpt: string;
  body_md: string;
  cover_image_id: string | null;
  published: boolean;
  created_at: Date;
  updated_at: Date;
};

export type ImageRow = {
  id: string;
  trip_id: string;
  original_path: string;
  webp_400: string;
  webp_1200: string;
  webp_2000: string;
  avif_400: string;
  avif_1200: string;
  avif_2000: string;
  width: number;
  height: number;
  mime: string;
  alt: string | null;
  sort_order: number;
  created_at: Date;
};
