// Stations-CRUD für den Studio-Editor. Alle Endpunkte verlangen Login und
// Same-Origin; öffentliche Besucher kommen hier nie an.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";

/** Obergrenze pro Reise — schützt Karte, Routing und Payload-Größe. */
const MAX_STATIONS_PER_TRIP = 100;

const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum muss YYYY-MM-TT sein")
  .refine((v) => !Number.isNaN(Date.parse(v)), "Ungültiges Datum");

const LegMode = z.enum(["drive", "train", "cycle", "walk", "air"]);

/** Tageseinträge: pro Aufenthaltstag ein eigener Text. */
const DayEntries = z
  .array(z.object({ date: IsoDate, bodyMd: z.string().max(20000) }))
  .max(120);

/**
 * Datumswerte kommen aus Postgres als Date-Objekt zurück. `String(date)` würde
 * „Wed Sep 16 …“ ergeben und beim Zurückschreiben das Datum zerstören — deshalb
 * hier immer normalisieren.
 */
function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    return utc.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

const CreateInput = z.object({
  tripId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  countryCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/)
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  arrivalDate: IsoDate.nullable().optional(),
  departureDate: IsoDate.nullable().optional(),
  bodyMd: z.string().max(20000).optional(),
  legMode: LegMode.optional(),
});

const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  countryCode: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}$/)
    .nullable()
    .optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  arrivalDate: IsoDate.nullable().optional(),
  departureDate: IsoDate.nullable().optional(),
  bodyMd: z.string().max(20000).optional(),
  legMode: LegMode.optional(),
  published: z.boolean().optional(),
  isDestination: z.boolean().optional(),
  markerImageId: z.string().uuid().nullable().optional(),
  dailyEnabled: z.boolean().optional(),
  dayEntries: DayEntries.optional(),
});

const ReorderInput = z.object({
  tripId: z.string().uuid(),
  /** VOLLSTÄNDIGE Liste aller Stations-IDs der Reise in neuer Reihenfolge. */
  order: z.array(z.string().uuid()).min(1).max(MAX_STATIONS_PER_TRIP),
});

function badRequest(message: string, details?: unknown) {
  return Response.json({ error: message, details: details ?? null }, { status: 400 });
}

export const Route = createFileRoute("/api/studio/stations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const tripId = searchParams.get("tripId");
        if (!z.string().uuid().safeParse(tripId).success) {
          return badRequest("Missing or invalid tripId");
        }
        const stations = await sql`
          SELECT * FROM trip_stations
          WHERE trip_id = ${tripId}
          ORDER BY sort_order, created_at
        `;
        return Response.json({ stations });
      },

      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = CreateInput.safeParse(await request.json());
        if (!parsed.success) {
          return badRequest("Invalid input", parsed.error.flatten());
        }
        const d = parsed.data;
        if (d.arrivalDate && d.departureDate && d.departureDate < d.arrivalDate) {
          return badRequest("Abreise darf nicht vor der Ankunft liegen");
        }

        const [trip] = await sql`SELECT id, published FROM trips WHERE id = ${d.tripId}`;
        if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

        const [{ count }] = await sql<{ count: string }[]>`
          SELECT count(*)::text AS count FROM trip_stations WHERE trip_id = ${d.tripId}
        `;
        if (Number(count) >= MAX_STATIONS_PER_TRIP) {
          return badRequest(`Maximal ${MAX_STATIONS_PER_TRIP} Stationen pro Reise`);
        }

        const [station] = await sql`
          INSERT INTO trip_stations (
            trip_id, name, country_code, latitude, longitude,
            arrival_date, departure_date, body_md, leg_mode, published, sort_order
          ) VALUES (
            ${d.tripId}, ${d.name}, ${d.countryCode ?? null}, ${d.latitude}, ${d.longitude},
            ${d.arrivalDate ?? null}, ${d.departureDate ?? null}, ${d.bodyMd ?? ""},
            ${d.legMode ?? "drive"}, ${Boolean(trip.published)},
            COALESCE((SELECT max(sort_order) + 1 FROM trip_stations WHERE trip_id = ${d.tripId}), 0)
          )
          RETURNING *
        `;
        await auditLog({
          request,
          userId: session.userId,
          action: "station.create",
          targetId: station.id,
          meta: { tripId: d.tripId },
        });
        return Response.json({ station }, { status: 201 });
      },

      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = UpdateInput.safeParse(await request.json());
        if (!parsed.success) {
          return badRequest("Invalid input", parsed.error.flatten());
        }
        const d = parsed.data;

        const [current] = await sql`SELECT * FROM trip_stations WHERE id = ${d.id}`;
        if (!current) return Response.json({ error: "Station not found" }, { status: 404 });

        const arrival = d.arrivalDate !== undefined ? d.arrivalDate : current.arrival_date;
        const departure = d.departureDate !== undefined ? d.departureDate : current.departure_date;
        const arrivalIso = toIsoDate(arrival);
        const departureIso = toIsoDate(departure);
        if (arrivalIso && departureIso && departureIso < arrivalIso) {
          return badRequest("Abreise darf nicht vor der Ankunft liegen");
        }

        // Markerbild muss ein Bild derselben Reise sein.
        if (d.markerImageId) {
          const [img] = await sql`
            SELECT id FROM images WHERE id = ${d.markerImageId} AND trip_id = ${current.trip_id}
          `;
          if (!img) return badRequest("Markerbild gehört nicht zu dieser Reise");
        }

        // Zielort: höchstens einer pro Reise, und nur veröffentlicht.
        const willPublish = d.published !== undefined ? d.published : current.published;
        if (d.isDestination === true) {
          if (!willPublish) {
            return badRequest("Nur veröffentlichte Stationen können Zielort sein");
          }
          await sql`
            UPDATE trip_stations SET is_destination = false, updated_at = now()
            WHERE trip_id = ${current.trip_id} AND id <> ${d.id} AND is_destination = true
          `;
        }
        // Wird eine Station zurückgezogen, verliert sie automatisch den Zielort-Status.
        const nextDestination =
          d.isDestination !== undefined ? d.isDestination : current.is_destination;
        const destination = willPublish ? nextDestination : false;

        const [station] = await sql.begin(async (tx) => {
          const [updated] = await tx`
            UPDATE trip_stations SET
            name            = COALESCE(${d.name ?? null}, name),
            country_code    = ${d.countryCode !== undefined ? d.countryCode : current.country_code},
            latitude        = COALESCE(${d.latitude ?? null}, latitude),
            longitude       = COALESCE(${d.longitude ?? null}, longitude),
            arrival_date    = ${arrivalIso},
            departure_date  = ${departureIso},
            body_md         = COALESCE(${d.bodyMd ?? null}, body_md),
            leg_mode        = COALESCE(${d.legMode ?? null}, leg_mode),
            published       = ${willPublish},
            is_destination  = ${destination},
            marker_image_id = ${d.markerImageId !== undefined ? d.markerImageId : current.marker_image_id},
            daily_enabled   = ${d.dailyEnabled !== undefined ? d.dailyEnabled : current.daily_enabled},
            day_entries     = ${
              d.dayEntries !== undefined
                ? JSON.stringify(d.dayEntries)
                : JSON.stringify(current.day_entries ?? [])
            }::jsonb,
            -- Koordinaten- oder Modusänderung macht gespeicherte Straßengeometrie ungültig.
            leg_geometry    = ${
              d.latitude !== undefined || d.longitude !== undefined || d.legMode !== undefined
                ? null
                : current.leg_geometry
            },
            updated_at      = now()
            WHERE id = ${d.id}
            RETURNING *
          `;

          // Medien bleiben erhalten, verlieren aber eine Tageszuordnung, wenn
          // der Tagesmodus aus ist oder das Datum nicht mehr zum Aufenthalt passt.
          // Offene Enden begrenzen nicht — nur vorhandene Datumsgrenzen zählen.
          await tx`
            UPDATE images SET day_date = NULL
            WHERE station_id = ${d.id}
              AND day_date IS NOT NULL
              AND (
                ${!updated.daily_enabled}
                OR day_date < ${toIsoDate(updated.arrival_date)}::date
                OR day_date > ${toIsoDate(updated.departure_date)}::date
              )
          `;
          await tx`
            UPDATE videos SET day_date = NULL
            WHERE station_id = ${d.id}
              AND day_date IS NOT NULL
              AND (
                ${!updated.daily_enabled}
                OR day_date < ${toIsoDate(updated.arrival_date)}::date
                OR day_date > ${toIsoDate(updated.departure_date)}::date
              )
          `;
          return [updated];
        });
        await auditLog({
          request,
          userId: session.userId,
          action:
            d.published === true
              ? "station.publish"
              : d.published === false
                ? "station.unpublish"
                : d.isDestination !== undefined
                  ? "station.destination"
                  : "station.update",
          targetId: station.id,
        });
        return Response.json({ station });
      },

      PUT: async ({ request }) => {
        // Reihenfolge neu setzen — erwartet die vollständige Liste.
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = ReorderInput.safeParse(await request.json());
        if (!parsed.success) {
          return badRequest("Invalid input", parsed.error.flatten());
        }
        const { tripId, order } = parsed.data;
        if (new Set(order).size !== order.length) {
          return badRequest("Doppelte Stations-IDs in der Reihenfolge");
        }

        const existing = await sql<{ id: string }[]>`
          SELECT id FROM trip_stations WHERE trip_id = ${tripId}
        `;
        const existingIds = new Set(existing.map((r) => r.id));
        if (existingIds.size !== order.length || !order.every((id) => existingIds.has(id))) {
          return badRequest("Reihenfolge muss genau alle Stationen dieser Reise enthalten");
        }

        await sql.begin(async (tx) => {
          for (let i = 0; i < order.length; i++) {
            await tx`
              UPDATE trip_stations SET sort_order = ${i}, updated_at = now()
              WHERE id = ${order[i]} AND trip_id = ${tripId}
            `;
          }
          // Straßengeometrie hängt an der Vorgängerstation → neu berechnen lassen.
          await tx`
            UPDATE trip_stations SET leg_geometry = NULL WHERE trip_id = ${tripId}
          `;
        });

        await auditLog({
          request,
          userId: session.userId,
          action: "station.reorder",
          targetId: tripId,
          meta: { count: order.length },
        });
        return Response.json({ ok: true });
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

        // Medien bleiben erhalten und fallen per ON DELETE SET NULL zurück
        // in die allgemeine Galerie der Reise.
        const [row] = await sql`
          DELETE FROM trip_stations WHERE id = ${parsedId.data} RETURNING id, trip_id
        `;
        if (!row) return Response.json({ error: "Station not found" }, { status: 404 });

        await sql`
          UPDATE trip_stations SET leg_geometry = NULL WHERE trip_id = ${row.trip_id}
        `;
        await auditLog({
          request,
          userId: session.userId,
          action: "station.delete",
          targetId: parsedId.data,
          meta: { tripId: row.trip_id },
        });
        return Response.json({ ok: true });
      },
    },
  },
});
