// Frühere Fassungen von Stationstexten auflisten und wiederherstellen.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";
import { normalizeDayEntries, saveStationVersion } from "@/lib/station-text.server";

export const Route = createFileRoute("/api/studio/station-versions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const stationId = new URL(request.url).searchParams.get("stationId");
        if (!z.string().uuid().safeParse(stationId).success) {
          return Response.json({ error: "Missing or invalid stationId" }, { status: 400 });
        }
        const rows = await sql`
          SELECT id, name, body_md, day_entries, created_at
          FROM trip_station_versions
          WHERE station_id = ${stationId}
          ORDER BY created_at DESC
          LIMIT 50
        `;
        const versions = rows.map((r) => {
          const days = normalizeDayEntries(r.day_entries).filter((d) => d.bodyMd.trim());
          return {
            id: String(r.id),
            name: r.name as string,
            createdAt: r.created_at,
            days: days.length,
            chars:
              String(r.body_md ?? "").length + days.reduce((n, d) => n + d.bodyMd.length, 0),
          };
        });
        return Response.json({ versions });
      },

      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = z.object({ versionId: z.string().regex(/^\d+$/) }).safeParse(
          await request.json(),
        );
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });

        const [version] = await sql`
          SELECT * FROM trip_station_versions WHERE id = ${parsed.data.versionId}
        `;
        if (!version) return Response.json({ error: "Fassung nicht gefunden" }, { status: 404 });
        const [current] = await sql`SELECT * FROM trip_stations WHERE id = ${version.station_id}`;
        if (!current) return Response.json({ error: "Station nicht gefunden" }, { status: 404 });

        // Auch der aktuelle Stand wird vorher gesichert — Wiederherstellen ist umkehrbar.
        const [station] = await sql.begin(async (tx) => {
          await saveStationVersion(tx, current as never, session.userId);
          return tx`
            UPDATE trip_stations SET
              name = ${version.name},
              body_md = ${version.body_md},
              day_entries = ${JSON.stringify(normalizeDayEntries(version.day_entries))}::jsonb,
              daily_enabled = ${version.daily_enabled || current.daily_enabled},
              updated_at = now()
            WHERE id = ${current.id}
            RETURNING *
          `;
        });
        await auditLog({
          request,
          userId: session.userId,
          action: "station.restore",
          targetId: current.id,
          meta: { versionId: parsed.data.versionId },
        });
        return Response.json({ station });
      },
    },
  },
});
