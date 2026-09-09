// Lädt die Karte erst im Browser nach. MapLibre darf niemals im
// Server-Rendering importiert werden — daher React.lazy hinter ClientOnly.
import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { RouteMapProps } from "./RouteMap";

const RouteMap = lazy(() => import("./RouteMap"));

export type { MapStation, RouteMapProps } from "./RouteMap";

export function RouteMapLazy(props: RouteMapProps) {
  const placeholder = (
    <div className={props.className} aria-hidden="true">
      <div className="map-fallback">
        <p>Karte wird geladen …</p>
      </div>
    </div>
  );
  return (
    <ClientOnly fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <RouteMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
