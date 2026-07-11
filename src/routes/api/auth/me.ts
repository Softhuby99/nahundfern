import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireAuth(request);
        return Response.json({ userId: session.userId, email: session.email });
      },
    },
  },
});
