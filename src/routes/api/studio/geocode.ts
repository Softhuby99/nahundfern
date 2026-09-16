// Ortssuche über einen serverseitigen Nominatim-Proxy. Der Browser des
// Besuchers spricht nie direkt mit dem Geocoder — so bleibt die
// Nutzungsrichtlinie (1 Anfrage/s, eigener User-Agent) einhaltbar.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import { geocodeSearch, geocodeReverse } from "@/lib/routing.server";

const SearchInput = z.object({
  q: z.string().trim().min(2).max(200),
  /** true = Eigennamen/Kategorien behalten (Restaurants, Cafés, Orte). */
  poi: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).optional(),
  near: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
});

const ReverseInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const Route = createFileRoute("/api/studio/geocode")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        await requireAuth(request);

        const body = (await request.json()) as unknown;
        const asReverse = ReverseInput.safeParse(body);
        try {
          if (asReverse.success) {
            const result = await geocodeReverse(asReverse.data.latitude, asReverse.data.longitude);
            return Response.json({ result });
          }
          const asSearch = SearchInput.safeParse(body);
          if (!asSearch.success) {
            return Response.json({ error: "Invalid input" }, { status: 400 });
          }
          const results = await geocodeSearch(asSearch.data.q);
          return Response.json({ results });
        } catch (err) {
          console.warn("geocode failed", (err as Error).message);
          // Editor zeigt daraufhin die manuelle Koordinateneingabe an.
          return Response.json(
            { error: "Ortssuche derzeit nicht erreichbar", results: [], result: null },
            { status: 503 },
          );
        }
      },
    },
  },
});
