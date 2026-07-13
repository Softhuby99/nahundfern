import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Calendar, MapPin, Clock, Star } from "lucide-react";
import type { PublicTrip } from "@/lib/trips.functions";

type Props = {
  trips: PublicTrip[];
  defaultActiveSlug?: string;
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
        height={height ?? 300}
        loading="lazy"
        className={className}
      />
    </picture>
  );
}

/**
 * Vertical numbered timeline in the Reisejournal style:
 * red dashed spine, numbered nodes, photo + info card per trip.
 * Prev/Next pages the window; date filter narrows the pool.
 */
export function HorizontalTimeline({ trips, defaultActiveSlug: _defaultActiveSlug, windowSize = 10 }: Props) {
  void _defaultActiveSlug;
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  // Trips arrive newest-first from the server. Offset 0 = newest window.
  const [offset, setOffset] = useState<number>(0);

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      // Filter by actual travel date; fall back to createdAt for legacy rows.
      const d = (t.tripStartDate ?? t.createdAt?.slice(0, 10)) ?? "";
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
  }, [trips, fromDate, toDate]);

  const total = filtered.length;
  const maxOffset = Math.max(0, total - windowSize);
  const safeOffset = Math.min(Math.max(0, offset), maxOffset);
  const visible = filtered.slice(safeOffset, safeOffset + windowSize);

  const hasNewer = safeOffset > 0;
  const hasOlder = safeOffset + windowSize < total;

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setOffset(0);
  }

  return (
    <section className="relative py-8">
      <div className="max-w-6xl mx-auto px-6 md:px-8 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Von</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setOffset(0); }}
                className="bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Bis</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setOffset(0); }}
                className="bg-card border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </label>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={resetFilter}
                className="text-sm text-primary hover:underline underline-offset-4 pb-1.5"
              >
                Zurücksetzen
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset(Math.max(0, safeOffset - windowSize))}
              disabled={!hasOlder}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-primary hover:text-primary disabled:opacity-30 transition-colors"
            >
              ← Ältere
            </button>
            <span className="text-xs text-muted-foreground min-w-[80px] text-center">
              {total === 0 ? "—" : `${safeOffset + 1}–${Math.min(safeOffset + windowSize, total)} / ${total}`}
            </span>
            <button
              type="button"
              onClick={() => setOffset(safeOffset + windowSize)}
              disabled={!hasNewer}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-primary hover:text-primary disabled:opacity-30 transition-colors"
            >
              Neuere →
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-8 relative">
        {/* Red dashed spine */}
        <div
          className="absolute top-0 bottom-0 left-[38px] md:left-[54px] w-0 border-l-2 border-dashed border-primary/60 origin-top"
          style={{ animation: "drawLine 1.2s var(--ease-cinematic) both" }}
        />

        <ul className="space-y-6">
          {visible.map((trip, i) => {
            const num = String(safeOffset + i + 1).padStart(2, "0");
            return (
              <li key={trip.slug} className="relative pl-[76px] md:pl-[108px]" style={{ animation: `revealNode 0.5s var(--ease-cinematic) ${i * 60}ms both` }}>
                {/* Numbered node */}
                <div className="absolute left-[18px] md:left-[34px] top-4 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-md z-10">
                  {num}
                </div>

                <Link
                  to="/stories/$slug"
                  params={{ slug: trip.slug }}
                  className="paper-card flex flex-col md:flex-row gap-4 p-3 md:p-4 hover:-translate-y-0.5 hover:shadow-lg transition-all group"
                >
                  <div className="md:w-[180px] flex-none overflow-hidden rounded-lg">
                    <ResponsivePicture
                      webp={trip.cover.webp}
                      avif={trip.cover.avif}
                      alt={trip.cover.alt ?? trip.title}
                      width={360}
                      height={220}
                      className="w-full h-32 md:h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight group-hover:text-primary transition-colors">{trip.title}</h3>
                        <p className="flex items-center gap-1.5 text-sm text-primary mt-0.5">
                          {trip.region} <MapPin className="size-3.5" strokeWidth={1.5} />
                        </p>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                        <Calendar className="size-4" strokeWidth={1.5} /> {trip.monthLabel}
                      </p>
                    </div>
                    <p className="font-script text-lg text-foreground/80 mt-2 leading-snug">
                      {trip.excerpt}
                    </p>
                    <div className="mt-3 pt-3 border-t border-border/70 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Clock className="size-3.5" strokeWidth={1.5} /> {trip.when}</span>
                      <span className="flex items-center gap-1.5"><MapPin className="size-3.5" strokeWidth={1.5} /> {trip.where}</span>
                      {trip.kicker && (
                        <span className="flex items-center gap-1.5 text-primary">
                          <Star className="size-3.5" strokeWidth={1.5} /> Highlight: {trip.kicker}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {total === 0 && (
          <p className="text-center text-muted-foreground py-16">Keine Reisen im gewählten Zeitraum.</p>
        )}
      </div>
    </section>
  );
}

export { ResponsivePicture };
