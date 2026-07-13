import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";
import { Heart, MapPin, Calendar, Grid3x3 } from "lucide-react";

export const Route = createFileRoute("/gallery")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Meine Fotogalerie — Reisejournal" },
      { name: "description", content: "Bilder, die Geschichten erzählen und Momente für immer bewahren." },
      { property: "og:title", content: "Meine Fotogalerie — Reisejournal" },
      { property: "og:description", content: "Bilder, die Geschichten erzählen und Momente für immer bewahren." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const { trips } = Route.useLoaderData() as { trips: PublicTrip[] };
  const regions = useMemo(() => {
    const s = new Set<string>();
    trips.forEach((t) => s.add(t.region));
    return ["Alle Fotos", ...Array.from(s)];
  }, [trips]);
  const [active, setActive] = useState("Alle Fotos");

  const filtered = active === "Alle Fotos" ? trips : trips.filter((t) => t.region === active);
  const feature = filtered[0];
  const bento = filtered.slice(1, 5);
  const strip = filtered.slice(0, 6);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-12 text-center">
        <p className="font-script text-2xl text-primary flex items-center justify-center gap-2">
          Meine Erinnerungen. Mein Weg. <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mt-2">
          Meine Fotogalerie
        </h1>
        <p className="font-script text-2xl text-primary/80 mt-3">
          Bilder, die Geschichten erzählen und Momente für immer bewahren.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 mt-10">
        <div className="flex flex-wrap gap-2 justify-center">
          {regions.map((r, i) => (
            <button
              key={r}
              onClick={() => setActive(r)}
              className={`px-4 py-2 rounded-full text-sm border transition-colors flex items-center gap-1.5 ${
                active === r
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-foreground/80 hover:border-primary hover:text-primary"
              }`}
            >
              {i === 0 && <Grid3x3 className="size-3.5" strokeWidth={1.5} />}
              {r}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-10">
        <div className="grid md:grid-cols-3 gap-4 md:auto-rows-[280px]">
          {feature && (
            <PhotoTile trip={feature} className="md:col-span-2 md:row-span-2" />
          )}
          {bento.map((t) => (
            <PhotoTile key={t.slug} trip={t} />
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 md:px-8 mt-14">
        <h2 className="font-script text-3xl text-foreground flex items-center gap-2">
          Lieblingsshots <Heart className="size-5 fill-primary/40 text-primary" strokeWidth={1.5} />
        </h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {strip.map((t) => (
            <div key={"strip-" + t.slug} className="paper-card overflow-hidden aspect-[4/5] relative group">
              <ResponsivePicture
                webp={t.cover.webp}
                avif={t.cover.avif}
                alt={t.cover.alt ?? t.title}
                width={400}
                height={500}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white text-xs">
                <p className="flex items-center gap-1"><MapPin className="size-3" strokeWidth={1.5} />{t.title}, {t.region}</p>
                <p className="flex items-center gap-1 opacity-80 mt-0.5"><Calendar className="size-3" strokeWidth={1.5} />{t.monthLabel}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function PhotoTile({ trip, className = "" }: { trip: PublicTrip; className?: string }) {
  return (
    <div className={`paper-card overflow-hidden relative group ${className}`}>
      <ResponsivePicture
        webp={trip.cover.webp}
        avif={trip.cover.avif}
        alt={trip.cover.alt ?? trip.title}
        width={1200}
        height={800}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-white">
        <p className="flex items-center gap-1.5 text-sm"><MapPin className="size-4" strokeWidth={1.5} />{trip.title}, {trip.region}</p>
        <p className="flex items-center gap-1.5 text-xs opacity-80 mt-0.5"><Calendar className="size-3.5" strokeWidth={1.5} />{trip.monthLabel}</p>
      </div>
    </div>
  );
}
