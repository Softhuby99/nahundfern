import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { parseSessionCookie, verifySessionToken } from "@/lib/auth.server";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    // Client-side we can also check the cookie via a lightweight API call, but
    // for SSR we verify the token directly here. The token is signed with a
    // server secret, so this is safe and avoids an extra round-trip.
    const request = context.request as Request | undefined;
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
