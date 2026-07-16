import { createServerFn } from "@tanstack/react-start";
import { sql } from "@/lib/db.server";

export type PublicTrip = {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  region: string;
  where: string;
  when: string;
  monthLabel: string;
  who: string;
  excerpt: string;
  /** Raw Markdown source for full-body rendering with react-markdown. */
  bodyMd: string;
  /** Legacy: paragraphs split on blank lines. Kept for back-compat. */
  body: string[];
  published: boolean;
  createdAt: string;
  tripStartDate: string | null;
  tripEndDate: string | null;
  countryCode: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  travelType: string | null;
  featured: boolean;
  cover: {
    webp: Record<number, string>;
    avif: Record<number, string>;
    alt: string | null;
  };
};

function splitBody(bodyMd: string): string[] {
  return bodyMd.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): PublicTrip {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    kicker: r.kicker,
    region: r.region,
    where: r.where_text,
    when: r.when_text,
    monthLabel: r.month_label,
    who: r.who_text,
    excerpt: r.excerpt,
    bodyMd: r.body_md,
    body: splitBody(r.body_md),
    published: r.published,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    tripStartDate: toIsoDate(r.trip_start_date),
    tripEndDate: toIsoDate(r.trip_end_date),
    countryCode: r.country_code ?? null,
    city: r.city ?? null,
    latitude: toNumber(r.latitude),
    longitude: toNumber(r.longitude),
    travelType: r.travel_type ?? null,
    featured: Boolean(r.featured),
    cover: {
      webp: { 400: r.webp_400, 1200: r.webp_1200, 2000: r.webp_2000 },
      avif: { 400: r.avif_400, 1200: r.avif_1200, 2000: r.avif_2000 },
      alt: r.cover_alt,
    },
  };
}

export const listPublishedTrips = createServerFn({ method: "GET" })
  .handler(async () => {
    // Order chronologically by actual travel date (newest first). Fall back to
    // created_at when trip_start_date is not yet set on legacy rows.
    const rows = await sql`
      SELECT t.*,
             i.webp_400, i.webp_1200, i.webp_2000,
             i.avif_400, i.avif_1200, i.avif_2000,
             i.alt as cover_alt
      FROM trips t
      LEFT JOIN images i ON i.id = t.cover_image_id
      WHERE t.published = true
      ORDER BY COALESCE(t.trip_start_date, t.created_at::date) DESC,
               t.created_at DESC
    `;
    return rows.map(mapRow);
  });

// Returns `null` when the slug is unpublished or unknown, so the route loader
// can turn that specific case into `notFound()` while unexpected errors (DB
// down, programming bugs) keep propagating and produce a proper 500.
export const getPublishedTrip = createServerFn({ method: "GET" })
  .inputValidator((data) => {
    if (typeof data !== "string") throw new Error("Expected slug string");
    return data;
  })
  .handler(async ({ data: slug }): Promise<PublicTrip | null> => {
    const [row] = await sql`
      SELECT t.*,
             i.webp_400, i.webp_1200, i.webp_2000,
             i.avif_400, i.avif_1200, i.avif_2000,
             i.alt as cover_alt
      FROM trips t
      LEFT JOIN images i ON i.id = t.cover_image_id
      WHERE t.slug = ${slug} AND t.published = true
    `;
    return row ? mapRow(row) : null;
  });

/** Slim slug+title projection used to build newer/older links on story pages. */
export type TripNavigationEntry = {
  slug: string;
  title: string;
};

export const listTripNavigationEntries = createServerFn({ method: "GET" })
  .handler(async (): Promise<TripNavigationEntry[]> => {
    const rows = await sql<{ slug: string; title: string }[]>`
      SELECT slug, title
      FROM trips
      WHERE published = true
      ORDER BY COALESCE(trip_start_date, created_at::date) DESC,
               created_at DESC
    `;
    return rows.map((r) => ({ slug: r.slug, title: r.title }));
  });
