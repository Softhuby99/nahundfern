import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { storeVideo, deleteVideoFiles, VideoError } from "@/lib/videos.server";
import { auditLog } from "@/lib/audit.server";

const PatchInput = z.object({
  id: z.string().uuid(),
  alt: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/studio/videos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const tripId = searchParams.get("tripId");
        if (!tripId) return Response.json({ error: "Missing tripId" }, { status: 400 });
        const videos = await sql`
          SELECT * FROM videos WHERE trip_id = ${tripId} ORDER BY sort_order, created_at
        `;
        return Response.json({ videos });
      },

      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const form = await request.formData();
        const rawTripId = form.get("tripId");
        const file = form.get("file");

        const parsedTripId = z.string().uuid().safeParse(rawTripId);
        if (!parsedTripId.success) {
          return Response.json({ error: "Invalid tripId" }, { status: 400 });
        }
        const tripId = parsedTripId.data;

        if (!file || !(file instanceof File)) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }
        if (!file.type.startsWith("video/")) {
          return Response.json({ error: "File must be a video" }, { status: 400 });
        }

        const [trip] = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
        if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });

        const buffer = Buffer.from(await file.arrayBuffer());
        let stored;
        try {
          stored = await storeVideo(buffer, file.name);
        } catch (err) {
          if (err instanceof VideoError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          return Response.json(
            { error: err instanceof Error ? err.message : "Video-Verarbeitung fehlgeschlagen" },
            { status: 500 },
          );
        }

        try {
          const [video] = await sql`
            INSERT INTO videos (
              id, trip_id, original_path, mp4_720_path, poster_path,
              width, height, duration_ms, bytes, mime, alt, sort_order,
              original_duration_ms, video_version, poster_version
            ) VALUES (
              ${stored.id}, ${tripId}, ${stored.originalPath}, ${stored.mp4_720_path}, ${stored.posterPath},
              ${stored.width}, ${stored.height}, ${stored.durationMs}, ${stored.bytes},
              ${stored.mime}, ${file.name}, 0,
              ${stored.originalDurationMs}, ${stored.videoVersion}, ${stored.posterVersion}
            )
            RETURNING *
          `;
          await auditLog({
            request,
            userId: session.userId,
            action: "video.upload",
            targetId: video.id,
            meta: { tripId, bytes: stored.bytes, durationMs: stored.durationMs },
          });
          return Response.json({ video }, { status: 201 });
        } catch (err) {
          await deleteVideoFiles({
            originalPath: stored.originalPath,
            mp4_720_path: stored.mp4_720_path,
            posterPath: stored.posterPath,
          }).catch(() => {});
          throw err;
        }
      },

      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const body = await request.json();
        const parsed = PatchInput.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Invalid input" }, { status: 400 });
        const { id, alt, sortOrder } = parsed.data;
        const [video] = await sql`
          UPDATE videos SET
            alt = COALESCE(${alt ?? null}, alt),
            sort_order = COALESCE(${sortOrder ?? null}, sort_order)
          WHERE id = ${id}
          RETURNING *
        `;
        if (!video) return Response.json({ error: "Video not found" }, { status: 404 });
        await auditLog({
          request,
          userId: session.userId,
          action: "video.update",
          targetId: video.id,
        });
        return Response.json({ video });
      },

      DELETE: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const idParsed = z.string().uuid().safeParse(id);
        if (!idParsed.success) {
          return Response.json({ error: "Missing or invalid id" }, { status: 400 });
        }
        const [row] = await sql`
          SELECT original_path, mp4_720_path, poster_path
          FROM videos WHERE id = ${idParsed.data}
        `;
        if (!row) return Response.json({ error: "Video not found" }, { status: 404 });
        await sql`DELETE FROM videos WHERE id = ${idParsed.data}`;
        await deleteVideoFiles({
          originalPath: row.original_path,
          mp4_720_path: row.mp4_720_path,
          posterPath: row.poster_path,
        });
        await auditLog({
          request,
          userId: session.userId,
          action: "video.delete",
          targetId: idParsed.data,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
