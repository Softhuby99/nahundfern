import { useMemo, useState } from "react";
import type { PublicTrip } from "@/lib/trips.functions";
import { ResponsivePicture } from "./timeline/ResponsivePicture";
import { TimelineFilters } from "./timeline/TimelineFilters";
import { TimelinePagination } from "./timeline/TimelinePagination";
import { TimelineCard } from "./timeline/TimelineCard";

type Props = {
  trips: PublicTrip[];
  defaultActiveSlug?: string;
  windowSize?: number;
};

/**
 * Vertical numbered timeline in the Reisejournal style:
 * red dashed spine, numbered nodes, photo + info card per trip.
 * Prev/Next pages the window; date filter narrows the pool.
 *
 * The heavy lifting lives in ./timeline/*: filters, pagination, card and the
 * responsive picture element. This file only wires state and layout.
 */
export function HorizontalTimeline({
  trips,
  defaultActiveSlug: _defaultActiveSlug,
  windowSize = 10,
}: Props) {
  void _defaultActiveSlug;
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  // Trips arrive newest-first from the server. Offset 0 = first window.
  const [offset, setOffset] = useState<number>(0);

  const filtered = useMemo(() => {
    const dateKey = (t: PublicTrip) => t.tripStartDate ?? t.createdAt?.slice(0, 10) ?? "";
    const list = trips.filter((t) => {
      const d = dateKey(t);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    });
    // Robust client-side sort: don't trust server ordering (legacy rows with
    // missing trip_start_date can bleed in between correctly-dated ones).
    const sorted = [...list].sort((a, b) => {
      const da = dateKey(a);
      const db = dateKey(b);
      if (da === db) return 0;
      return sortDir === "desc" ? (da < db ? 1 : -1) : da < db ? -1 : 1;
    });
    return sorted;
  }, [trips, fromDate, toDate, sortDir]);

  const total = filtered.length;
  const maxOffset = Math.max(0, total - windowSize);
  const safeOffset = Math.min(Math.max(0, offset), maxOffset);
  const visible = filtered.slice(safeOffset, safeOffset + windowSize);

  const hasNewer = safeOffset > 0;
  const hasOlder = safeOffset + windowSize < total;

  const rangeLabel =
    total === 0 ? "—" : `${safeOffset + 1}–${Math.min(safeOffset + windowSize, total)} / ${total}`;

  function resetFilter() {
    setFromDate("");
    setToDate("");
    setOffset(0);
  }

  return (
    <section className="relative py-8">
      <div className="max-w-6xl mx-auto px-6 md:px-8 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TimelineFilters
            fromDate={fromDate}
            toDate={toDate}
            onFromChange={(v) => {
              setFromDate(v);
              setOffset(0);
            }}
            onToChange={(v) => {
              setToDate(v);
              setOffset(0);
            }}
            onReset={resetFilter}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                setOffset(0);
              }}
              className="px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-primary hover:text-primary transition-colors"
              aria-label="Sortierreihenfolge umschalten"
              title="Sortierung umschalten"
            >
              {sortDir === "desc" ? "Neueste zuerst ↓" : "Älteste zuerst ↑"}
            </button>
            <TimelinePagination
              hasNewer={hasNewer}
              hasOlder={hasOlder}
              onNewer={() => setOffset(Math.max(0, safeOffset - windowSize))}
              onOlder={() => setOffset(safeOffset + windowSize)}
              rangeLabel={rangeLabel}
            />
          </div>
        </div>
        {/* Assistive status message when filters change the result count. */}
        <p role="status" aria-live="polite" className="sr-only">
          {total === 0 ? "Keine Reisen gefunden." : `${total} Reisen gefunden.`}
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-8 relative">
        {/* Red dashed spine */}
        <div
          className="timeline-line absolute top-0 bottom-0 left-[38px] md:left-[54px] w-0 border-l-2 border-dashed border-primary/60 origin-top"
          style={{ animation: "drawLine 1.2s var(--ease-cinematic) both" }}
        />

        <ul className="space-y-6">
          {visible.map((trip, i) => (
            <TimelineCard
              key={trip.slug}
              trip={trip}
              index={i}
              displayNumber={safeOffset + i + 1}
              priority={i === 0}
            />
          ))}
        </ul>

        {total === 0 && (
          <p className="text-center text-muted-foreground py-16">
            Keine Reisen im gewählten Zeitraum.
          </p>
        )}
      </div>
    </section>
  );
}

// Back-compat re-export: other routes still import ResponsivePicture from here.
export { ResponsivePicture };
