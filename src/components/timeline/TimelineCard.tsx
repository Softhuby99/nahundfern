import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Clock, Star } from "lucide-react";
import type { PublicTrip } from "@/lib/trips.functions";
import { ResponsivePicture } from "./ResponsivePicture";

type Props = {
  trip: PublicTrip;
  index: number;
  displayNumber: number;
  priority?: boolean;
};

export function TimelineCard({ trip, index, displayNumber, priority = false }: Props) {
  const num = String(displayNumber).padStart(2, "0");
  return (
    <li
      className="timeline-item relative pl-[76px] md:pl-[108px]"
      style={{ animation: `revealNode 0.5s var(--ease-cinematic) ${index * 60}ms both` }}
    >
      <div
        className="absolute left-[18px] md:left-[34px] top-4 grid size-10 place-items-center rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-md z-10"
        aria-hidden="true"
      >
        {num}
      </div>
      {/* Screen-reader label so the ordinal is announced meaningfully. */}
      <span className="sr-only">Reise Nummer {displayNumber}:</span>

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
            aspectRatio="16 / 10"
            sizes="(min-width: 768px) 180px, 100vw"
            priority={priority}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-2xl md:text-3xl font-semibold leading-tight group-hover:text-primary transition-colors">
                {trip.title}
              </h3>
              <p className="flex items-center gap-1.5 text-sm text-primary mt-0.5">
                {trip.region} <MapPin className="size-3.5" strokeWidth={1.5} />
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
              <Calendar className="size-4" strokeWidth={1.5} /> {trip.monthLabel}
            </p>
          </div>
          <p className="font-script text-lg text-foreground/80 mt-2 leading-snug">{trip.excerpt}</p>
          <div className="mt-3 pt-3 border-t border-border/70 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5" strokeWidth={1.5} /> {trip.when}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" strokeWidth={1.5} /> {trip.where}
            </span>
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
}
