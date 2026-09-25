import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { listMapTrips, listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { ArrowRight, Heart, MapPin } from "lucide-react";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [trips, mapTrips] = await Promise.all([listPublishedTrips(), listMapTrips()]);
    return { trips, mapTrips };
  },
  head: () => ({
    meta: [
      { title: "Wild Trip Explorer — Unsere Reisen. Unsere Geschichten." },
      {
        name: "description",
        content:
          "Wild Trip Explorer: Berichte, Tagebuch, Fotogalerie und Timeline aus unseren schönsten Momenten unterwegs.",
      },
      { property: "og:title", content: "Wild Trip Explorer — Unser Weg. Unsere Welt." },
      {
        property: "og:description",
        content: "Unsere Reisen. Unsere Geschichten. Unsere schönsten Momente unterwegs.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { trips, mapTrips } = Route.useLoaderData();
  const navigate = useNavigate();
  // listPublishedTrips ist neueste-zuerst sortiert — die ersten Einträge sind
  // die aktuellsten Reisen (nicht das Array-Ende, das wären die ältesten).
  const latest = trips.slice(0, 3);
  const hero = trips[0];

  // Teaser-Karte: ein schlichter Punkt pro veröffentlichter Reise.
  const mapMarkers: MapStation[] = mapTrips.map((t) => ({
    id: t.slug,
    name: t.region ? `${t.title} — ${t.region}` : t.title,
    latitude: t.latitude,
    longitude: t.longitude,
    arrivalDate: null,
    legMode: "air" as const,
    legGeometry: null,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-10 md:pt-16 pb-16">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div style={{ animation: "revealNode 0.8s var(--ease-cinematic) both" }}>
            <p className="font-script text-2xl md:text-3xl text-foreground/70 mb-3">
              Willkommen zu …
            </p>
            <h1 className="font-display text-6xl md:text-8xl font-semibold tracking-tight leading-none flex items-start gap-3">
              Wild Trip Explorer
              <Heart
                className="size-8 md:size-10 mt-4 fill-primary/40 text-primary"
                strokeWidth={1.5}
              />
            </h1>
            <p className="font-display text-2xl md:text-3xl text-primary italic mt-6 leading-snug">
              Unsere Reisen. Unsere Geschichten.
              <br />
              Unsere schönsten Momente unterwegs.
            </p>
            <p className="mt-6 text-foreground/70 leading-relaxed max-w-xl">
              Wir nehmen dich mit an Orte, die uns berührt haben. Mit ehrlichen Geschichten,
              persönlichen Eindrücken, Lieblingsplätzen und ganz vielen Fotos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/stories"
                className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-3 font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Zu unseren Reiseberichten <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/timeline"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 font-medium hover:border-primary hover:text-primary transition-colors"
              >
                Timeline ansehen
              </Link>
            </div>
          </div>

          {hero && (
            <div className="relative">
              <div className="aspect-[4/5] overflow-hidden rounded-2xl shadow-2xl">
                <ResponsivePicture
                  webp={hero.cover.webp}
                  avif={hero.cover.avif}
                  alt={hero.cover.alt ?? hero.title}
                  width={900}
                  height={1100}
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute -bottom-6 -left-6 paper-card px-5 py-4 max-w-[220px] rotate-[-4deg]"
                style={{ ["--r" as string]: "-4deg", animation: "float 6s ease-in-out infinite" }}
              >
                <p className="font-script text-xl text-primary">{hero.region}</p>
                <p className="font-display text-lg leading-tight">{hero.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{hero.monthLabel}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Unsere letzten Reisen */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 pb-16">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold">
              Unsere letzten Reisen
            </h2>
            <p className="font-script text-xl text-primary mt-1">Die Erinnerungen, die bleiben.</p>
          </div>
          <Link
            to="/stories"
            className="text-primary text-sm font-medium hover:underline underline-offset-4"
          >
            Alle Berichte →
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {latest.map((t: PublicTrip) => (
            <Link
              to="/stories/$slug"
              params={{ slug: t.slug }}
              key={t.slug}
              className="paper-card overflow-hidden group flex flex-col hover:-translate-y-1 transition-transform"
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
                <p className="font-mono uppercase text-[10px] tracking-[0.2em] text-primary">
                  {t.region}
                </p>
                <h3 className="font-display text-xl font-semibold mt-1 group-hover:text-primary transition-colors">
                  {t.title}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                  {t.excerpt}
                </p>
                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">📅 {t.monthLabel}</span>
                  <span className="text-primary font-medium">Mehr lesen →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Bento: Wo — Lieblingsorte — Über mich */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 pb-24 grid md:grid-cols-3 gap-6">
        <div className="paper-card p-6">
          <h3 className="font-display text-xl font-semibold">Wo wir schon waren</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Unsere Reisekarte voller Erinnerungen.
          </p>
          {mapMarkers.length === 0 ? (
            <div className="my-5 aspect-[16/10] rounded-lg bg-[radial-gradient(circle_at_30%_40%,hsl(30_30%_82%),hsl(38_46%_92%))] flex items-center justify-center">
              <MapPin className="size-8 text-primary" strokeWidth={1.5} />
            </div>
          ) : (
            <RouteMapLazy
              stations={mapMarkers}
              showRoute={false}
              interactive={false}
              showControls={false}
              markerVariant="dot"
              hoverLabels
              ariaLabel="Übersichtskarte unserer Reiseziele"
              className="my-5 aspect-[16/10] w-full rounded-lg overflow-hidden"
              onSelectStation={(slug) => navigate({ to: "/stories/$slug", params: { slug } })}
            />
          )}
          <Link
            to="/map"
            className="text-primary text-sm font-medium hover:underline underline-offset-4"
          >
            Zur Karte →
          </Link>
        </div>

        <div className="paper-card p-6">
          <h3 className="font-display text-xl font-semibold">Lieblingsorte</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Orte, zu denen wir immer wieder zurückkehren möchten.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {trips.slice(0, 4).map((t) => (
              <li key={t.slug} className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" strokeWidth={1.5} />
                <span>
                  {t.title}, <span className="text-muted-foreground">{t.region}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="paper-card p-6">
          <h3 className="font-display text-xl font-semibold">Über uns</h3>
          <p className="font-script text-2xl text-primary mt-1">Hallo, wir sind Wild Trip Explorer!</p>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            Reiseverliebt, neugierig und immer auf der Suche nach echten Momenten. Hier teilen wir
            unsere Reisen, Begegnungen und Eindrücke — so, wie wir sie erleben.
          </p>
          <Link
            to="/about"
            className="mt-4 inline-block text-primary text-sm font-medium hover:underline underline-offset-4"
          >
            Mehr über uns →
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
