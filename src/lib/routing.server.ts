// Serverseitiges Straßen-Routing (OSRM) und Geocoding-Hilfen.
// Beides läuft ausschließlich im eingeloggten Studio: die öffentliche Seite
// liefert nur gespeicherte Geometrie aus und fragt keinen externen Dienst.

const ROUTING_BASE_URL = () => process.env.ROUTING_BASE_URL ?? "https://router.project-osrm.org";
const NOMINATIM_BASE_URL = () =>
  process.env.NOMINATIM_BASE_URL ?? "https://nominatim.openstreetmap.org";
const USER_AGENT = () => process.env.GEOCODER_USER_AGENT ?? "nahundfern-reisejournal (self-hosted)";

const REQUEST_TIMEOUT_MS = 8000;
/** Obergrenze für gespeicherte Geometrie pro Abschnitt. */
const MAX_GEOMETRY_POINTS = 500;

// ---------------------------------------------------------------- queue -----
// Nominatim/OSRM sehen die Server-IP, nicht den Endnutzer: eine GLOBALE
// Warteschlange mit 1 Anfrage/s. Mehrere Redakteure teilen sich diese Schlange.
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = Math.max(0, 1000 - (Date.now() - lastCallAt));
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  };
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT(), Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`upstream_${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// --------------------------------------------------------------- cache ------
type CacheEntry = { value: unknown; expires: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheGet(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

// ------------------------------------------------------------- geocoding ----
export type GeocodeResult = {
  name: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  /** Grobe Art des Treffers (z. B. "restaurant", "cafe", "attraction"). */
  category?: string | null;
  /** Vollständige Adresszeile für die Trefferliste. */
  label?: string | null;
};

function normalizeCountryCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cc = raw.trim().toLowerCase();
  return /^[a-z]{2}$/.test(cc) ? cc : null;
}

function shortName(entry: Record<string, unknown>): string {
  const address = (entry.address ?? {}) as Record<string, unknown>;
  const candidates = [
    "city",
    "town",
    "village",
    "hamlet",
    "municipality",
    "city_district",
    "suburb",
    "borough",
    "district",
    "county",
    "state",
    "region",
  ];
  for (const key of candidates) {
    const v = address[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const own = entry.name;
  if (typeof own === "string" && own.trim()) return own.trim();
  const display = entry.display_name;
  if (typeof display === "string") return display.split(",")[0]!.trim();
  return "";
}

export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const key = `search:${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached as GeocodeResult[];

  const url =
    `${NOMINATIM_BASE_URL()}/search?format=jsonv2&addressdetails=1&limit=5` +
    `&accept-language=de&q=${encodeURIComponent(query)}`;
  const raw = (await throttled(() => fetchJson(url))) as unknown;
  const list = Array.isArray(raw) ? raw : [];
  const results: GeocodeResult[] = list
    .slice(0, 5)
    .map((entry) => {
      const e = entry as Record<string, unknown>;
      const lat = Number(e.lat);
      const lon = Number(e.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const address = (e.address ?? {}) as Record<string, unknown>;
      return {
        name: shortName(e) || String(e.display_name ?? "").slice(0, 120),
        countryCode: normalizeCountryCode(address.country_code),
        latitude: lat,
        longitude: lon,
      } satisfies GeocodeResult;
    })
    .filter((x): x is GeocodeResult => x !== null);
  cacheSet(key, results);
  return results;
}

export async function geocodeReverse(lat: number, lon: number): Promise<GeocodeResult | null> {
  const key = `reverse:${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached as GeocodeResult | null;

  const url =
    `${NOMINATIM_BASE_URL()}/reverse?format=jsonv2&addressdetails=1&zoom=10` +
    `&accept-language=de&lat=${lat}&lon=${lon}`;
  const raw = (await throttled(() => fetchJson(url))) as Record<string, unknown>;
  const address = (raw?.address ?? {}) as Record<string, unknown>;
  const name = shortName(raw ?? {});
  // Kein Treffer → null. Der Editor lässt das Namensfeld dann LEER,
  // niemals "Unbekannt" oder Rohkoordinaten.
  const result: GeocodeResult | null = name
    ? {
        name,
        countryCode: normalizeCountryCode(address.country_code),
        latitude: lat,
        longitude: lon,
      }
    : null;
  cacheSet(key, result);
  return result;
}

// --------------------------------------------------------------- routing ----
export type LegMode = "drive" | "train" | "cycle" | "walk" | "air";

const OSRM_PROFILE: Record<Exclude<LegMode, "air" | "train">, string> = {
  drive: "driving",
  cycle: "cycling",
  walk: "walking",
};

/**
 * Douglas-Peucker-Vereinfachung, damit die gespeicherte Geometrie klein bleibt.
 * Toleranz wird erhöht, bis die Punktzahl unter der Obergrenze liegt.
 */
export function simplifyLine(points: number[][], maxPoints = MAX_GEOMETRY_POINTS): number[][] {
  if (points.length <= maxPoints) return points;
  let tolerance = 0.0005;
  let out = points;
  for (let i = 0; i < 12 && out.length > maxPoints; i++) {
    out = douglasPeucker(points, tolerance);
    tolerance *= 2;
  }
  if (out.length > maxPoints) {
    // Notfalls gleichmäßig ausdünnen, Anfang und Ende bleiben erhalten.
    const step = Math.ceil(out.length / maxPoints);
    const thinned = out.filter((_, i) => i % step === 0);
    const last = out[out.length - 1]!;
    if (thinned[thinned.length - 1] !== last) thinned.push(last);
    out = thinned;
  }
  return out;
}

function douglasPeucker(points: number[][], tolerance: number): number[][] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDist = -1;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(p: number[], a: number[], b: number[]): number {
  const [x, y] = [p[0]!, p[1]!];
  const [x1, y1] = [a[0]!, a[1]!];
  const [x2, y2] = [b[0]!, b[1]!];
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const cl = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + cl * dx), y - (y1 + cl * dy));
}

export type RouteLegResult =
  | { ok: true; geometry: number[][][]; distanceMeters: number }
  | { ok: false; reason: "air" | "train" | "no_route" | "upstream" };

/**
 * Holt die Straßengeometrie zwischen zwei Punkten. Fehlerfälle sind erwartbar
 * (kein Landweg, Dienst nicht erreichbar) und werden als `ok: false`
 * zurückgegeben — der Aufrufer zeichnet dann einen Bogen.
 */
export async function routeBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
  mode: LegMode,
): Promise<RouteLegResult> {
  // Flug und Zug: kein Straßen-Routing — die Linie wird als Bogen gezeichnet.
  if (mode === "air" || mode === "train") return { ok: false, reason: mode };
  const profile = OSRM_PROFILE[mode];
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${ROUTING_BASE_URL()}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&alternatives=false&steps=false`;
  try {
    const raw = (await throttled(() => fetchJson(url))) as Record<string, unknown>;
    const routes = raw?.routes;
    if (!Array.isArray(routes) || routes.length === 0) return { ok: false, reason: "no_route" };
    const route = routes[0] as Record<string, unknown>;
    const geometry = route.geometry as { coordinates?: unknown } | undefined;
    const line = geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2) return { ok: false, reason: "no_route" };
    const points = (line as number[][]).filter(
      (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]),
    );
    if (points.length < 2) return { ok: false, reason: "no_route" };
    return {
      ok: true,
      geometry: [simplifyLine(points)],
      distanceMeters: Number(route.distance ?? 0),
    };
  } catch (err) {
    console.warn("routing failed", (err as Error).message);
    return { ok: false, reason: "upstream" };
  }
}
