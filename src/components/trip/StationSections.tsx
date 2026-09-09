// Öffentliche Stationsdarstellung: links die Stationen zum Lesen, rechts eine
// mitfliegende Karte. Die Karte ist Zusatzinformation — alle Angaben stehen
// auch in der Textliste.
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { VideoPlayer } from "@/components/trip/VideoPlayer";
import type { PublicStation } from "@/lib/trips.functions";

function formatRange(arrival: string | null, departure: string | null): string | null {
  const fmt = (v: string) =>
    new Date(`${v}T00:00:00Z`).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  if (arrival && departure && arrival !== departure) return `${fmt(arrival)} – ${fmt(departure)}`;
  if (arrival) return fmt(arrival);
  if (departure) return fmt(departure);
  return null;
}

export function StationSections({
  stations,
  tripTitle,
}: {
  stations: PublicStation[];
  tripTitle: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(stations[0]?.id ?? null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Beim Scrollen die gerade gelesene Station hervorheben.
  useEffect(() => {
    if (stations.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = visible?.target.getAttribute("data-station-id");
        if (id) setActiveId(id);
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: [0.1, 0.5, 1] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [stations]);

  if (stations.length === 0) return null;

  const mapStations: MapStation[] = stations.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    arrivalDate: s.arrivalDate,
    legMode: s.legMode,
    legGeometry: s.legGeometry,
    markerImageSrc: s.markerImage?.webp[400] ?? null,
  }));

  return (
    <div className="px-6 md:px-8 max-w-6xl mx-auto pb-16">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-6">
        Reiseroute · {stations.length} {stations.length === 1 ? "Station" : "Stationen"}
      </p>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] gap-10 items-start">
        <div className="space-y-16">
          {stations.map((station, index) => {
            const range = formatRange(station.arrivalDate, station.departureDate);
            return (
              <section
                key={station.id}
                data-station-id={station.id}
                ref={(el) => {
                  if (el) sectionRefs.current.set(station.id, el);
                  else sectionRefs.current.delete(station.id);
                }}
                aria-labelledby={`station-${station.id}`}
                className="scroll-mt-28"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                  Station {index + 1}
                  {range ? ` · ${range}` : ""}
                </p>
                <h2
                  id={`station-${station.id}`}
                  className="font-display text-3xl md:text-4xl tracking-tight font-light mb-4"
                >
                  {station.name}
                </h2>
                {station.bodyMd && (
                  <div className="prose-story text-lg leading-relaxed text-foreground/90 space-y-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                      {station.bodyMd}
                    </ReactMarkdown>
                  </div>
                )}

                {station.images.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                    {station.images.map((img) => (
                      <ResponsivePicture
                        key={img.id}
                        webp={img.webp}
                        avif={img.avif}
                        alt={img.alt ?? `${station.name} — ${tripTitle}`}
                        width={img.width}
                        height={img.height}
                        className="w-full h-full object-cover aspect-[4/3] rounded-sm bg-card"
                      />
                    ))}
                  </div>
                )}

                {station.videos.length > 0 && (
                  <div className="grid grid-cols-1 gap-4 mt-6">
                    {station.videos.map((v) => (
                      <VideoPlayer key={v.id} video={v} title={station.name} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <div className="hidden lg:block lg:sticky lg:top-24">
          <RouteMapLazy
            stations={mapStations}
            activeStationId={activeId}
            onSelectStation={(id) => {
              setActiveId(id);
              sectionRefs.current.get(id)?.scrollIntoView({
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
                block: "start",
              });
            }}
            animateOnMount
            className="route-map-canvas"
            ariaLabel={`Karte der Reiseroute: ${tripTitle}`}
          />
        </div>
      </div>

      {/* Mobil: Karte unter der Route, nicht mitfliegend. */}
      <div className="lg:hidden mt-10">
        <RouteMapLazy
          stations={mapStations}
          activeStationId={activeId}
          className="route-map-canvas"
          ariaLabel={`Karte der Reiseroute: ${tripTitle}`}
        />
      </div>
    </div>
  );
}
