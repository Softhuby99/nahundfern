// Temporäre Prüfseite für die Marker-Tooltips (wird nach dem Screenshot gelöscht).
import { createFileRoute } from "@tanstack/react-router";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";

export const Route = createFileRoute("/mapcheck")({
  component: MapCheck,
});

const PIC =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#0e7490'/><circle cx='40' cy='40' r='22' fill='#fbbf24'/></svg>`,
  );

const stations: MapStation[] = [
  {
    id: "s1",
    name: "Bruckmühl",
    arrivalDate: "2026-09-12",
    latitude: 47.8614,
    longitude: 12.0873,
    markerImageSrc: PIC,
  },
  {
    id: "s2",
    name: "Santa Gulia",
    arrivalDate: "2026-09-16",
    latitude: 41.53477,
    longitude: 9.268294,
    markerImageSrc: PIC,
  },
  {
    id: "s3",
    name: "Livorno",
    arrivalDate: "2026-09-20",
    latitude: 43.519252,
    longitude: 10.282475,
  },
  {
    id: "s9",
    name: "Bruckmühl (Ankunft)",
    arrivalDate: "2026-09-26",
    latitude: 47.8614,
    longitude: 12.0873,
    markerImageSrc: PIC,
  },
];

function MapCheck() {
  return (
    <div className="min-h-screen bg-background p-6">
      <h1 className="font-display text-3xl mb-4">Marker-Prüfung</h1>
      <RouteMapLazy
        stations={stations}
        cluster
        className="route-map-canvas"
        ariaLabel="Prüfkarte"
      />
    </div>
  );
}
