import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { listPublishedTrips } from "@/lib/trips.functions";

export const Route = createFileRoute("/stories")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Stories — Vagabond" },
      { name: "description", content: "Alle Reiseberichte aus Europa und Nordamerika." },
      { property: "og:title", content: "Stories — Vagabond" },
      { property: "og:description", content: "Alle Reiseberichte aus Europa und Nordamerika." },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  const { trips } = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="px-6 md:px-8 pt-16 pb-12 max-w-7xl mx-auto">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">Archive</p>
        <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.9] tracking-tighter">
          Alle Stories
        </h1>
      </section>

      <section className="px-6 md:px-8 pb-24 max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {trips.map((t: PublicTrip) => (
          <Link key={t.slug} to="/stories/$slug" params={{ slug: t.slug }} className="group">
            <div className="overflow-hidden aspect-[4/5] mb-4 bg-card">
              <ResponsivePicture
                webp={t.cover.webp}
                avif={t.cover.avif}
                alt={t.cover.alt ?? t.title}
                width={1024}
                height={1280}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
              />
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.monthLabel}</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">· {t.region}</span>
            </div>
            <h2 className="font-display text-2xl md:text-3xl uppercase tracking-tight group-hover:text-primary transition-colors">{t.title}</h2>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t.excerpt}</p>
          </Link>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
