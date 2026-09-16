// Orte einer Station (Restaurants, Cafés, Sehenswürdigkeiten). Nur im
// eingeloggten Studio erreichbar; öffentlich werden sie über trips.functions
// ausgeliefert — und nur für veröffentlichte Stationen.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";

const MAX_PLACES_PER_STATION = 50;

const CreateInput = z.object({
  stationId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().max(60).nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160).optional(),
  category: z.string().trim().max(60).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details: details ?? null }, { status: 400 });
}

export const Route = createFileRoute("/api/studio/places")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const tripId = searchParams.get("tripId");
        if (!z.string().uuid().safeParse(tripId).success) {
          return badRequest("Missing or invalid tripId");
        }
        const places = await sql`
          SELECT p.* FROM station_places p
          JOIN trip_stations s ON s.id = p.station_id
          WHERE s.trip_id = ${tripId}
          ORDER BY p.sort_order, p.created_at
        `;
        return Response.json({ places });
      },

      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = CreateInput.safeParse(await request.json());
        if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
        const d = parsed.data;

        const [station] = await sql`SELECT id FROM trip_stations WHERE id = ${d.stationId}`;
        if (!station) return Response.json({ error: "Station not found" }, { status: 404 });

        const [{ count }] = await sql<{ count: string }[]>`
          SELECT count(*)::text AS count FROM station_places WHERE station_id = ${d.stationId}
        `;
        if (Number(count) >= MAX_PLACES_PER_STATION) {
          return badRequest(`Maximal ${MAX_PLACES_PER_STATION} Orte pro Station`);
        }

        const [place] = await sql`
          INSERT INTO station_places (station_id, name, category, latitude, longitude, sort_order)
          VALUES (
            ${d.stationId}, ${d.name}, ${d.category ?? null}, ${d.latitude}, ${d.longitude},
            COALESCE((SELECT max(sort_order) + 1 FROM station_places WHERE station_id = ${d.stationId}), 0)
          )
          RETURNING *
        `;
        await auditLog({
          request,
          userId: session.userId,
          action: "place.create",
          targetId: place.id,
          meta: { stationId: d.stationId },
        });
        return Response.json({ place }, { status: 201 });
      },

      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = UpdateInput.safeParse(await request.json());
        if (!parsed.success) return badRequest("Invalid input", parsed.error.flatten());
        const d = parsed.data;

        const [current] = await sql`SELECT * FROM station_places WHERE id = ${d.id}`;
        if (!current) return Response.json({ error: "Place not found" }, { status: 404 });

        const [place] = await sql`
          UPDATE station_places SET
            name      = COALESCE(${d.name ?? null}, name),
            category  = ${d.category !== undefined ? d.category : current.category},
            latitude  = COALESCE(${d.latitude ?? null}, latitude),
            longitude = COALESCE(${d.longitude ?? null}, longitude)
          WHERE id = ${d.id}
          RETURNING *
        `;
        await auditLog({
          request,
          userId: session.userId,
          action: "place.update",
          targetId: place.id,
        });
        return Response.json({ place });
      },

      DELETE: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const parsedId = z.string().uuid().safeParse(searchParams.get("id"));
        if (!parsedId.success) return badRequest("Missing or invalid id");

        const [row] = await sql`
          DELETE FROM station_places WHERE id = ${parsedId.data} RETURNING id
        `;
        if (!row) return Response.json({ error: "Place not found" }, { status: 404 });
        await auditLog({
          request,
          userId: session.userId,
          action: "place.delete",
          targetId: parsedId.data,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
