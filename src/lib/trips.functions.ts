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
  body: string[];
  published: boolean;
  createdAt: string;
  cover: {
    webp: Record<number, string>;
    avif: Record<number, string>;
    alt: string | null;
  };
};

function splitBody(bodyMd: string): string[] {
  return bodyMd.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
}

export const listPublishedTrips = createServerFn({ method: "GET" })
  .handler(async () => {
    const rows = await sql`
      SELECT t.*,
             i.webp_400, i.webp_1200, i.webp_2000,
             i.avif_400, i.avif_1200, i.avif_2000,
             i.alt as cover_alt
      FROM trips t
      LEFT JOIN images i ON i.id = t.cover_image_id
      WHERE t.published = true
      ORDER BY t.created_at ASC
    `;
    return rows.map((r) => ({
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
      body: splitBody(r.body_md),
      published: r.published,
      createdAt: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)),
      cover: {
        webp: { 400: r.webp_400, 1200: r.webp_1200, 2000: r.webp_2000 },
        avif: { 400: r.avif_400, 1200: r.avif_1200, 2000: r.avif_2000 },
        alt: r.cover_alt,
      },
    })) as PublicTrip[];
  });

export const getPublishedTrip = createServerFn({ method: "GET" })
  .inputValidator((data) => {
    if (typeof data !== "string") throw new Error("Expected slug string");
    return data;
  })
  .handler(async ({ data: slug }) => {
    const [row] = await sql`
      SELECT t.*,
             i.webp_400, i.webp_1200, i.webp_2000,
             i.avif_400, i.avif_1200, i.avif_2000,
             i.alt as cover_alt
      FROM trips t
      LEFT JOIN images i ON i.id = t.cover_image_id
      WHERE t.slug = ${slug} AND t.published = true
    `;
    if (!row) {
      throw new Error("Trip not found");
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      kicker: row.kicker,
      region: row.region,
      where: row.where_text,
      when: row.when_text,
      monthLabel: row.month_label,
      who: row.who_text,
      excerpt: row.excerpt,
      body: splitBody(row.body_md),
      published: row.published,
      createdAt: (row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)),
      cover: {
        webp: { 400: row.webp_400, 1200: row.webp_1200, 2000: row.webp_2000 },
        avif: { 400: row.avif_400, 1200: row.avif_1200, 2000: row.avif_2000 },
        alt: row.cover_alt,
      },
    } as PublicTrip;
  });
