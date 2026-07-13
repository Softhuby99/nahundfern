import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HorizontalTimeline, ResponsivePicture } from "@/components/HorizontalTimeline";
import { listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";
import aboutDesk from "@/assets/about-desk.jpg";

export const Route = createFileRoute("/")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Vagabond — Reisejournal Europa & Nordamerika" },
      { name: "description", content: "Ein cinematisches Reisejournal mit horizontalem Zeitstrahl — Geschichten aus Lissabon, Norwegen, der Toskana, Island, New York, Banff, Route 66 und Yellowstone." },
      { property: "og:title", content: "Vagabond — Reisejournal Europa & Nordamerika" },
      { property: "og:description", content: "Ein cinematisches Reisejournal mit horizontalem Zeitstrahl." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { trips } = Route.useLoaderData();
  const latest = trips.slice(0, 3);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="px-6 md:px-8 pt-16 md:pt-24 pb-12 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-[1fr_360px] gap-12 items-end">
          <div style={{ animation: "revealNode 0.8s var(--ease-cinematic) both" }}>
            <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">The 2024 Collection</p>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-tight font-light leading-[1.05]">
              Northern<br />Hemispheres
            </h1>
          </div>
          <div
            className="flex flex-col gap-6 pb-2 border-l border-border pl-6 lg:pl-8"
            style={{ animation: "revealNode 0.8s var(--ease-cinematic) 100ms both" }}
          >
            <p className="text-muted-foreground text-pretty leading-relaxed text-lg">
              Ein freundliches Reisejournal aus Europa und Nordamerika. Acht Stationen, ein Jahr, eine durchgehende Linie. Vom warmen Licht über Lissabons Dächern bis in den Schnee des Yellowstone.
            </p>
            <div className="flex gap-3">
              <Link to="/timeline" className="px-4 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 transition-colors rounded-sm">
                Zur Timeline
              </Link>
              <Link to="/stories" className="px-4 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary transition-colors rounded-sm">
                Alle Stories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal signature timeline */}
      <HorizontalTimeline trips={trips} defaultActiveSlug="geiranger" />

      {/* Latest stories teaser */}
      <section className="px-6 md:px-8 py-24 border-t border-border max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <h2 className="font-display text-3xl md:text-5xl tracking-tight font-light">Neueste Geschichten</h2>
          <Link to="/stories" className="font-mono text-[10px] uppercase tracking-widest border-b border-border pb-1 hover:text-primary hover:border-primary transition-colors">
            Alle ansehen
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-10">
          {latest.map((t: PublicTrip) => (
            <Link
              key={t.slug}
              to="/stories/$slug"
              params={{ slug: t.slug }}
              className="group"
            >
              <div className="overflow-hidden mb-4 aspect-[4/5] bg-card rounded-sm">
                <ResponsivePicture
                  webp={t.cover.webp}
                  avif={t.cover.avif}
                  alt={t.cover.alt ?? t.title}
                  width={1024}
                  height={1280}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                />
              </div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.monthLabel}</p>
              <h3 className="font-display text-2xl tracking-tight font-medium mt-1 group-hover:text-primary transition-colors">{t.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{t.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* About teaser — inverted block */}
      <section className="px-6 md:px-8 py-24 md:py-32 border-t border-border bg-card">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-16 items-center">
          <div className="flex-1">
            <h2 className="font-display text-4xl md:text-6xl tracking-tight font-light leading-tight mb-8">
              Capturing the <span className="text-primary">flicker</span> of a journey.
            </h2>
            <p className="text-lg md:text-xl leading-relaxed mb-12 max-w-prose text-muted-foreground">
              Reisen ist für mich keine Liste von Zielen, sondern eine Abfolge von Einzelbildern. Dieses Journal ist die Brücke zwischen Filmkorn und Browser — für alle, die das Dazwischen mehr lieben als das Ankommen.
            </p>
            <Link to="/about" className="inline-block border-b-2 border-border pb-1 font-display tracking-tight font-medium hover:border-primary hover:text-primary transition-colors">
              Meine Philosophie →
            </Link>
          </div>
          <div className="w-full md:w-1/3 aspect-[4/5] p-3 bg-background/50 rounded-sm">
            <img src={aboutDesk} alt="Desk with camera and maps" loading="lazy" width={1024} height={1280} className="w-full h-full object-cover rounded-sm" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
