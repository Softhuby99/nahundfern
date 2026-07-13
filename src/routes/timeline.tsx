import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HorizontalTimeline } from "@/components/HorizontalTimeline";
import { listPublishedTrips } from "@/lib/trips.functions";

export const Route = createFileRoute("/timeline")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Timeline — Vagabond" },
      { name: "description", content: "Der vollständige horizontale Zeitstrahl aller Reisen 2024." },
      { property: "og:title", content: "Timeline — Vagabond" },
      { property: "og:description", content: "Der vollständige horizontale Zeitstrahl aller Reisen 2024." },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const { trips } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="px-6 md:px-8 pt-16 pb-8 max-w-7xl mx-auto">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">The Route · 2024</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-tight font-light leading-[1.05] mb-6">
          A year on a single line
        </h1>
        <p className="max-w-2xl text-muted-foreground leading-relaxed">
          Acht Reisen, zwei Kontinente, eine Linie. Bewege den Mauszeiger über eine Karte, um Ort, Zeit und Begleitung zu sehen — und öffne den Reisebericht.
        </p>
      </section>
      <HorizontalTimeline trips={trips} defaultActiveSlug={trips[0]?.slug} />
      <SiteFooter />
    </div>
  );
}
