import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { updatePoster, VideoError, cleanupStaleLocksOnce } from "@/lib/videos.server";
import { auditLog } from "@/lib/audit.server";

const PosterInput = z.object({
  id: z.string().uuid(),
  atMs: z.number().int().min(0),
});

export const Route = createFileRoute("/api/studio/videos/poster")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        cleanupStaleLocksOnce();

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = PosterInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Ungültige Eingabe", details: parsed.error.format() }, { status: 400 });
        }
        const { id, atMs } = parsed.data;

        try {
          const video = await updatePoster({ id, visibleAtMs: atMs, signal: request.signal });
          await auditLog({
            request,
            userId: session.userId,
            action: "video.update",
            targetId: id,
            meta: {
              op: "poster",
              posterAtMs: video.poster_at_ms,
              posterVersion: video.poster_version,
            },
          });
          return Response.json({ video });
        } catch (err) {
          if (err instanceof VideoError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          const msg = err instanceof Error ? err.message : "Poster fehlgeschlagen";
          const kind = (err as { kind?: string })?.kind;
          const status = kind === "timeout" ? 504 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
