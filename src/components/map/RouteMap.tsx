// Weltkarte mit Reiseroute. Wird ausschließlich clientseitig geladen
// (siehe RouteMapLazy), weil MapLibre auf Browser-APIs angewiesen ist.
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
  boundsOf,
  buildRouteLegs,
  introDurationMs,
  isValidLatLon,
  type RoutePoint,
} from "./route-geometry";

export type MapPlace = {
  id: string;
  name: string;
  category?: string | null;
  latitude: number;
  longitude: number;
};

export type MapStation = RoutePoint & {
  id: string;
  name: string;
  arrivalDate: string | null;
  /** Kleines Vorschaubild (400px-Variante) für den Marker. */
  markerImageSrc?: string | null;
  /** Orte, Restaurants, Cafés als kleine Punkte. */
  places?: MapPlace[];
};

export type RouteMapProps = {
  stations: MapStation[];
  /** Station, die hervorgehoben und angeflogen wird. */
  activeStationId?: string | null;
  onSelectStation?: (id: string) => void;
  /** Kartenklick liefert Koordinaten (nur im Studio genutzt). */
  onMapClick?: (coords: { latitude: number; longitude: number }) => void;
  /** Marker per Drag verschieben (nur im Studio). */
  onMoveStation?: (id: string, coords: { latitude: number; longitude: number }) => void;
  draggableMarkers?: boolean;
  /** Kurze Routenanimation beim ersten Anzeigen. */
  animateOnMount?: boolean;
  /** Verbindungslinie zwischen den Punkten zeichnen. */
  showRoute?: boolean;
  /** Zoom/Verschieben per Maus und Touch erlauben. */
  interactive?: boolean;
  /** Zoom-Buttons oben rechts anzeigen. */
  showControls?: boolean;
  /** Markerform: Vorschaubild oder schlichter Punkt. */
  markerVariant?: "photo" | "dot";
  /** Reisename als kleiner Tooltip beim Überfahren. */
  hoverLabels?: boolean;
  className?: string;
  ariaLabel?: string;
};

const STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

// MapLibre resolves its worker relative to the generated JavaScript chunk by
// default. In the self-hosted build that points at a file which is not copied
// to /assets, so the basemap appears but markers and route layers never load.
// The explicit Vite URL import emits the worker as a versioned build asset.
maplibregl.setWorkerUrl(mapWorkerUrl);

const ROUTE_SOURCE = "trip-route";
const DASHED_LAYER = "trip-route-dashed";
const SOLID_LAYER = "trip-route-solid";
const PLACE_SOURCE = "trip-places";
const PLACE_LAYER = "trip-places-dots";
const PLACE_LABEL_LAYER = "trip-places-labels";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function RouteMap({
  stations,
  activeStationId = null,
  onSelectStation,
  onMapClick,
  onMoveStation,
  draggableMarkers = false,
  animateOnMount = false,
  showRoute = true,
  interactive = true,
  showControls = true,
  markerVariant = "photo",
  hoverLabels = false,
  className,
  ariaLabel = "Karte der Reiseroute",
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // --- Karte aufbauen -------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: [10, 48],
        zoom: 2,
        attributionControl: { compact: true },
        // Teaser-Karten sind nicht bedienbar, damit Scrollen nicht hängenbleibt.
        interactive,
      });
    } catch (err) {
      console.warn("map init failed", err);
      setFailed(true);
      return;
    }
    mapRef.current = map;
    if (showControls) {
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    }
    map.on("load", () => {
      // Globusdarstellung, wenn der Browser sie unterstützt — sonst flach.
      try {
        map.setProjection({ type: "globe" });
      } catch {
        /* flache Karte ist ein akzeptabler Fallback */
      }
      setReady(true);
    });
    map.on("error", (e) => {
      // Fehlende Kacheln sind nicht tödlich; ein Style-Fehler schon.
      if (!e?.error) return;
      console.warn("map error", e.error.message);
      if (!mapRef.current?.isStyleLoaded()) setFailed(true);
    });

    const markers = markersRef.current;
    return () => {
      markers.forEach((m) => m.remove());
      markers.clear();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [reloadKey]);

  // --- Kartenklick ----------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onMapClick) return;
    const handler = (e: maplibregl.MapMouseEvent) => {
      onMapClick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onMapClick, ready]);

  // --- Route zeichnen -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const legs = showRoute ? buildRouteLegs(stations) : [];
    const dashed = legs.filter((l) => l.dashed).flatMap((l) => l.segments);
    const solid = legs.filter((l) => !l.dashed).flatMap((l) => l.segments);

    const data = {
      type: "FeatureCollection" as const,
      features: [
        ...solid.map((coords) => ({
          type: "Feature" as const,
          properties: { dashed: false },
          geometry: { type: "LineString" as const, coordinates: coords },
        })),
        ...dashed.map((coords) => ({
          type: "Feature" as const,
          properties: { dashed: true },
          geometry: { type: "LineString" as const, coordinates: coords },
        })),
      ],
    };

    const existing = map.getSource(ROUTE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
    } else {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data });
      map.addLayer({
        id: SOLID_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "dashed"], false],
        paint: { "line-color": "#c2410c", "line-width": 3, "line-opacity": 0.9 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: DASHED_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        filter: ["==", ["get", "dashed"], true],
        paint: {
          "line-color": "#c2410c",
          "line-width": 2.5,
          "line-dasharray": [2, 2],
          "line-opacity": 0.85,
        },
      });
    }
  }, [stations, ready, showRoute]);

  // --- Orte/Restaurants/Cafés als kleine Punkte ----------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const features = stations.flatMap((station) =>
      (station.places ?? [])
        .filter((p) => isValidLatLon(p.latitude, p.longitude))
        .map((p) => ({
          type: "Feature" as const,
          properties: { name: p.name, category: p.category ?? "" },
          geometry: { type: "Point" as const, coordinates: [p.longitude, p.latitude] },
        })),
    );
    const data = { type: "FeatureCollection" as const, features };

    const existing = map.getSource(PLACE_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    map.addSource(PLACE_SOURCE, { type: "geojson", data });
    map.addLayer({
      id: PLACE_LAYER,
      type: "circle",
      source: PLACE_SOURCE,
      paint: {
        "circle-radius": 5,
        "circle-color": "#0f172a",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-opacity": 0.9,
      },
    });
    map.addLayer({
      id: PLACE_LABEL_LAYER,
      type: "symbol",
      source: PLACE_SOURCE,
      minzoom: 10,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 11,
        "text-offset": [0, 1.1],
        "text-anchor": "top",
      },
      paint: { "text-halo-color": "#ffffff", "text-halo-width": 1.4 },
    });

    // Antippen zeigt den Namen des Ortes.
    map.on("click", PLACE_LAYER, (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const name = String(feature.properties?.name ?? "");
      if (!name) return;
      new maplibregl.Popup({ closeButton: false, offset: 10 })
        .setLngLat(e.lngLat)
        .setText(name)
        .addTo(map);
    });
    map.on("mouseenter", PLACE_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", PLACE_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });
  }, [stations, ready]);

  // --- Marker ---------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const keep = new Set<string>();

    stations.forEach((station, index) => {
      if (!isValidLatLon(station.latitude, station.longitude)) return;
      keep.add(station.id);
      let marker = markersRef.current.get(station.id);

      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "route-marker";
        el.setAttribute("aria-label", `Station ${index + 1}: ${station.name}`);
        el.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectStation?.(station.id);
        });
        marker = new maplibregl.Marker({ element: el, draggable: draggableMarkers }).setLngLat([
          station.longitude,
          station.latitude,
        ]);
        marker.addTo(map);
        if (draggableMarkers && onMoveStation) {
          marker.on("dragend", () => {
            const pos = marker!.getLngLat();
            onMoveStation(station.id, { latitude: pos.lat, longitude: pos.lng });
          });
        }
        markersRef.current.set(station.id, marker);
      } else {
        marker.setLngLat([station.longitude, station.latitude]);
        marker.setDraggable(draggableMarkers);
      }

      const el = marker.getElement();
      el.setAttribute("aria-label", `Station ${index + 1}: ${station.name}`);
      el.classList.toggle("is-active", station.id === activeStationId);
      el.innerHTML = "";
      if (station.markerImageSrc) {
        const img = document.createElement("img");
        img.src = station.markerImageSrc;
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        // Fällt das Bild aus, bleibt der Punkt sichtbar.
        img.addEventListener("error", () => {
          img.remove();
          el.classList.add("no-image");
        });
        el.appendChild(img);
      } else {
        el.classList.add("no-image");
      }
      const label = document.createElement("span");
      label.className = "route-marker-index";
      label.textContent = String(index + 1);
      el.appendChild(label);
    });

    markersRef.current.forEach((marker, id) => {
      if (!keep.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [stations, activeStationId, draggableMarkers, onSelectStation, onMoveStation, ready]);

  // --- Erstanzeige: Route einpassen, optional animieren --------------------
  const didFitRef = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || didFitRef.current) return;
    const bounds = boundsOf(stations);
    if (!bounds) return;
    didFitRef.current = true;
    const [w, s, e, n] = bounds;
    const bbox: LngLatBoundsLike = [
      [w, s],
      [e, n],
    ];
    const single = stations.length === 1;
    if (single) {
      map.jumpTo({ center: [stations[0]!.longitude, stations[0]!.latitude], zoom: 6 });
      return;
    }
    if (animateOnMount && !prefersReducedMotion()) {
      map.fitBounds(bbox, {
        padding: 60,
        duration: introDurationMs(stations.length),
        essential: false,
      });
    } else {
      map.fitBounds(bbox, { padding: 60, duration: 0 });
    }
  }, [stations, animateOnMount, ready]);

  // --- Aktive Station anfliegen -------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !activeStationId) return;
    const station = stations.find((s) => s.id === activeStationId);
    if (!station || !isValidLatLon(station.latitude, station.longitude)) return;
    const reduce = prefersReducedMotion();
    map.easeTo({
      center: [station.longitude, station.latitude],
      zoom: Math.max(map.getZoom(), 5),
      duration: reduce ? 0 : 900,
    });
  }, [activeStationId, stations, ready]);

  if (failed) {
    return (
      <div className={className} role="status">
        <div className="map-fallback">
          <p>Die Karte konnte nicht geladen werden.</p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              didFitRef.current = false;
              setReloadKey((k) => k + 1);
            }}
          >
            Karte neu laden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      role="application"
      aria-label={ariaLabel}
      // Karte ist Zusatzinformation: die Stationsliste darunter enthält
      // dieselben Angaben in Textform.
    />
  );
}
