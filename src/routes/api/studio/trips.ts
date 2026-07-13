import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import postgres from "postgres";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth.server";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .optional()
  .nullable();

const TripInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  kicker: z.string().max(200).optional(),
  region: z.enum(["Europe", "North America"]),
  where: z.string().min(1).max(300),
  when: z.string().min(1).max(200),
  monthLabel: z.string().min(1).max(50),
  who: z.string().min(1).max(200),
  excerpt: z.string().min(1).max(2000),
  body: z.string().min(1).max(50000),
  published: z.boolean(),
  coverImageId: z.string().uuid().optional().nullable(),
  tripStartDate: isoDate,
  tripEndDate: isoDate,
});

async function getTripsWithCover() {
  return sql`
    SELECT t.*, i.webp_400 as cover_webp_400, i.webp_1200 as cover_webp_1200, i.webp_2000 as cover_webp_2000,
           i.avif_400 as cover_avif_400, i.avif_1200 as cover_avif_1200, i.avif_2000 as cover_avif_2000,
           i.alt as cover_alt
    FROM trips t
    LEFT JOIN images i ON i.id = t.cover_image_id
    ORDER BY t.created_at DESC
  `;
}

export const Route = createFileRoute("/api/studio/trips")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const slug = searchParams.get("slug");
        if (slug) {
          const [trip] = await sql`
            SELECT t.*, i.webp_400 as cover_webp_400
            FROM trips t
            LEFT JOIN images i ON i.id = t.cover_image_id
            WHERE t.slug = ${slug}
          `;
          if (!trip) {
            return Response.json({ error: "Trip not found" }, { status: 404 });
          }
          return Response.json({ trip });
        }
        const trips = await getTripsWithCover();
        return Response.json({ trips });
      },

      POST: async ({ request }) => {
        await requireAuth(request);
        const body = await request.json();
        const parsed = TripInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input", details: parsed.error.format() }, { status: 400 });
        }
        const data = parsed.data;
        const coverId = data.coverImageId ?? null;
        const kicker = data.kicker ?? null;

        try {
          const [trip] = await sql`
            INSERT INTO trips (slug, title, kicker, region, where_text, when_text, month_label, who_text, excerpt, body_md, published, cover_image_id)
            VALUES (
              ${data.slug}, ${data.title}, ${kicker}, ${data.region}, ${data.where}, ${data.when},
              ${data.monthLabel}, ${data.who}, ${data.excerpt}, ${data.body}, ${data.published}, ${coverId}
            )
            RETURNING *
          `;
          return Response.json({ trip }, { status: 201 });
        } catch (error) {
          if (error instanceof postgres.PostgresError && error.code === "23505") {
            return Response.json({ error: "Slug already exists" }, { status: 409 });
          }
          throw error;
        }
      },

      PATCH: async ({ request }) => {
        await requireAuth(request);
        const body = await request.json();
        const parsed = TripInput.safeParse(body);
        if (!parsed.success || !parsed.data.id) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const data = parsed.data;
        const tripId = data.id!;
        const coverId = data.coverImageId ?? null;
        const kicker = data.kicker ?? null;

        try {
          const [trip] = await sql`
            UPDATE trips SET
              slug = ${data.slug},
              title = ${data.title},
              kicker = ${kicker},
              region = ${data.region},
              where_text = ${data.where},
              when_text = ${data.when},
              month_label = ${data.monthLabel},
              who_text = ${data.who},
              excerpt = ${data.excerpt},
              body_md = ${data.body},
              published = ${data.published},
              cover_image_id = ${coverId},
              updated_at = now()
            WHERE id = ${tripId}
            RETURNING *
          `;
          if (!trip) {
            return Response.json({ error: "Trip not found" }, { status: 404 });
          }
          return Response.json({ trip });
        } catch (error) {
          if (error instanceof postgres.PostgresError && error.code === "23505") {
            return Response.json({ error: "Slug already exists" }, { status: 409 });
          }
          throw error;
        }
      },

      DELETE: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
          return Response.json({ error: "Missing id" }, { status: 400 });
        }
        await sql`DELETE FROM trips WHERE id = ${id}`;
        return Response.json({ ok: true });
      },
    },
  },
});
