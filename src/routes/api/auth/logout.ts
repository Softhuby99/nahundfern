import { createFileRoute } from "@tanstack/react-router";
import { clearSessionCookie } from "@/lib/auth.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const isSecure =
          request.headers.get("x-forwarded-proto") === "https" ||
          new URL(request.url).protocol === "https:";
        return Response.json(
          { ok: true },
          {
            headers: { "Set-Cookie": clearSessionCookie(isSecure) },
          },
        );
      },
    },
  },
});
