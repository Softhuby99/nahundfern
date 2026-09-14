// Serverseitige Stationslogik: Straßengeometrie einer Route berechnen und
// speichern. Getrennt von den Route-Dateien, damit nichts davon im
// Browser-Bundle landet.
import { sql } from "./db.server";
import { routeBetween } from "./routing.server";

export type RouteRecomputeSummary = {
  legs: number;
  /** Abschnitte ohne Straßenweg — werden als gestrichelter Bogen gezeichnet. */
  fallbacks: number;
};

export async function recomputeTripRoute(tripId: string): Promise<RouteRecomputeSummary> {
  const stations = await sql<
    {
      id: string;
      latitude: string;
      longitude: string;
      leg_mode: "drive" | "train" | "cycle" | "walk" | "air";
    }[]
  >`
    SELECT id, latitude, longitude, leg_mode FROM trip_stations
    WHERE trip_id = ${tripId}
    ORDER BY sort_order, created_at
  `;
  let fallbacks = 0;
  for (let i = 1; i < stations.length; i++) {
    const from = stations[i - 1]!;
    const to = stations[i]!;
    const result = await routeBetween(
      { latitude: Number(from.latitude), longitude: Number(from.longitude) },
      { latitude: Number(to.latitude), longitude: Number(to.longitude) },
      to.leg_mode,
    );
    if (result.ok) {
      await sql`
        UPDATE trip_stations
        SET leg_geometry = ${JSON.stringify(result.geometry)}::jsonb, updated_at = now()
        WHERE id = ${to.id}
      `;
    } else {
      fallbacks++;
      // Kein Landweg oder Dienst nicht erreichbar → Bogen zeichnen (NULL).
      await sql`
        UPDATE trip_stations SET leg_geometry = NULL, updated_at = now() WHERE id = ${to.id}
      `;
    }
  }
  return { legs: Math.max(0, stations.length - 1), fallbacks };
}
