// Wählt den Kartenpunkt einer Reise: die Station, die am weitesten von der
// ersten Station entfernt liegt (bei Gleichstand die frühere Station).
export type DestinationCandidate = { latitude: number; longitude: number; sortOrder: number };

export function pickFarthestStation<T extends DestinationCandidate>(stations: T[]): T | null {
  const valid = stations
    .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const first = valid[0];
  if (!first) return null;
  const cosLat = Math.cos((first.latitude * Math.PI) / 180);
  let best = first;
  let bestDist = -1;
  for (const s of valid) {
    const dLat = s.latitude - first.latitude;
    const dLon = (s.longitude - first.longitude) * cosLat;
    const d = dLat * dLat + dLon * dLon;
    if (d > bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}
