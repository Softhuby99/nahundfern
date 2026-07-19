import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";
import { Calendar, MapPin, Clock, Star, Heart } from "lucide-react";

export const Route = createFileRoute("/stories/")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Meine Reiseberichte — Reisejournal" },
      {
        name: "description",
        content:
          "Alle Reiseberichte: echte Erlebnisse, ehrliche Geschichten und Momente, die mich berührt haben.",
      },
      { property: "og:title", content: "Meine Reiseberichte — Reisejournal" },
      {
        property: "og:description",
        content: "Echte Erlebnisse, ehrliche Geschichten und Momente, die mich berührt haben.",
      },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  const { trips } = Route.useLoaderData() as { trips: PublicTrip[] };
  const featured = trips[trips.length - 1];
  const rest = trips.slice(0, -1).reverse();

  const regions = useMemo(() => {
    const s = new Set<string>();
    trips.forEach((t) => s.add(t.region));
    return ["Alle Berichte", ...Array.from(s)];
  }, [trips]);

  const [active, setActive] = useState("Alle Berichte");
  const filtered = active === "Alle Berichte" ? rest : rest.filter((t) => t.region === active);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-12 text-center">
        <p className="font-script text-2xl text-primary flex items-center justify-center gap-2">
          Meine Erinnerungen. Mein Weg.{" "}
          <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mt-2">
          Meine Reiseberichte
        </h1>
        <p className="font-script text-2xl text-primary/80 mt-3 max-w-3xl mx-auto">
          Echte Erlebnisse, ehrliche Geschichten und Momente, die mich berührt haben.
        </p>
      </section>

      {featured && (
        <section className="max-w-6xl mx-auto px-6 md:px-8 mt-10">
          <Link
            to="/stories/$slug"
            params={{ slug: featured.slug }}
            className="paper-card overflow-hidden grid md:grid-cols-2 gap-0 hover:-translate-y-0.5 transition-transform group"
          >
            <div className="aspect-[4/3] md:aspect-auto overflow-hidden">
              <ResponsivePicture
                webp={featured.cover.webp}
                avif={featured.cover.avif}
                alt={featured.cover.alt ?? featured.title}
                width={1200}
                height={800}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-between">
              <div>
                <p className="flex items-center gap-2 text-primary text-sm">
                  <Star className="size-4 fill-primary/40" strokeWidth={1.5} /> Highlight der Woche
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-semibold mt-2 leading-tight group-hover:text-primary transition-colors">
                  {featured.title}
                </h2>
                <p className="text-primary mt-1">{featured.region}</p>
                <p className="font-script text-xl text-foreground/80 mt-4 leading-snug">
                  {featured.excerpt}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" strokeWidth={1.5} />
                  {featured.where}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="size-4" strokeWidth={1.5} />
                  {featured.when}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" strokeWidth={1.5} />
                  {featured.monthLabel}
                </span>
              </div>
            </div>
          </Link>
        </section>
      )}

      <section className="max-w-6xl mx-auto px-6 md:px-8 mt-10">
        <div className="paper-card p-3 flex flex-wrap gap-2 justify-center">
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => setActive(r)}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                active === r
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground/80 hover:text-primary"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-10 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((t: PublicTrip) => (
          <Link
            key={t.slug}
            to="/stories/$slug"
            params={{ slug: t.slug }}
            className="paper-card overflow-hidden flex flex-col group hover:-translate-y-1 transition-transform"
          >
            <div className="aspect-[16/10] overflow-hidden">
              <ResponsivePicture
                webp={t.cover.webp}
                avif={t.cover.avif}
                alt={t.cover.alt ?? t.title}
                width={800}
                height={500}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-semibold leading-tight group-hover:text-primary transition-colors">
                  {t.title}
                </h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                  <Calendar className="size-3.5" strokeWidth={1.5} />
                  {t.monthLabel}
                </span>
              </div>
              <p className="text-sm text-primary mt-1">{t.region}</p>
              <p className="font-script text-base text-foreground/80 mt-2 line-clamp-3 leading-snug">
                {t.excerpt}
              </p>
              <div className="mt-auto pt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5" strokeWidth={1.5} />
                  {t.when}
                </span>
                <span className="text-primary font-medium">Mehr lesen →</span>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
