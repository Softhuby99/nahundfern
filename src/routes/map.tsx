import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { listMapTrips, type MapTrip as MapPageTrip } from "@/lib/trips.functions";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export const Route = createFileRoute("/map")({
  loader: async () => ({ trips: await listMapTrips() }),
  head: () => {
    const url = new URL("/map", getPublicBaseUrl()).toString();
    const title = "Reisekarte — Alle Reisen auf der Weltkarte";
    const description =
      "Veröffentlichte und laufende Reisen auf einer Weltkarte, mit Link zum Bericht sobald er online ist.";
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
  const navigate = useNavigate();
  const openTrip = (slug: string) => {
    const trip = trips.find((t) => t.slug === slug);
    if (!trip?.isPublished) return;
    void navigate({ to: "/stories/$slug", params: { slug } });
  };

  // Ein Marker pro Reise; keine Route zwischen verschiedenen Reisen.
  const markers: MapStation[] = trips.map((t) => ({
    id: t.slug,
    name: t.title,
    latitude: t.latitude,
    longitude: t.longitude,
    arrivalDate: null,
    legMode: "air" as const,
    legGeometry: null,
    markerImageSrc: t.isOngoing ? null : t.cover400,
    isOngoing: t.isOngoing,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="px-6 md:px-8 max-w-6xl mx-auto py-16">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">Karte</p>
        <h1 className="font-display text-5xl md:text-6xl tracking-tight font-light mb-8">
Unsere Reisen auf der Weltkarte
        </h1>

        {trips.length === 0 ? (
          <p className="text-lg text-foreground/80">
Noch keine Reisen mit Kartenposition vorhanden.
          </p>
        ) : (
          <>
            <RouteMapLazy
              stations={markers}
              showRoute={false}
              hoverLabels
              onSelectStation={openTrip}
              className="route-map-canvas route-map-canvas--tall"
              ariaLabel="Weltkarte mit veröffentlichten und laufenden Reisen"
            />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
              {trips.map((t) => (
                <li key={t.slug}>
                  {t.isPublished ? (
                    <Link
                      to="/stories/$slug"
                      params={{ slug: t.slug }}
                      className="group block border border-border rounded-sm p-4 hover:border-primary transition-colors"
                    >
                      <TripListCard trip={t} />
                    </Link>
                  ) : (
                    <div className="block border border-border rounded-sm p-4 opacity-85">
                      <TripListCard trip={t} />
                    </div>
                  )}
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

function TripListCard({ trip }: { trip: MapPageTrip }) {
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {trip.isOngoing ? "läuft gerade · " : ""}
        {trip.monthLabel} · {trip.region}
      </p>
      <p className="font-display text-2xl tracking-tight font-medium group-hover:text-primary transition-colors">
        {trip.title}
      </p>
      <p className="text-sm text-foreground/70 mt-1">
        {!trip.isPublished
          ? "Bericht folgt"
          : trip.stationCount > 0
            ? `${trip.stationCount} ${trip.stationCount === 1 ? "Station" : "Stationen"}`
            : trip.isOngoing
              ? "Route läuft noch"
              : "Route folgt"}
      </p>
    </>
  );
}
