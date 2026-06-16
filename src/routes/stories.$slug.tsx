import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getTrip, trips } from "@/data/trips";

export const Route = createFileRoute("/stories/$slug")({
  loader: ({ params }) => {
    const trip = getTrip(params.slug);
    if (!trip) throw notFound();
    return { trip };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.trip;
    if (!t) return { meta: [{ title: "Story — Vagabond" }] };
    return {
      meta: [
        { title: `${t.title} — Vagabond` },
        { name: "description", content: t.excerpt },
        { property: "og:title", content: `${t.title} — Vagabond` },
        { property: "og:description", content: t.excerpt },
        { property: "og:image", content: t.cover },
        { name: "twitter:image", content: t.cover },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">404</p>
        <h1 className="font-display text-5xl uppercase tracking-tighter mb-6">Story not found</h1>
        <Link to="/stories" className="font-mono text-[10px] uppercase tracking-widest border-b border-border pb-1 hover:text-primary">
          ← All stories
        </Link>
      </div>
    </div>
  ),
  component: StoryPage,
});

function StoryPage() {
  const { trip } = Route.useLoaderData();
  const idx = trips.findIndex((t) => t.slug === trip.slug);
  const next = trips[(idx + 1) % trips.length];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <article>
        {/* Cover */}
        <div className="relative h-[60vh] md:h-[80vh] overflow-hidden">
          <img src={trip.cover} alt={trip.title} width={1024} height={1280} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-background/20" />
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-8 pb-12 max-w-5xl mx-auto">
            <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">{trip.monthLabel} · {trip.region}</p>
            <h1 className="font-display text-5xl md:text-8xl uppercase leading-[0.85] tracking-tighter">{trip.title}</h1>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 md:px-8 max-w-5xl mx-auto py-12 grid md:grid-cols-3 gap-8 border-b border-border">
          <MetaCell label="Where" value={trip.where} />
          <MetaCell label="When" value={trip.when} />
          <MetaCell label="Crew" value={trip.who} />
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 max-w-3xl mx-auto py-16">
          <p className="font-display text-2xl md:text-3xl leading-snug mb-12 tracking-tight">
            {trip.excerpt}
          </p>
          <div className="space-y-6 text-lg leading-relaxed text-foreground/90">
            {trip.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>

        {/* Next */}
        <div className="px-6 md:px-8 max-w-5xl mx-auto py-16 border-t border-border flex items-center justify-between gap-8">
          <Link to="/stories" className="font-mono text-[10px] uppercase tracking-widest hover:text-primary">
            ← All stories
          </Link>
          <Link to="/stories/$slug" params={{ slug: next.slug }} className="group text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Next station</p>
            <p className="font-display text-2xl md:text-3xl uppercase tracking-tight group-hover:text-primary transition-colors">{next.title} →</p>
          </Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">{label}</p>
      <p className="text-base leading-relaxed">{value}</p>
    </div>
  );
}
