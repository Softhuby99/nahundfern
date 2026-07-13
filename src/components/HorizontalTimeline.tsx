import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { PublicTrip } from "@/lib/trips.functions";

type Props = {
  trips: PublicTrip[];
  /** Slug that should render in the bloomed/expanded state on first render */
  defaultActiveSlug?: string;
  /** How many trips to show per window (default 10) */
  windowSize?: number;
};

function ResponsivePicture({
  webp,
  avif,
  alt,
  className,
  width,
  height,
}: {
  webp: Record<number, string>;
  avif: Record<number, string>;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}) {
  return (
    <picture>
      <source srcSet={`${avif[400]} 400w, ${avif[1200]} 1200w, ${avif[2000]} 2000w`} type="image/avif" />
      <source srcSet={`${webp[400]} 400w, ${webp[1200]} 1200w, ${webp[2000]} 2000w`} type="image/webp" />
      <img
        src={webp[400] ?? webp[1200]}
        alt={alt}
        width={width ?? 400}
        height={height ?? 500}
        loading="lazy"
        className={className}
      />
    </picture>
  );
}

/**
 * Horizontal photo timeline:
 * - Shows a window of N trips (default 10)
 * - Prev/Next buttons page to older/newer trips
 * - Optional date-range filter narrows the pool before paging
 */
export function HorizontalTimeline({ trips, defaultActiveSlug, windowSize = 10 }: Props) {
  const [active, setActive] = useState<string | null>(defaultActiveSlug ?? null);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  // null = auto-pin to the newest window; number = user paged to a specific offset
  const [offset, setOffset] = useState<number | null>(null);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const d = t.createdAt?.slice(0, 10) ?? "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [trips, fromDate, toDate]);

  const total = filtered.length;
  const safeOffset = Math.min(Math.max(0, offset), Math.max(0, total - windowSize));
  const visible = filtered.slice(safeOffset, safeOffset + windowSize);

  const hasOlder = safeOffset > 0;
  const hasNewer = safeOffset + windowSize < total;

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setOffset(0);
  }

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="px-6 md:px-8 mb-8 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary mb-3">The Route</p>
            <h2 className="font-display text-4xl md:text-6xl tracking-tight font-light">A year on the line</h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Von</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setOffset(0);
                }}
                className="bg-transparent border border-border rounded-sm px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Bis</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setOffset(0);
                }}
                className="bg-transparent border border-border rounded-sm px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </label>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={resetFilter}
                className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary underline underline-offset-4 pb-1"
              >
                Zurücksetzen
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setOffset(Math.max(0, safeOffset - windowSize))}
            disabled={!hasOlder}
            aria-label="Ältere Reisen"
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-sm font-mono uppercase tracking-widest text-foreground/80 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground/80 transition-colors"
          >
            ← Älter
          </button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {total === 0
              ? "Keine Reisen im Zeitraum"
              : `${safeOffset + 1}–${Math.min(safeOffset + windowSize, total)} von ${total}`}
          </span>
          <button
            type="button"
            onClick={() => setOffset(safeOffset + windowSize)}
            disabled={!hasNewer}
            aria-label="Neuere Reisen"
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-sm text-sm font-mono uppercase tracking-widest text-foreground/80 hover:border-primary hover:text-primary disabled:opacity-30 disabled:hover:border-border disabled:hover:text-foreground/80 transition-colors"
          >
            Neuer →
          </button>
        </div>
      </div>

      <div className="relative">
        {/* Spine */}
        <div
          className="absolute top-1/2 left-0 w-full h-px bg-foreground/20 origin-left"
          style={{ animation: "drawLine 1.5s var(--ease-cinematic) both" }}
        />

        <div className="flex overflow-x-auto scrollbar-hide px-[4vw] snap-x relative py-40">
          {visible.map((trip, i) => {
            const above = i % 2 === 0;
            const isActive = active === trip.slug;
            return (
              <TimelineNode
                key={trip.slug}
                trip={trip}
                above={above}
                isActive={isActive}
                onHover={() => setActive(trip.slug)}
                onLeave={() => setActive(defaultActiveSlug ?? null)}
              />
            );
          })}
          <div className="flex-none w-[4vw]" />
        </div>
      </div>
    </section>
  );
}

function TimelineNode({
  trip,
  above,
  isActive,
  onHover,
  onLeave,
}: {
  trip: PublicTrip;
  above: boolean;
  isActive: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  return (
    <div
      className="relative flex-none w-[150px] md:w-[180px] snap-center group"
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onFocus={onHover}
      onBlur={onLeave}
    >
      {/* Label (year + headline) opposite of the photo */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center text-center w-[160px] ${
          above ? "-top-28" : "-bottom-28"
        }`}
      >
        {above ? (
          <>
            <div className={`h-16 w-px mb-3 ${isActive ? "bg-primary" : "bg-foreground/20"}`} />
            <span className={`font-mono text-[10px] tracking-widest ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {trip.monthLabel}
            </span>
            <h3 className={`font-display text-sm tracking-tight font-medium ${isActive ? "text-primary" : "text-foreground"}`}>
              {trip.title}
            </h3>
          </>
        ) : (
          <>
            <h3 className={`font-display text-sm tracking-tight font-medium mb-1 ${isActive ? "text-primary" : "text-foreground"}`}>
              {trip.title}
            </h3>
            <span className={`font-mono text-[10px] tracking-widest ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {trip.monthLabel}
            </span>
            <div className={`h-16 w-px mt-3 ${isActive ? "bg-primary" : "bg-foreground/20"}`} />
          </>
        )}
      </div>

      {/* Node marker on the spine */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div
          className={`rounded-full transition-all duration-500 ${
            isActive
              ? "size-4 bg-primary ring-8 ring-primary/15"
              : "size-2.5 bg-background border-2 border-foreground/40 group-hover:border-primary"
          }`}
        />
      </div>

      {/* Bloom meta card (only when active) */}
      {isActive && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-30 w-[240px] md:w-[280px] bg-card/95 border border-border backdrop-blur-xl p-4 rounded-md shadow-xl ${
            above ? "top-1/2 mt-12" : "bottom-1/2 mb-12"
          }`}
          style={{ animation: "revealNode 0.35s var(--ease-cinematic) both" }}
        >
          <p className="font-mono text-[10px] text-primary uppercase tracking-widest mb-2">Where / When / Crew</p>
          <p className="text-xs leading-relaxed text-foreground/80 mb-3">
            {trip.where}<br />
            {trip.when} · {trip.who}
          </p>
          <Link
            to="/stories/$slug"
            params={{ slug: trip.slug }}
            className="inline-block px-3 py-2 border border-primary text-primary font-mono text-[10px] tracking-widest uppercase hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Read report →
          </Link>
        </div>
      )}

      {/* Photo on the side the line points to */}
      <div className={above ? "mt-3 px-2" : "mb-3 px-2 -mt-4"}>
        <Link
          to="/stories/$slug"
          params={{ slug: trip.slug }}
          className="block"
        >
          <ResponsivePicture
            webp={trip.cover.webp}
            avif={trip.cover.avif}
            alt={trip.cover.alt ?? trip.title}
            width={400}
            height={500}
            className={`w-full aspect-[2/3] object-cover rounded-sm outline-1 -outline-offset-1 outline-foreground/5 transition-all duration-700 ${
              isActive ? "ring-1 ring-primary/30" : ""
            }`}
          />
        </Link>
      </div>
    </div>
  );
}

export { ResponsivePicture };
