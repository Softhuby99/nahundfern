import { createFileRoute } from "@tanstack/react-router";
import { sql } from "@/lib/db.server";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        try {
          await sql`SELECT 1`;
          return Response.json({ status: "ok", db: "ok" });
        } catch (error) {
          console.error("health check failed", error);
          return Response.json({ status: "error", db: "down" }, { status: 503 });
        }
      },
    },
  },
});
