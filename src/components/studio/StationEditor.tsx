// Stationseditor: Ortssuche, Kartenklick, Marker verschieben, manuelle
// Koordinaten, Text, Reihenfolge, Zielort und Medienzuordnung.
import { useCallback, useEffect, useRef, useState } from "react";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { sortByArrival, type LegMode } from "@/components/map/route-geometry";

type StationRow = {
  id: string;
  trip_id: string;
  name: string;
  country_code: string | null;
  latitude: string;
  longitude: string;
  arrival_date: string | null;
  departure_date: string | null;
  body_md: string;
  sort_order: number;
  published: boolean;
  is_destination: boolean;
  marker_image_id: string | null;
  leg_mode: LegMode;
  leg_geometry: number[][][] | null;
  updated_at: string;
};

type StudioImage = {
  id: string;
  webp_400: string;
  alt: string | null;
  station_id: string | null;
};

type GeocodeHit = {
  name: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
};

const LEG_LABEL: Record<LegMode, string> = {
  drive: "Auto",
  cycle: "Fahrrad",
  walk: "Zu Fuß",
  air: "Flug",
};

function isoDate(value: string | null): string {
  return value ? String(value).slice(0, 10) : "";
}

export function StationEditor({ tripId }: { tripId: string }) {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [images, setImages] = useState<StudioImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "failed">("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualName, setManualName] = useState("");
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const [stationRes, imageRes] = await Promise.all([
      fetch(`/api/studio/stations?tripId=${tripId}`),
      fetch(`/api/studio/images?tripId=${tripId}`),
    ]);
    if (stationRes.ok) {
      const data = await stationRes.json();
      setStations(data.stations ?? []);
    }
    if (imageRes.ok) {
      const data = await imageRes.json();
      setImages(data.images ?? []);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // --- Ortssuche (entprellt) ----------------------------------------------
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchState("idle");
      return;
    }
    setSearchState("loading");
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/studio/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Suche fehlgeschlagen");
        setHits(data.results ?? []);
        setSearchState("idle");
      } catch {
        setHits([]);
        setSearchState("failed");
      }
    }, 600);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  async function createStation(input: {
    name: string;
    latitude: number;
    longitude: number;
    countryCode?: string | null;
  }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, ...input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Station konnte nicht angelegt werden");
      setStations((prev) => [...prev, data.station]);
      setActiveId(data.station.id);
      setStatus(`Station „${data.station.name}“ hinzugefügt.`);
      setQuery("");
      setHits([]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patchStation(id: string, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/studio/stations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Änderung nicht gespeichert");
      return;
    }
    setStations((prev) => prev.map((s) => (s.id === id ? data.station : s)));
    setStatus("Gespeichert.");
  }

  async function deleteStation(id: string) {
    if (!window.confirm("Station löschen? Bilder und Videos bleiben in der Galerie erhalten.")) {
      return;
    }
    const res = await fetch(`/api/studio/stations?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Station konnte nicht gelöscht werden");
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
    await load();
    setStatus("Station gelöscht.");
  }

  async function reorder(nextOrder: StationRow[]) {
    setStations(nextOrder);
    const res = await fetch("/api/studio/stations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, order: nextOrder.map((s) => s.id) }),
    });
    if (!res.ok) {
      setError("Reihenfolge konnte nicht gespeichert werden");
      await load();
      return;
    }
    await load();
    setStatus("Reihenfolge gespeichert. Route bitte neu berechnen.");
  }

  function move(index: number, delta: number) {
    const next = [...stations];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    void reorder(next);
  }

  async function sortByDate() {
    void reorder(
      sortByArrival(
        stations.map((s) => ({ ...s, arrivalDate: isoDate(s.arrival_date) || null })),
      ) as StationRow[],
    );
  }

  async function recomputeRoute() {
    setRouteStatus("Route wird berechnet …");
    try {
      const res = await fetch("/api/studio/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Routenberechnung fehlgeschlagen");
      setRouteStatus(
        data.fallbacks > 0
          ? `Route berechnet. ${data.fallbacks} von ${data.legs} Abschnitten ohne Straßenweg — diese werden als gestrichelter Bogen gezeichnet.`
          : `Route berechnet (${data.legs} Abschnitte).`,
      );
      await load();
    } catch (err) {
      setRouteStatus((err as Error).message);
    }
  }

  async function assignImage(imageId: string, stationId: string | null) {
    const res = await fetch("/api/studio/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: imageId, stationId }),
    });
    if (!res.ok) {
      setError("Bild konnte nicht zugeordnet werden");
      return;
    }
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, station_id: stationId } : img)),
    );
    setStatus("Bild zugeordnet.");
  }

  const mapStations: MapStation[] = stations.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: Number(s.latitude),
    longitude: Number(s.longitude),
    arrivalDate: isoDate(s.arrival_date) || null,
    legMode: s.leg_mode,
    legGeometry: s.leg_geometry,
    markerImageSrc:
      images.find((i) => i.id === s.marker_image_id)?.webp_400 ??
      images.find((i) => i.station_id === s.id)?.webp_400 ??
      null,
  }));

  async function reverseLookup(coords: { latitude: number; longitude: number }) {
    try {
      const res = await fetch("/api/studio/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(coords),
      });
      const data = await res.json();
      return (data?.result ?? null) as GeocodeHit | null;
    } catch {
      return null;
    }
  }

  const handleMapClick = useCallback(async (coords: { latitude: number; longitude: number }) => {
    const hit = await reverseLookup(coords);
    // Kein Treffer → Name bleibt leer und wird manuell eingetragen.
    setManualLat(coords.latitude.toFixed(6));
    setManualLon(coords.longitude.toFixed(6));
    setManualName(hit?.name ?? "");
    setStatus(
      hit
        ? `Ort erkannt: ${hit.name}. Unten prüfen und hinzufügen.`
        : "Ort nicht erkannt — bitte Namen unten eintragen.",
    );
  }, []);

  const handleMoveStation = useCallback(
    (id: string, coords: { latitude: number; longitude: number }) => {
      void patchStation(id, { latitude: coords.latitude, longitude: coords.longitude });
      setRouteStatus("Koordinate geändert — Route neu berechnen.");
    },

    [],
  );

  const unassigned = images.filter((i) => !i.station_id);

  return (
    <section className="station-editor">
      <h2>Reisestationen</h2>
      <p className="station-editor-intro">
        Stationen ergeben die Route auf der Weltkarte. Nur veröffentlichte Stationen sind für
        Besucher sichtbar.
      </p>

      {error && (
        <p className="station-error" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="station-status" role="status">
          {status}
        </p>
      )}

      <div className="station-editor-grid">
        <div className="station-editor-list">
          <label className="field">
            <span>Ort suchen</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="z. B. München"
            />
          </label>
          {searchState === "loading" && <p className="station-hint">Suche läuft …</p>}
          {searchState === "failed" && (
            <p className="station-hint">
              Ortssuche nicht erreichbar. Koordinaten unten manuell eintragen.
            </p>
          )}
          {hits.length > 0 && (
            <ul className="station-hits">
              {hits.map((hit) => (
                <li key={`${hit.latitude},${hit.longitude}`}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      createStation({
                        name: hit.name,
                        latitude: hit.latitude,
                        longitude: hit.longitude,
                        countryCode: hit.countryCode,
                      })
                    }
                  >
                    {hit.name}
                    {hit.countryCode ? ` (${hit.countryCode.toUpperCase()})` : ""}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <fieldset className="station-manual">
            <legend>Station manuell hinzufügen</legend>
            <label className="field">
              <span>Name</span>
              <input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Ortsname"
              />
            </label>
            <div className="station-manual-coords">
              <label className="field">
                <span>Breite</span>
                <input
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  inputMode="decimal"
                  placeholder="48.137"
                />
              </label>
              <label className="field">
                <span>Länge</span>
                <input
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  inputMode="decimal"
                  placeholder="11.575"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                const lat = Number(manualLat.replace(",", "."));
                const lon = Number(manualLon.replace(",", "."));
                if (!manualName.trim()) {
                  setError("Bitte einen Namen für die Station eintragen");
                  return;
                }
                if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
                  setError("Breite muss zwischen -90 und 90 liegen");
                  return;
                }
                if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
                  setError("Länge muss zwischen -180 und 180 liegen");
                  return;
                }
                void createStation({ name: manualName.trim(), latitude: lat, longitude: lon });
                setManualName("");
                setManualLat("");
                setManualLon("");
              }}
            >
              Station hinzufügen
            </button>
            <p className="station-hint">
              Tipp: Ein Klick auf die Karte füllt diese Felder automatisch.
            </p>
          </fieldset>

          <div className="station-route-actions">
            <button type="button" onClick={() => void sortByDate()} disabled={stations.length < 2}>
              Nach Datum sortieren
            </button>
            <button
              type="button"
              onClick={() => void recomputeRoute()}
              disabled={stations.length < 2}
            >
              Route berechnen
            </button>
          </div>
          {routeStatus && (
            <p className="station-status" role="status">
              {routeStatus}
            </p>
          )}

          <ol className="station-items">
            {stations.map((station, index) => (
              <li
                key={station.id}
                className={station.id === activeId ? "station-item is-active" : "station-item"}
              >
                <header>
                  <button
                    type="button"
                    className="station-item-title"
                    onClick={() => setActiveId(station.id)}
                  >
                    {index + 1}. {station.name}
                  </button>
                  <span className="station-badges">
                    {station.published ? "öffentlich" : "Entwurf"}
                    {station.is_destination ? " · Zielort" : ""}
                  </span>
                </header>

                <div className="station-item-row">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`${station.name} nach oben`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === stations.length - 1}
                    aria-label={`${station.name} nach unten`}
                  >
                    ↓
                  </button>
                  <button type="button" onClick={() => void deleteStation(station.id)}>
                    Löschen
                  </button>
                </div>

                {station.id === activeId && (
                  <div className="station-item-form">
                    <label className="field">
                      <span>Name</span>
                      <input
                        defaultValue={station.name}
                        onBlur={(e) =>
                          e.target.value.trim() &&
                          e.target.value !== station.name &&
                          void patchStation(station.id, { name: e.target.value.trim() })
                        }
                      />
                    </label>
                    <div className="station-manual-coords">
                      <label className="field">
                        <span>Ankunft</span>
                        <input
                          type="date"
                          defaultValue={isoDate(station.arrival_date)}
                          onChange={(e) =>
                            void patchStation(station.id, {
                              arrivalDate: e.target.value || null,
                            })
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Abreise</span>
                        <input
                          type="date"
                          defaultValue={isoDate(station.departure_date)}
                          onChange={(e) =>
                            void patchStation(station.id, {
                              departureDate: e.target.value || null,
                            })
                          }
                        />
                      </label>
                    </div>
                    <label className="field">
                      <span>Anreise zu dieser Station</span>
                      <select
                        defaultValue={station.leg_mode}
                        onChange={(e) => {
                          void patchStation(station.id, { legMode: e.target.value });
                          setRouteStatus("Verkehrsmittel geändert — Route neu berechnen.");
                        }}
                      >
                        {(Object.keys(LEG_LABEL) as LegMode[]).map((mode) => (
                          <option key={mode} value={mode}>
                            {LEG_LABEL[mode]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Text zur Station (Markdown)</span>
                      <textarea
                        rows={6}
                        defaultValue={station.body_md}
                        onBlur={(e) => void patchStation(station.id, { bodyMd: e.target.value })}
                      />
                    </label>
                    <label className="station-checkbox">
                      <input
                        type="checkbox"
                        checked={station.published}
                        onChange={(e) =>
                          void patchStation(station.id, { published: e.target.checked })
                        }
                      />
                      <span>Station veröffentlichen</span>
                    </label>
                    <label className="station-checkbox">
                      <input
                        type="checkbox"
                        checked={station.is_destination}
                        disabled={!station.published}
                        onChange={(e) =>
                          void patchStation(station.id, { isDestination: e.target.checked })
                        }
                      />
                      <span>Als Zielort auf der Kartenübersicht zeigen</span>
                    </label>

                    <div className="station-media">
                      <p className="station-hint">Bilder dieser Station</p>
                      <ul className="station-thumbs">
                        {images
                          .filter((img) => img.station_id === station.id)
                          .map((img) => (
                            <li key={img.id}>
                              <img src={img.webp_400} alt={img.alt ?? ""} loading="lazy" />
                              <button
                                type="button"
                                onClick={() =>
                                  void patchStation(station.id, { markerImageId: img.id })
                                }
                              >
                                {station.marker_image_id === img.id
                                  ? "Kartenbild ✓"
                                  : "Als Kartenbild"}
                              </button>
                              <button type="button" onClick={() => void assignImage(img.id, null)}>
                                Aus Station entfernen
                              </button>
                            </li>
                          ))}
                      </ul>
                      {unassigned.length > 0 && (
                        <>
                          <p className="station-hint">Bilder aus der Galerie zuordnen</p>
                          <ul className="station-thumbs">
                            {unassigned.map((img) => (
                              <li key={img.id}>
                                <img src={img.webp_400} alt={img.alt ?? ""} loading="lazy" />
                                <button
                                  type="button"
                                  onClick={() => void assignImage(img.id, station.id)}
                                >
                                  Dieser Station zuordnen
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {stations.length === 0 && (
            <p className="station-hint">
              Noch keine Stationen. Ort suchen oder auf die Karte klicken.
            </p>
          )}
        </div>

        <div className="station-editor-map">
          <RouteMapLazy
            stations={mapStations}
            activeStationId={activeId}
            onSelectStation={setActiveId}
            onMapClick={handleMapClick}
            onMoveStation={handleMoveStation}
            draggableMarkers
            className="station-map-canvas"
            ariaLabel="Karte zum Setzen der Reisestationen"
          />
        </div>
      </div>
    </section>
  );
}
