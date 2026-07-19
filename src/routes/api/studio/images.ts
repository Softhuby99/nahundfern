import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { storeImage, deleteImageFiles } from "@/lib/uploads.server";
import { auditLog } from "@/lib/audit.server";

const PatchInput = z.object({
  id: z.string().uuid(),
  alt: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/studio/images")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const tripId = searchParams.get("tripId");
        if (!tripId) {
          return Response.json({ error: "Missing tripId" }, { status: 400 });
        }
        const images = await sql`
          SELECT * FROM images WHERE trip_id = ${tripId} ORDER BY sort_order, created_at
        `;
        return Response.json({ images });
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

        // tripId muss eine gültige UUID sein — sonst gar nicht erst dekodieren.
        const parsedTripId = z.string().uuid().safeParse(rawTripId);
        if (!parsedTripId.success) {
          return Response.json({ error: "Invalid tripId" }, { status: 400 });
        }
        const tripId = parsedTripId.data;

        if (!file || !(file instanceof File)) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }
        // Grober Vorfilter — die echte Prüfung passiert in storeImage() via Sharp.
        if (!file.type.startsWith("image/")) {
          return Response.json({ error: "File must be an image" }, { status: 400 });
        }

        // Existenz der Reise VOR der teuren Bildverarbeitung prüfen,
        // damit ein FK-Miss keine Dateien auf der Platte hinterlässt.
        const [trip] = await sql`SELECT id FROM trips WHERE id = ${tripId}`;
        if (!trip) {
          return Response.json({ error: "Trip not found" }, { status: 404 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await storeImage(buffer, file.name);

        try {
          const [image] = await sql`
            INSERT INTO images (
              trip_id, original_path, webp_400, webp_1200, webp_2000,
              avif_400, avif_1200, avif_2000, width, height, mime, alt, sort_order
            ) VALUES (
              ${tripId}, ${stored.originalPath}, ${stored.webp[400]}, ${stored.webp[1200]}, ${stored.webp[2000]},
              ${stored.avif[400]}, ${stored.avif[1200]}, ${stored.avif[2000]},
              ${stored.width}, ${stored.height}, ${stored.mime}, ${file.name}, 0
            )
            RETURNING *
          `;
          await auditLog({
            request,
            userId: session.userId,
            action: "image.upload",
            targetId: image.id,
            meta: { tripId, size: buffer.length, mime: stored.mime },
          });
          return Response.json({ image }, { status: 201 });
        } catch (err) {
          // Insert scheiterte (z.B. Race Condition beim Trip-Delete) — Dateien
          // wieder löschen, damit keine Waisen auf der Platte bleiben.
          await deleteImageFiles({
            originalPath: stored.originalPath,
            webp: stored.webp,
            avif: stored.avif,
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
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const { id, alt, sortOrder } = parsed.data;
        const [image] = await sql`
          UPDATE images SET
            alt = COALESCE(${alt ?? null}, alt),
            sort_order = COALESCE(${sortOrder ?? null}, sort_order)
          WHERE id = ${id}
          RETURNING *
        `;
        if (!image) {
          return Response.json({ error: "Image not found" }, { status: 404 });
        }
        await auditLog({
          request,
          userId: session.userId,
          action: "image.update",
          targetId: image.id,
        });
        return Response.json({ image });
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
          SELECT original_path, webp_400, webp_1200, webp_2000, avif_400, avif_1200, avif_2000
          FROM images WHERE id = ${idParsed.data}
        `;
        if (!row) {
          return Response.json({ error: "Image not found" }, { status: 404 });
        }
        await sql`DELETE FROM images WHERE id = ${idParsed.data}`;
        await deleteImageFiles({
          originalPath: row.original_path,
          webp: { 400: row.webp_400, 1200: row.webp_1200, 2000: row.webp_2000 },
          avif: { 400: row.avif_400, 1200: row.avif_1200, 2000: row.avif_2000 },
        });
        await auditLog({
          request,
          userId: session.userId,
          action: "image.delete",
          targetId: idParsed.data,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
