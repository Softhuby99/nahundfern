import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { trimVideo, VideoError, cleanupStaleLocksOnce } from "@/lib/videos.server";
import { auditLog } from "@/lib/audit.server";

const TrimInput = z.object({
  id: z.string().uuid(),
  startMs: z.number().int().min(0).nullable(),
  endMs: z.number().int().min(0).nullable(),
});

export const Route = createFileRoute("/api/studio/videos/trim")({
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
        const parsed = TrimInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Ungültige Eingabe", details: parsed.error.format() }, { status: 400 });
        }
        const { id, startMs, endMs } = parsed.data;

        try {
          const { video, posterBumped } = await trimVideo({
            id,
            startMs,
            endMs,
            signal: request.signal,
          });
          await auditLog({
            request,
            userId: session.userId,
            action: "video.update",
            targetId: id,
            meta: {
              op: "trim",
              trimStartMs: startMs,
              trimEndMs: endMs,
              newDurationMs: video.duration_ms,
              videoVersion: video.video_version,
              posterVersionBumped: posterBumped,
            },
          });
          return Response.json({ video });
        } catch (err) {
          if (err instanceof VideoError) {
            return Response.json({ error: err.message }, { status: err.status });
          }
          const msg = err instanceof Error ? err.message : "Trim fehlgeschlagen";
          const kind = (err as { kind?: string })?.kind;
          const status = kind === "timeout" ? 504 : 500;
          return Response.json({ error: msg }, { status });
        }
      },
    },
  },
});
