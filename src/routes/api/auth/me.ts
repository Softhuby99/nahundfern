import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/me")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await requireAuth(request);
        // Look up the email fresh from the DB instead of embedding it in the JWT.
        const [user] = await sql`SELECT email FROM users WHERE id = ${session.userId}`;
        if (!user) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        return Response.json({ userId: session.userId, email: user.email });
      },
    },
  },
});
