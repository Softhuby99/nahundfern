// Browser-only storage for user-created trips in the Studio area.
// Demo-only: persists in localStorage, no server.

import { trips as seedTrips, type Trip } from "@/data/trips";

const KEY = "vagabond.studio.trips";

export type StudioTrip = Trip & {
  published: boolean;
  custom?: boolean;
};

function read(): StudioTrip[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StudioTrip[];
  } catch {
    return null;
  }
}

function write(list: StudioTrip[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadStudioTrips(): StudioTrip[] {
  const existing = read();
  if (existing) return existing;
  const seeded: StudioTrip[] = seedTrips.map((t) => ({ ...t, published: true, custom: false }));
  write(seeded);
  return seeded;
}

export function saveStudioTrips(list: StudioTrip[]) {
  write(list);
}

export function upsertTrip(trip: StudioTrip) {
  const list = loadStudioTrips();
  const idx = list.findIndex((t) => t.slug === trip.slug);
  if (idx >= 0) list[idx] = trip;
  else list.unshift(trip);
  write(list);
  return list;
}

export function removeTrip(slug: string) {
  const list = loadStudioTrips().filter((t) => t.slug !== slug);
  write(list);
  return list;
}

export function resetStudio() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function emptyTrip(): StudioTrip {
  return {
    slug: `trip-${Date.now()}`,
    title: "New Trip",
    kicker: "",
    region: "Europe",
    where: "",
    when: "",
    monthLabel: "",
    who: "Solo",
    cover: "",
    excerpt: "",
    body: [""],
    published: false,
    custom: true,
  };
}
