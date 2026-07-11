import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/")({
  beforeLoad: async () => {
    throw redirect({ to: "/_admin/studio" });
  },
});
