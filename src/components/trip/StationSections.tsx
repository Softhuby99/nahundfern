// Öffentliche Stationsdarstellung: links die Stationen zum Lesen, rechts eine
// mitfliegende Karte. Die Karte ist Zusatzinformation — alle Angaben stehen
// auch in der Textliste.
import { useEffect, useRef, useState } from "react";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { VideoPlayer } from "@/components/trip/VideoPlayer";
import { RichText } from "@/components/RichText";
import type { GalleryImage, PublicStation, TripVideo } from "@/lib/trips.functions";

/** Bilder und Videos einer Station oder eines einzelnen Tages. */
function StationMedia({
  images,
  videos,
  altBase,
  title,
}: {
  images: GalleryImage[];
  videos: TripVideo[];
  altBase: string;
  title: string;
}) {
  if (images.length === 0 && videos.length === 0) return null;
  return (
    <>
      {images.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          {images.map((img) => (
            <ResponsivePicture
              key={img.id}
              webp={img.webp}
              avif={img.avif}
              alt={img.alt ?? altBase}
              width={img.width}
              height={img.height}
              className="w-full h-full object-cover aspect-[4/3] rounded-sm bg-card"
            />
          ))}
        </div>
      )}
      {videos.length > 0 && (
        <div className="grid grid-cols-1 gap-4 mt-6">
          {videos.map((v) => (
            <VideoPlayer key={v.id} video={v} title={title} />
          ))}
        </div>
      )}
    </>
  );
}

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
  const [expanded, setExpanded] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  // Vollbild: Esc schließt, Hintergrund scrollt nicht mit.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeExpanded();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  if (stations.length === 0) return null;

  function closeExpanded() {
    setExpanded(false);
    setPreviewId(null);
  }
  function jumpTo(id: string) {
    sectionRefs.current.get(id)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  }
  const preview = stations.find((s) => s.id === previewId) ?? null;

  const mapStations: MapStation[] = stations.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    arrivalDate: s.arrivalDate,
    legMode: s.legMode,
    legGeometry: s.legGeometry,
    markerImageSrc: s.markerImage?.webp[400] ?? null,
    places: s.places ?? [],
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
                <RichText
                  content={station.bodyMd}
                  className="prose-story text-lg leading-relaxed text-foreground/90 space-y-4"
                />

                {/* Medien ohne Tagesangabe gehören zur ganzen Station. */}
                <StationMedia
                  images={station.images.filter((img) => !img.dayDate)}
                  videos={station.videos.filter((v) => !v.dayDate)}
                  altBase={`${station.name} — ${tripTitle}`}
                  title={station.name}
                />

                {station.dayEntries.length > 0 && (
                  <div className="mt-8 space-y-8 border-l border-border pl-6">
                    {station.dayEntries.map((day) => (
                      <div key={day.date}>
                        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
                          {formatRange(day.date, null)}
                        </p>
                        <RichText
                          content={day.bodyMd}
                          className="prose-story text-lg leading-relaxed text-foreground/90 space-y-4"
                        />
                        <StationMedia
                          images={station.images.filter((img) => img.dayDate === day.date)}
                          videos={station.videos.filter((v) => v.dayDate === day.date)}
                          altBase={`${station.name} — ${tripTitle}`}
                          title={station.name}
                        />
                      </div>
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
              jumpTo(id);
            }}
            onExpand={() => setExpanded(true)}
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
          onExpand={() => setExpanded(true)}
          className="route-map-canvas"
          ariaLabel={`Karte der Reiseroute: ${tripTitle}`}
        />
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background"
          role="dialog"
          aria-modal="true"
          aria-label={`Reiseroute · ${tripTitle}`}
        >
          <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 border-b border-border">
            <p className="font-mono text-xs uppercase tracking-widest text-foreground truncate">
              Reiseroute · {tripTitle}
            </p>
            <button
              type="button"
              onClick={closeExpanded}
              aria-label="Vergrößerte Karte schließen"
              className="h-9 w-9 shrink-0 rounded-full border border-border text-lg leading-none hover:bg-card"
              autoFocus
            >
              ✕
            </button>
          </div>
          <div className="relative flex-1 min-h-0">
            <RouteMapLazy
              stations={mapStations}
              activeStationId={previewId}
              onSelectStation={(id) => setPreviewId(id)}
              className="absolute inset-0"
              ariaLabel={`Vergrößerte Karte der Reiseroute: ${tripTitle}`}
            />
            {preview && (
              <div className="absolute inset-x-3 bottom-6 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[380px] rounded-lg border border-border bg-card p-3 shadow-lg flex gap-3 items-center">
                {preview.markerImage?.webp[400] && (
                  <img
                    src={preview.markerImage.webp[400]}
                    alt=""
                    className="h-16 w-16 rounded object-cover shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg truncate">{preview.name}</p>
                  {formatRange(preview.arrivalDate, preview.departureDate) && (
                    <p className="text-xs text-muted-foreground">
                      {formatRange(preview.arrivalDate, preview.departureDate)}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-1 text-sm text-primary underline-offset-4 hover:underline"
                    onClick={() => {
                      const id = preview.id;
                      closeExpanded();
                      setActiveId(id);
                      setTimeout(() => jumpTo(id), 50);
                    }}
                  >
                    Zu dieser Station springen →
                  </button>
                </div>
                <button
                  type="button"
                  aria-label="Vorschau schließen"
                  onClick={() => setPreviewId(null)}
                  className="self-start text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
