// Weltkarte mit Reiseroute. Wird ausschließlich clientseitig geladen
// (siehe RouteMapLazy), weil MapLibre auf Browser-APIs angewiesen ist.
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  boundsOf,
  buildRouteLegs,
  introDurationMs,
  isValidLatLon,
  type RoutePoint,
} from "./route-geometry";

export type MapStation = RoutePoint & {
  id: string;
  name: string;
  arrivalDate: string | null;
  /** Kleines Vorschaubild (400px-Variante) für den Marker. */
  markerImageSrc?: string | null;
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
  className?: string;
  ariaLabel?: string;
};

const STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/liberty";

const ROUTE_SOURCE = "trip-route";
const DASHED_LAYER = "trip-route-dashed";
const SOLID_LAYER = "trip-route-solid";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
      });
    } catch (err) {
      console.warn("map init failed", err);
      setFailed(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
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

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
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

    const legs = buildRouteLegs(stations);
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
