// Berechnet die Straßengeometrie einer Reiseroute neu und speichert sie.
// Läuft nur im Studio; die öffentliche Seite liest ausschließlich gespeicherte
// Geometrie und stellt keine Routing-Anfragen.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";
import { recomputeTripRoute } from "@/lib/stations.server";

const Input = z.object({ tripId: z.string().uuid() });

export const Route = createFileRoute("/api/studio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const parsed = Input.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }
        const summary = await recomputeTripRoute(parsed.data.tripId);
        await auditLog({
          request,
          userId: session.userId,
          action: "station.route",
          targetId: parsed.data.tripId,
          meta: summary,
        });
        return Response.json({ ok: true, ...summary });
      },
    },
  },
});
