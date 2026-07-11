import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { parseSessionCookie, verifySessionToken } from "@/lib/auth.server";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ request }) => {
    // For SSR we verify the signed httpOnly cookie directly. On the client the
    // same request object carries the cookie header, so the gate works in both
    // environments without an extra API round-trip.
    if (!request) {
      throw redirect({ to: "/_admin/login" });
    }
    const token = parseSessionCookie(request);
    if (!token) {
      throw redirect({ to: "/_admin/login" });
    }
    try {
      await verifySessionToken(token);
    } catch {
      throw redirect({ to: "/_admin/login" });
    }
  },
  component: () => <Outlet />,
});
