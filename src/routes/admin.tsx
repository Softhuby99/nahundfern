import { createFileRoute, Outlet, redirect, isRedirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    // /admin/login is public — never gate it.
    if (location.pathname === "/admin/login") return;

    // Client-side auth gate: check session, redirect to login if missing.
    // Skipped during SSR/prerender where fetch has no cookies.
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!res.ok) {
          throw redirect({ to: "/admin/login" });
        }
      } catch (e) {
        if (isRedirect(e)) throw e;

        throw redirect({ to: "/admin/login" });
      }
    }
    if (location.pathname === "/admin") {
      throw redirect({ to: "/admin/studio" });
    }
  },

  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
