import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { listMapTrips } from "@/lib/trips.functions";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export const Route = createFileRoute("/map")({
  loader: async () => ({ trips: await listMapTrips() }),
  head: () => {
    const url = new URL("/map", getPublicBaseUrl()).toString();
    const title = "Reisekarte — Alle Reisen auf der Weltkarte";
    const description =
      "Alle veröffentlichten Reisen auf einer Weltkarte: ein Marker pro Reise, direkt zum Reisebericht.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: MapPage,
});

function MapPage() {
  const { trips } = Route.useLoaderData();

  // Ein Marker pro Reise; keine Route zwischen verschiedenen Reisen.
  const markers: MapStation[] = trips.map((t) => ({
    id: t.slug,
    name: t.title,
    latitude: t.latitude,
    longitude: t.longitude,
    arrivalDate: null,
    legMode: "air" as const,
    legGeometry: null,
    markerImageSrc: t.cover400,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="px-6 md:px-8 max-w-6xl mx-auto py-16">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">Karte</p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight font-light mb-8">
          Alle Reisen auf der Weltkarte
        </h1>

        {trips.length === 0 ? (
          <p className="text-lg text-foreground/80">
            Noch keine Reisen mit Kartenposition veröffentlicht.
          </p>
        ) : (
          <>
            <RouteMapLazy
              stations={markers}
              className="route-map-canvas route-map-canvas--tall"
              ariaLabel="Weltkarte mit allen veröffentlichten Reisen"
            />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {trips.map((t) => (
                <li key={t.slug}>
                  <Link
                    to="/stories/$slug"
                    params={{ slug: t.slug }}
                    className="group block border border-border rounded-sm p-4 hover:border-primary transition-colors"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.monthLabel} · {t.region}
                    </p>
                    <p className="font-display text-2xl tracking-tight font-medium group-hover:text-primary transition-colors">
                      {t.title}
                    </p>
                    <p className="text-sm text-foreground/70 mt-1">
                      {t.stationCount > 0
                        ? `${t.stationCount} ${t.stationCount === 1 ? "Station" : "Stationen"}`
                        : "Route folgt"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
