import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ location }) => {
    // Redirect /admin to /admin/studio
    if (location.pathname === "/admin") {
      throw redirect({ to: "/admin/studio" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
