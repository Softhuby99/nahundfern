import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    // Client-side auth gate for /admin: check session, redirect to login if missing.
    // Skipped during SSR/prerender where fetch has no cookies.
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (!res.ok) {
          throw redirect({ to: "/admin/login" });
        }
      } catch (e) {
        if (e && typeof e === "object" && "isRedirect" in e) throw e;
        // Network error → send to login so the user can retry there.
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
