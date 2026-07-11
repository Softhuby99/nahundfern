import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth.server";
import { storeImage, deleteImageFiles } from "@/lib/uploads.server";

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
        await requireAuth(request);
        const form = await request.formData();
        const tripId = form.get("tripId");
        const file = form.get("file");

        if (!tripId || typeof tripId !== "string") {
          return Response.json({ error: "Missing tripId" }, { status: 400 });
        }
        if (!file || !(file instanceof File)) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }
        if (!file.type.startsWith("image/")) {
          return Response.json({ error: "File must be an image" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const stored = await storeImage(buffer, file.name);

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
        return Response.json({ image }, { status: 201 });
      },

      PATCH: async ({ request }) => {
        await requireAuth(request);
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
        return Response.json({ image });
      },

      DELETE: async ({ request }) => {
        await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        if (!id) {
          return Response.json({ error: "Missing id" }, { status: 400 });
        }
        const [row] = await sql`
          SELECT original_path, webp_400, webp_1200, webp_2000, avif_400, avif_1200, avif_2000
          FROM images WHERE id = ${id}
        `;
        if (!row) {
          return Response.json({ error: "Image not found" }, { status: 404 });
        }
        await sql`DELETE FROM images WHERE id = ${id}`;
        await deleteImageFiles({
          originalPath: row.original_path,
          webp: { 400: row.webp_400, 1200: row.webp_1200, 2000: row.webp_2000 },
          avif: { 400: row.avif_400, 1200: row.avif_1200, 2000: row.avif_2000 },
        } as Parameters<typeof deleteImageFiles>[0]);
        return Response.json({ ok: true });
      },
    },
  },
});
