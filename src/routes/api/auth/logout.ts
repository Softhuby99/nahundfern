import { createFileRoute } from "@tanstack/react-router";
import {
  clearSessionCookie,
  parseSessionCookie,
  requireSameOrigin,
  verifySessionToken,
} from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";

export const Route = createFileRoute("/api/auth/logout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }

        // Best-effort: identify the user for the audit trail, but never
        // block logout on a bad/expired token.
        let userId: string | null = null;
        const token = parseSessionCookie(request);
        if (token) {
          try {
            const { userId: uid } = await verifySessionToken(token);
            userId = uid;
          } catch {
            /* ignore */
          }
        }
        await auditLog({ request, userId, action: "auth.logout" });

        const isSecure =
          request.headers.get("x-forwarded-proto") === "https" ||
          request.headers.get("x-forwarded-port") === "443" ||
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
