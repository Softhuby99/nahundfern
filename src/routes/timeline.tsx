import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HorizontalTimeline } from "@/components/HorizontalTimeline";
import { listPublishedTrips } from "@/lib/trips.functions";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/timeline")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Meine Reise-Timeline — Reisejournal" },
      { name: "description", content: "Wo ich war, was ich erlebt habe und was mir geblieben ist — meine Reise-Timeline." },
      { property: "og:title", content: "Meine Reise-Timeline — Reisejournal" },
      { property: "og:description", content: "Wo ich war, was ich erlebt habe und was mir geblieben ist." },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const { trips } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-12 pb-6 text-center">
        <p className="font-script text-2xl text-primary flex items-center justify-center gap-2">
          Meine Erinnerungen. Mein Weg. <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mt-2">
          Meine Reise-Timeline
        </h1>
        <p className="font-script text-2xl text-primary/80 mt-3">
          Wo ich war, was ich erlebt habe und was mir geblieben ist.
        </p>
      </section>
      <HorizontalTimeline trips={trips} />
      <SiteFooter />
    </div>
  );
}
