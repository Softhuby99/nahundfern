// SSR-sichere Geometrie-Helfer: keine Browser-APIs, kein MapLibre-Import.
// Wird sowohl vom öffentlichen Bericht als auch vom Studio-Editor genutzt.

export type LegMode = "drive" | "train" | "cycle" | "walk" | "air";

export type RoutePoint = {
  latitude: number;
  longitude: number;
  legMode: LegMode;
  /** Gespeicherte Straßengeometrie als [[ [lon,lat], ... ]] (MultiLineString-Koordinaten). */
  legGeometry: number[][][] | null;
};

/** Abschnitte länger als dieser Wert werden als Flugbogen dargestellt. */
export const ARC_DISTANCE_THRESHOLD_KM = 2000;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

export function isValidLatLon(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Großkreis-Punkte zwischen zwei Koordinaten (sphärische Interpolation).
 * Longitude wird fortlaufend geführt (kann über ±180 hinauslaufen) — das
 * Aufteilen an der Datumsgrenze übernimmt splitAtAntimeridian().
 */
export function greatCirclePoints(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
  steps = 64,
): number[][] {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const lon1 = toRad(a.longitude);
  // Kürzesten Weg wählen: Differenz auf −180…180 normalisieren.
  let dLon = b.longitude - a.longitude;
  while (dLon > 180) dLon -= 360;
  while (dLon < -180) dLon += 360;
  const lon2 = toRad(a.longitude + dLon);

  const d =
    2 *
    Math.asin(
      Math.min(
        1,
        Math.sqrt(
          Math.sin((lat2 - lat1) / 2) ** 2 +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
        ),
      ),
    );

  // Identische Punkte: keine Linie.
  if (d === 0) return [[a.longitude, a.latitude]];

  const out: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return out;
}

/**
 * Teilt eine Linie am 180. Längengrad. Ohne das zeichnet MapLibre bei einem
 * Sprung von +179 auf −179 einen Strich quer über die ganze Weltkarte.
 * Rückgabe sind die Koordinaten eines MultiLineString.
 */
export function splitAtAntimeridian(points: number[][]): number[][][] {
  if (points.length < 2) return points.length ? [points] : [];
  const first = points[0];
  if (!first) return [];
  const segments: number[][][] = [];
  let current: number[][] = [first];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    if (!prev || !cur) continue;
    const prevLon = prev[0];
    const prevLat = prev[1];
    const curLon = cur[0];
    const curLat = cur[1];
    if (prevLon === undefined || prevLat === undefined || curLon === undefined || curLat === undefined) {
      continue;
    }
    const dLon = curLon - prevLon;
    if (Math.abs(dLon) > 180) {
      // Kreuzung: Schnittpunkt auf ±180 berechnen und Segment trennen.
      const goingEast = dLon < 0; // +179 → −179
      const boundary = goingEast ? 180 : -180;
      const curAdj = curLon + (goingEast ? 360 : -360);
      const t = (boundary - prevLon) / (curAdj - prevLon);
      const latAt = prevLat + t * (curLat - prevLat);
      current.push([boundary, latAt]);
      segments.push(current);
      current = [[-boundary, latAt], cur];
    } else {
      current.push(cur);
    }
  }
  segments.push(current);
  return segments.filter((s) => s.length >= 2);
}

export type RouteLeg = {
  /** MultiLineString-Koordinaten, bereits an der Datumsgrenze getrennt. */
  segments: number[][][];
  /** true → gestrichelt zeichnen (Flug bzw. fehlende Straßengeometrie). */
  dashed: boolean;
  mode: LegMode;
};

/**
 * Baut alle Abschnitte einer Route. Fallback-Kette pro Abschnitt:
 * gespeicherte Straßengeometrie → Großkreis-Bogen (gestrichelt).
 */
export function buildRouteLegs(points: RoutePoint[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1];
    const to = points[i];
    if (
      !from ||
      !to ||
      !isValidLatLon(from.latitude, from.longitude) ||
      !isValidLatLon(to.latitude, to.longitude)
    ) {
      continue;
    }
    const road = to.legGeometry;
    const useRoad =
      to.legMode !== "air" &&
      to.legMode !== "train" &&
      Array.isArray(road) &&
      road.length > 0 &&
      road.every((line) => Array.isArray(line) && line.length >= 2);

    if (useRoad && road) {
      const segments = road.flatMap((line) => splitAtAntimeridian(line));
      if (segments.length > 0) {
        legs.push({ segments, dashed: false, mode: to.legMode });
        continue;
      }
    }
    legs.push({
      segments: splitAtAntimeridian(greatCirclePoints(from, to)),
      dashed: true,
      mode: to.legMode,
    });
  }
  return legs;
}

/** Bounding box [west, south, east, north] über alle Punkte. */
export function boundsOf(
  points: Array<{ latitude: number; longitude: number }>,
): [number, number, number, number] | null {
  const valid = points.filter((p) => isValidLatLon(p.latitude, p.longitude));
  if (valid.length === 0) return null;
  const first = valid[0];
  if (!first) return null;
  let west = first.longitude;
  let east = first.longitude;
  let south = first.latitude;
  let north = first.latitude;
  for (const p of valid) {
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
  }
  return [west, south, east, north];
}

/** Dauer der Intro-Animation in ms. */
export function introDurationMs(stationCount: number): number {
  return Math.min(8000, Math.max(1500, stationCount * 450));
}

/**
 * Stabile Sortierung nach Ankunftsdatum: Stationen ohne Datum ans Ende,
 * bei gleichem oder fehlendem Datum bleibt die bisherige Reihenfolge erhalten.
 */
export function sortByArrival<T extends { arrivalDate: string | null }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const da = a.item.arrivalDate;
      const db = b.item.arrivalDate;
      if (da && db) {
        if (da !== db) return da < db ? -1 : 1;
        return a.index - b.index;
      }
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.index - b.index;
    })
    .map((x) => x.item);
}
