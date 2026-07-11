import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/studio")({
  beforeLoad: async () => {
    throw redirect({ to: "/admin/studio" });
  },
});
