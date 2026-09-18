// Stationseditor: Ortssuche, Kartenklick, Marker verschieben, manuelle
// Koordinaten, Text, Reihenfolge, Zielort und Medienzuordnung.
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { RouteMapLazy, type MapStation } from "@/components/map/RouteMapLazy";
import { distanceKm, sortByArrival, type LegMode } from "@/components/map/route-geometry";
import { RichTextEditor } from "@/components/studio/RichTextEditor";
import { useConfirm } from "@/components/studio/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  daily_enabled?: boolean;
  day_entries?: DayEntry[] | null;
  updated_at: string;
};

type DayEntry = { date: string; bodyMd: string };

/** Mehr Editorfelder auf einmal belasten kleine Server und Browser unnötig. */
const MAX_EDITABLE_DAYS = 31;

/** Alle Tage von Ankunft bis Abreise (einschließlich) als ISO-Datum. */
function daysInRange(arrival: string, departure: string): string[] {
  const start = Date.parse(`${arrival}T00:00:00Z`);
  const end = Date.parse(`${departure}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const days: string[] = [];
  for (let t = start; t <= end && days.length < 120; t += 86400000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/** Tage einer Station aus Ankunft und Abreise. */
function stationDays(station: { arrival_date: string | null; departure_date: string | null }) {
  const arrival = station.arrival_date ? String(station.arrival_date).slice(0, 10) : "";
  const departure = station.departure_date ? String(station.departure_date).slice(0, 10) : "";
  if (arrival && departure) return daysInRange(arrival, departure);
  const single = arrival || departure;
  return single ? [single] : [];
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

type StudioImage = {
  id: string;
  webp_400: string;
  alt: string | null;
  station_id: string | null;
  day_date?: string | null;
};

/** Ort, Restaurant oder Café als Punkt auf der Karte. */
type StationPlaceRow = {
  id: string;
  station_id: string;
  name: string;
  category: string | null;
  latitude: string;
  longitude: string;
};

type GeocodeHit = {
  name: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
};

const LEG_LABEL: Record<LegMode, string> = {
  drive: "Auto",
  train: "Zug",
  cycle: "Fahrrad",
  walk: "Zu Fuß",
  air: "Flug",
};

function isoDate(value: string | null): string {
  return value ? String(value).slice(0, 10) : "";
}

/** Vorschlagsdaten der Reise: Zielort, Land und Koordinaten. */
export type StationSuggestion = {
  city?: string | null;
  countryCode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  whereText?: string | null;
};

/** „München, Bayern, DE“ → „münchen“ — für den Namensvergleich. */
function normalizePlace(value: string): string {
  return (value.split(",")[0] ?? value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function StationEditor({
  tripId,
  suggestion,
  onSaveTrip,
}: {
  tripId: string;
  suggestion?: StationSuggestion;
  /** Speichert auch die Reisedaten mit, ohne die Seite zu verlassen. */
  onSaveTrip?: () => Promise<void> | void;
}) {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [images, setImages] = useState<StudioImage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Meldungen zusätzlich als Hinweisfenster zeigen, damit sie auch beim
  // Scrollen im Stationsfenster sichtbar sind.
  useEffect(() => {
    if (error) toast.error(error, { duration: 8000 });
  }, [error]);
  useEffect(() => {
    if (status) toast.success(status);
  }, [status]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "failed">("idle");
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");
  const [manualName, setManualName] = useState("");
  const [routeStatus, setRouteStatus] = useState<string | null>(null);
  /** Ergebnis der Ortsnamenprüfung pro Station. */
  const [nameChecks, setNameChecks] = useState<
    Record<
      string,
      {
        state: "checking" | "ok" | "differs" | "coords" | "failed";
        suggested?: string;
        latitude?: number;
        longitude?: number;
      }
    >
  >({});
  /** Station, die im großen Bearbeitungsfenster geöffnet ist. */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** Änderungen im Fenster bleiben lokal, bis „Station speichern“ gewählt wird. */
  const [stationDraft, setStationDraft] = useState<StationRow | null>(null);
  /** Letzter nachweislich gespeicherter Stand des geöffneten Fensters. */
  const [savedStationDraft, setSavedStationDraft] = useState<StationRow | null>(null);
  const [places, setPlaces] = useState<StationPlaceRow[]>([]);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeHits, setPlaceHits] = useState<GeocodeHit[]>([]);
  const [placeState, setPlaceState] = useState<"idle" | "loading" | "failed">("idle");
  const { confirm, dialog: confirmDialog } = useConfirm();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefilled = useRef(false);

  const load = useCallback(async () => {
    const [stationRes, imageRes, placeRes] = await Promise.all([
      fetch(`/api/studio/stations?tripId=${tripId}`),
      fetch(`/api/studio/images?tripId=${tripId}`),
      fetch(`/api/studio/places?tripId=${tripId}`),
    ]);
    if (stationRes.ok) {
      const data = await stationRes.json();
      setStations(data.stations ?? []);
    }
    if (imageRes.ok) {
      const data = await imageRes.json();
      setImages(data.images ?? []);
    }
    if (placeRes.ok) {
      const data = await placeRes.json();
      setPlaces(data.places ?? []);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reise ohne Stationen: Zielort der Reise als Vorschlag übernehmen.
  useEffect(() => {
    if (prefilled.current || stations.length > 0 || !suggestion) return;
    const name = (suggestion.city ?? suggestion.whereText ?? "").trim();
    if (!name) return;
    prefilled.current = true;
    setManualName((prev) => prev || name);
    if (suggestion.latitude !== null && suggestion.latitude !== undefined) {
      setManualLat((prev) => prev || String(suggestion.latitude));
    }
    if (suggestion.longitude !== null && suggestion.longitude !== undefined) {
      setManualLon((prev) => prev || String(suggestion.longitude));
    }
    setQuery((prev) => prev || name);
  }, [stations.length, suggestion]);

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

  // Beim Abreiseort gibt es keine Ankunft, beim letzten Ort keine Abreise.
  // Alte Werte aus früheren Reihenfolgen werden hier still entfernt, damit in
  // der Liste kein längst überholtes Datum stehen bleibt.
  useEffect(() => {
    if (stations.length === 0) return;
    const first = stations[0];
    if (first?.arrival_date && first.id !== editingId) {
      void patchStation(first.id, { arrivalDate: null });
      return;
    }
    if (stations.length > 1) {
      const last = stations[stations.length - 1];
      if (last?.departure_date && last.id !== editingId) {
        void patchStation(last.id, { departureDate: null });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stations, editingId]);



  async function deleteStation(id: string, name: string) {
    const ok = await confirm({
      title: `Station „${name}“ löschen?`,
      description: "Bilder und Videos bleiben in der Galerie erhalten.",
    });
    if (!ok) return;
    const res = await fetch(`/api/studio/stations?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Station konnte nicht gelöscht werden");
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(null);
    if (editingId === id) setEditingId(null);
    await load();
    setStatus("Station gelöscht.");
  }

  /**
   * Speichert den aktuellen Stand der Station und der Reise, ohne die Seite zu
   * verlassen. Die Felder schreiben beim Verlassen; darum wird das aktive Feld
   * zuerst abgeschlossen.
   */
  /**
   * Erzeugt die lokale Arbeitskopie einer Station. Tageseinträge kommen je nach
   * Datenstand als Liste, als Text oder gar nicht — hier immer als Liste.
   */
  function draftFrom(station: StationRow): StationRow {
    const raw: unknown = station.day_entries;
    let entries: unknown = raw;
    if (typeof raw === "string") {
      try {
        entries = JSON.parse(raw);
      } catch {
        entries = [];
      }
    }
    return {
      ...station,
      day_entries: Array.isArray(entries)
        ? (entries as DayEntry[]).map((entry) => ({ ...entry }))
        : [],
    };
  }

  function openStation(station: StationRow) {
    const draft = draftFrom(station);
    setActiveId(station.id);
    setStationDraft(draft);
    setSavedStationDraft(draft);
    setEditingId(station.id);
    setError(null);
    setStatus(null);
    setPlaceQuery("");
    setPlaceHits([]);
  }

  // Sicherheitsnetz: Ist das Fenster offen, aber keine Arbeitskopie vorhanden,
  // wird sie aus dem gespeicherten Stand nachgezogen — sonst bliebe das Fenster leer.
  useEffect(() => {
    if (!editingId) return;
    if (stationDraft?.id === editingId) return;
    const saved = stations.find((s) => s.id === editingId);
    if (saved) {
      const draft = draftFrom(saved);
      setStationDraft(draft);
      setSavedStationDraft(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, stations, stationDraft]);


  function updateDraft(patch: Partial<StationRow>) {
    setStationDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function comparableStation(station: StationRow | null) {
    if (!station) return "";
    const normalized = draftFrom(station);
    return JSON.stringify({
      name: normalized.name,
      latitude: Number(normalized.latitude),
      longitude: Number(normalized.longitude),
      arrival: isoDate(normalized.arrival_date),
      departure: isoDate(normalized.departure_date),
      body: normalized.body_md,
      legMode: normalized.leg_mode,
      published: normalized.published,
      destination: normalized.is_destination,
      markerImageId: normalized.marker_image_id,
      dailyEnabled: Boolean(normalized.daily_enabled),
      dayEntries: normalized.day_entries,
    });
  }

  const hasUnsavedStationChanges =
    stationDraft !== null && comparableStation(stationDraft) !== comparableStation(savedStationDraft);

  async function closeStationEditor() {
    if (busy) return;
    if (hasUnsavedStationChanges) {
      const discard = await confirm({
        title: "Änderungen verwerfen?",
        description:
          "Diese Station wurde geändert, aber noch nicht gespeichert. Beim Beenden gehen diese Änderungen verloren.",
        confirmLabel: "Änderungen verwerfen",
        cancelLabel: "Weiter bearbeiten",
      });
      if (!discard) return;
    }
    setEditingId(null);
    setStationDraft(null);
    setSavedStationDraft(null);
  }

  async function saveStation(): Promise<boolean> {
    if (!stationDraft) return false;
    const stationIndex = stations.findIndex((station) => station.id === stationDraft.id);
    const isFirst = stationIndex === 0;
    const isLast = stationIndex === stations.length - 1 && stations.length > 1;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/stations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          id: stationDraft.id,
          name: stationDraft.name.trim(),
          latitude: Number(stationDraft.latitude),
          longitude: Number(stationDraft.longitude),
          arrivalDate: isFirst ? null : isoDate(stationDraft.arrival_date) || null,
          departureDate: isLast ? null : isoDate(stationDraft.departure_date) || null,
          bodyMd: stationDraft.body_md,
          legMode: stationDraft.leg_mode,
          published: stationDraft.published,
          isDestination: stationDraft.is_destination,
          markerImageId: stationDraft.marker_image_id,
          dailyEnabled: Boolean(stationDraft.daily_enabled),
          dayEntries: stationDraft.day_entries ?? [],
        }),
      });
      const responseText = await res.text();
      type SaveStationResponse = { error?: string; station?: StationRow };
      let data: SaveStationResponse | null;
      try {
        data = responseText ? (JSON.parse(responseText) as SaveStationResponse) : null;
      } catch {
        throw new Error(
          res.ok
            ? "Der Server hat keine gültige Speicherbestätigung gesendet"
            : `Station konnte nicht gespeichert werden (Serverfehler ${res.status})`,
        );
      }
      if (!res.ok) throw new Error(data?.error ?? "Station konnte nicht gespeichert werden");
      if (!data?.station?.id) throw new Error("Der Server hat keinen gespeicherten Stand bestätigt");
      const savedStation = draftFrom(data.station as StationRow);
      setStations((current) =>
        current.map((station) => (station.id === stationDraft.id ? savedStation : station)),
      );
      setStationDraft(savedStation);
      setSavedStationDraft(savedStation);

      await onSaveTrip?.();
      setStatus("Station gespeichert.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Station konnte nicht gespeichert werden");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Bild oder Video einem einzelnen Tag der Station zuordnen. */
  async function assignImageDay(imageId: string, dayDate: string | null) {
    // Die Tagesoption muss serverseitig gespeichert sein, sonst lehnt der Server
    // die Tageszuordnung ab. Darum offene Stationsänderungen zuerst speichern.
    if (dayDate && hasUnsavedStationChanges) {
      const saved = await saveStation();
      if (!saved) return;
    }
    const res = await fetch("/api/studio/images", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: imageId, dayDate }),
    });
    if (!res.ok) {
      // Klartext vom Server zeigen, damit die Ursache erkennbar ist.
      let detail = "";
      try {
        const body = (await res.json()) as { error?: string };
        detail = body?.error ? ` (${body.error})` : "";
      } catch {
        detail = "";
      }
      setStatus(null);
      setError(`Bild konnte dem Tag nicht zugeordnet werden${detail}`);
      return;
    }
    setError(null);
    setImages((prev) =>
      prev.map((img) => (img.id === imageId ? { ...img, day_date: dayDate } : img)),
    );
    setStatus(dayDate ? "Bild dem Tag zugeordnet." : "Bild gilt für die ganze Station.");
  }

  /** Ortssuche für Restaurants, Cafés und Sehenswürdigkeiten. */
  async function searchPlaces(station: StationRow) {
    const q = placeQuery.trim();
    if (q.length < 2) return;
    setPlaceState("loading");
    try {
      const res = await fetch("/api/studio/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          poi: true,
          limit: 8,
          near: { latitude: Number(station.latitude), longitude: Number(station.longitude) },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Suche fehlgeschlagen");
      setPlaceHits(data.results ?? []);
      setPlaceState("idle");
    } catch {
      setPlaceHits([]);
      setPlaceState("failed");
    }
  }

  async function addPlace(station: StationRow, hit: GeocodeHit & { category?: string | null }) {
    const res = await fetch("/api/studio/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stationId: station.id,
        name: hit.name,
        category: hit.category ?? null,
        latitude: hit.latitude,
        longitude: hit.longitude,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data?.error ?? "Ort konnte nicht gespeichert werden");
      return;
    }
    setPlaces((prev) => [...prev, data.place]);
    setPlaceQuery("");
    setPlaceHits([]);
    setStatus(`„${hit.name}“ als Punkt auf der Karte gesetzt.`);
  }

  async function renamePlace(id: string, name: string) {
    const res = await fetch("/api/studio/places", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name }),
    });
    if (!res.ok) {
      setError("Name des Ortes konnte nicht geändert werden");
      return;
    }
    setPlaces((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  async function deletePlace(id: string, name: string) {
    const ok = await confirm({
      title: `Punkt „${name}“ entfernen?`,
      description: "Der Punkt verschwindet damit von der Karte.",
    });
    if (!ok) return;
    const res = await fetch(`/api/studio/places?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Ort konnte nicht entfernt werden");
      return;
    }
    setPlaces((prev) => prev.filter((p) => p.id !== id));
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

  async function publishAllDrafts() {
    const drafts = stations.filter((station) => !station.published);
    if (drafts.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const responses = await Promise.all(
        drafts.map((station) =>
          fetch("/api/studio/stations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: station.id, published: true }),
          }),
        ),
      );
      if (responses.some((response) => !response.ok)) {
        throw new Error("Nicht alle Stationen konnten veröffentlicht werden");
      }
      await load();
      setStatus(
        `${drafts.length} ${drafts.length === 1 ? "Station wurde" : "Stationen wurden"} veröffentlicht.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
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
    places: places
      .filter((p) => p.station_id === s.id)
      .map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
      })),
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

  /** Ortssuche nach einem Namen (erster Treffer). */
  async function forwardLookup(name: string) {
    try {
      const res = await fetch("/api/studio/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: name }),
      });
      const data = await res.json();
      const list = (data?.results ?? []) as GeocodeHit[];
      return list[0] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Prüft, ob Stationsname und Kartenposition zusammenpassen. Geprüft wird in
   * beide Richtungen: Name → Koordinate (Ortssuche) und Koordinate → Name
   * (Rückwärtssuche). So genügt es, wenn einer der beiden Dienste antwortet.
   */
  async function checkStationName(station: StationRow) {
    setNameChecks((prev) => ({ ...prev, [station.id]: { state: "checking" } }));
    const coords = { latitude: Number(station.latitude), longitude: Number(station.longitude) };
    const typed = station.name.trim();
    const [reverse, forward] = await Promise.all([
      reverseLookup(coords),
      typed ? forwardLookup(typed) : Promise.resolve(null),
    ]);

    if (reverse?.name && normalizePlace(reverse.name) === normalizePlace(typed)) {
      setNameChecks((prev) => ({ ...prev, [station.id]: { state: "ok" } }));
      return;
    }

    if (forward) {
      // Name ist bekannt: passt die gespeicherte Koordinate dazu?
      const km = distanceKm(coords, forward);
      if (km <= 25) {
        setNameChecks((prev) => ({ ...prev, [station.id]: { state: "ok" } }));
        return;
      }
      setNameChecks((prev) => ({
        ...prev,
        [station.id]: {
          state: "coords",
          suggested: forward.name,
          latitude: forward.latitude,
          longitude: forward.longitude,
        },
      }));
      return;
    }

    if (reverse?.name) {
      setNameChecks((prev) => ({
        ...prev,
        [station.id]: { state: "differs", suggested: reverse.name },
      }));
      return;
    }

    setNameChecks((prev) => ({ ...prev, [station.id]: { state: "failed" } }));
  }

  async function checkAllNames() {
    for (const station of stations) {
      await checkStationName(station);
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
                void (async () => {
                  const name = manualName.trim();
                  if (!name) {
                    setError("Bitte einen Namen für die Station eintragen");
                    return;
                  }
                  const latRaw = manualLat.trim().replace(",", ".");
                  const lonRaw = manualLon.trim().replace(",", ".");
                  let lat = Number(latRaw);
                  let lon = Number(lonRaw);
                  let countryCode: string | null | undefined;

                  // Leere Koordinatenfelder dürfen NIE als 0/0 im Golf von
                  // Guinea landen: dann wird der Ort über die Ortssuche
                  // bestimmt.
                  if (latRaw === "" || lonRaw === "") {
                    setError(null);
                    setStatus(`Suche Position für „${name}“ …`);
                    const hit = await forwardLookup(name);
                    if (!hit) {
                      setStatus(null);
                      setError(
                        `Für „${name}“ wurde keine Position gefunden. Bitte auf die Karte klicken oder Breite und Länge eintragen.`,
                      );
                      return;
                    }
                    lat = hit.latitude;
                    lon = hit.longitude;
                    countryCode = hit.countryCode;
                  }

                  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
                    setError("Breite muss zwischen -90 und 90 liegen");
                    return;
                  }
                  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
                    setError("Länge muss zwischen -180 und 180 liegen");
                    return;
                  }
                  await createStation({ name, latitude: lat, longitude: lon, countryCode });
                  setManualName("");
                  setManualLat("");
                  setManualLon("");
                })();
              }}
            >
              Station hinzufügen
            </button>
            <p className="station-hint">
              Tipp: Ein Klick auf die Karte füllt diese Felder automatisch. Bleiben Breite und Länge
              leer, wird die Position über den Ortsnamen gesucht.
            </p>
          </fieldset>

          <div className="station-route-actions">
            {stations.some((station) => !station.published) && (
              <button type="button" onClick={() => void publishAllDrafts()} disabled={busy}>
                Alle Stationen veröffentlichen
              </button>
            )}
            <button type="button" onClick={() => void sortByDate()} disabled={stations.length < 2}>
              Nach Datum sortieren
            </button>
            <button
              type="button"
              onClick={() => void checkAllNames()}
              disabled={stations.length === 0}
            >
              Alle Ortsnamen prüfen
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
                    {(() => {
                      const arrival = index === 0 ? "" : isoDate(station.arrival_date);
                      const departure =
                        index === stations.length - 1 && stations.length > 1
                          ? ""
                          : isoDate(station.departure_date);
                      if (!arrival && !departure) return "";
                      return `${arrival || "…"} – ${departure || "…"} · `;
                    })()}

                    {images.filter((i) => i.station_id === station.id).length} Bilder
                    {" · "}
                    {station.published ? "öffentlich" : "Entwurf"}
                    {station.is_destination ? " · Zielort" : ""}
                  </span>
                </header>

                <div className="station-item-row">
                  <button
                    type="button"
                    onClick={() => {
                      openStation(station);
                    }}
                    aria-label={`Station ${station.name} bearbeiten`}
                    title="Station bearbeiten"
                  >
                    <Pencil aria-hidden="true" size={14} />
                  </button>
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
                  <button
                    type="button"
                    onClick={() => void deleteStation(station.id, station.name)}
                  >
                    Löschen
                  </button>
                </div>

                <Dialog
                  open={editingId === station.id}
                  onOpenChange={(open) => {
                    if (!open) void closeStationEditor();
                  }}
                >
                  <DialogContent
                    className="station-dialog-resizable max-h-[95vh] overflow-auto"
                    style={{ width: "min(96vw, 64rem)", maxWidth: "96vw", height: "80vh" }}
                  >
                    <DialogHeader>
                      <DialogTitle>
                        {index + 1}. {station.name}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="station-dialog-actions">
                      <button
                        type="button"
                        className="station-action-primary"
                        onClick={() => void saveStation()}
                        disabled={busy || !hasUnsavedStationChanges}
                      >
                        Station speichern
                      </button>
                      <button
                        type="button"
                        className="station-action-secondary"
                        onClick={() => void closeStationEditor()}
                        disabled={busy}
                      >
                        Beenden
                      </button>
                    </div>

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

                  {stationDraft?.id === station.id && <div className="station-item-form">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={stationDraft.name}
                        onChange={(e) => updateDraft({ name: e.target.value })}
                      />
                    </label>
                    <div className="station-name-check">
                      <button type="button" onClick={() => void checkStationName(station)}>
                        Ortsnamen prüfen
                      </button>
                      {nameChecks[station.id]?.state === "checking" && (
                        <span className="station-hint">Prüfe Ort …</span>
                      )}
                      {nameChecks[station.id]?.state === "ok" && (
                        <span className="station-hint">Name passt zur Kartenposition ✓</span>
                      )}
                      {nameChecks[station.id]?.state === "coords" && (
                        <span className="station-hint">
                          „{nameChecks[station.id]?.suggested}“ liegt laut Ortssuche an einer
                          anderen Stelle.{" "}
                          <button
                            type="button"
                            onClick={() => {
                              const check = nameChecks[station.id];
                              if (check?.latitude == null || check?.longitude == null) return;
                              updateDraft({
                                latitude: String(check.latitude),
                                longitude: String(check.longitude),
                              });
                              setRouteStatus("Koordinate geändert — Route neu berechnen.");
                            }}
                          >
                            Position übernehmen
                          </button>
                        </span>
                      )}
                      {nameChecks[station.id]?.state === "failed" && (
                        <span className="station-hint">
                          Ort konnte nicht geprüft werden — Koordinaten bitte selbst kontrollieren.
                        </span>
                      )}
                      {nameChecks[station.id]?.state === "differs" && (
                        <span className="station-hint">
                          An dieser Position liegt „{nameChecks[station.id]?.suggested}“.{" "}
                          <button
                            type="button"
                            onClick={() => {
                              const suggested = nameChecks[station.id]?.suggested;
                              if (suggested) updateDraft({ name: suggested });
                            }}
                          >
                            Namen übernehmen
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="station-manual-coords">
                      {index === 0 ? (
                        <p className="station-hint">
                          Abreiseort — hier ist keine Ankunft nötig, nur das Abreisedatum.
                        </p>
                      ) : (
                        <label className="field">
                          <span>Ankunft</span>
                          <input
                            key={`arrival-${station.id}-${isoDate(station.arrival_date)}`}
                            type="date"
                            value={isoDate(stationDraft.arrival_date)}
                            onChange={(e) => updateDraft({ arrival_date: e.target.value || null })}
                          />
                        </label>
                      )}
                      {index === stations.length - 1 && stations.length > 1 ? (
                        <p className="station-hint">
                          Letzter Ort der Reise — ein Abreisedatum ist hier nicht nötig.
                        </p>
                      ) : (
                        <label className="field">
                          <span>Abreise</span>
                          <input
                            key={`departure-${station.id}-${isoDate(station.departure_date)}`}
                            type="date"
                            value={isoDate(stationDraft.departure_date)}
                            onChange={(e) => updateDraft({ departure_date: e.target.value || null })}
                          />
                        </label>
                      )}
                    </div>
                    <label className="field">
                      <span>Anreise zu dieser Station</span>
                      <select
                        value={stationDraft.leg_mode}
                        onChange={(e) => {
                          updateDraft({ leg_mode: e.target.value as LegMode });
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
                    <div className="field">
                      <span>Text zur Station</span>
                      <RichTextEditor
                        key={`body-${station.id}`}
                        value={stationDraft.body_md}
                        ariaLabel={`Text zur Station ${station.name}`}
                        onChange={(html) => updateDraft({ body_md: html })}
                      />
                    </div>

                    <label className="station-checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(stationDraft.daily_enabled)}
                        onChange={(e) => updateDraft({ daily_enabled: e.target.checked })}
                      />
                      <span>Pro Tag einen eigenen Eintrag</span>
                    </label>
                    {stationDraft.daily_enabled &&
                      (() => {
                        const arrival = isoDate(stationDraft.arrival_date);
                        const departure = isoDate(stationDraft.departure_date);
                        const days =
                          arrival && departure
                            ? daysInRange(arrival, departure)
                            : arrival || departure
                              ? [arrival || departure]
                              : [];
                        if (days.length === 0) {
                          return (
                            <p className="station-hint">
                              Bitte erst Ankunft und Abreise eintragen — daraus entstehen die
                              Tagesfelder.
                            </p>
                          );
                        }
                        if (days.length > MAX_EDITABLE_DAYS) {
                          return (
                            <p className="station-error" role="alert">
                              Der Aufenthalt umfasst mehr als {MAX_EDITABLE_DAYS} Tage. Bitte die
                              Datumsangaben prüfen, bevor Tagesfelder angelegt werden.
                            </p>
                          );
                        }
                        const saved = stationDraft.day_entries ?? [];
                        return (
                          <div className="station-days">
                            <p className="station-hint">
                              {days.length} {days.length === 1 ? "Tag" : "Tage"} — pro Tag ein
                              eigener Text.
                            </p>
                            {days.map((day) => (
                              <div className="field" key={`${station.id}-${day}`}>
                                <span>{formatDay(day)}</span>
                                <RichTextEditor
                                  value={saved.find((d) => d.date === day)?.bodyMd ?? ""}
                                  ariaLabel={`Text für ${formatDay(day)}`}
                                  minHeight={120}
                                  onChange={(html) => {
                                    const next: DayEntry[] = days.map((d) => ({
                                      date: d,
                                      bodyMd:
                                        d === day
                                          ? html
                                          : (saved.find((s) => s.date === d)?.bodyMd ?? ""),
                                    }));
                                    updateDraft({ day_entries: next });
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    <label className="station-checkbox">
                      <input
                        type="checkbox"
                        checked={stationDraft.published}
                        onChange={(e) => updateDraft({ published: e.target.checked })}
                      />
                      <span>Station veröffentlichen</span>
                    </label>
                    <label className="station-checkbox">
                      <input
                        type="checkbox"
                        checked={stationDraft.is_destination}
                        disabled={!stationDraft.published}
                        onChange={(e) => updateDraft({ is_destination: e.target.checked })}
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
                                  updateDraft({ marker_image_id: img.id })
                                }
                              >
                                {stationDraft.marker_image_id === img.id
                                  ? "Kartenbild ✓"
                                  : "Als Kartenbild"}
                              </button>
                              {stationDraft.daily_enabled && (
                                <select
                                  aria-label={`Tag für dieses Bild in ${station.name}`}
                                  value={isoDate(img.day_date ?? null)}
                                  onChange={(e) =>
                                    void assignImageDay(img.id, e.target.value || null)
                                  }
                                >
                                  <option value="">Ganze Station</option>
                                  {stationDays(stationDraft).map((day) => (
                                    <option key={day} value={day}>
                                      {formatDay(day)}
                                    </option>
                                  ))}
                                </select>
                              )}
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

                    <div className="station-places">
                      <p className="station-hint">
                        Orte, Restaurants und Cafés — erscheinen als kleiner Punkt auf der Karte.
                      </p>
                      <label className="field">
                        <span>Ort in der Nähe suchen</span>
                        <input
                          type="search"
                          value={placeQuery}
                          onChange={(e) => setPlaceQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              void searchPlaces(station);
                            }
                          }}
                          placeholder="z. B. Café Central"
                        />
                      </label>
                      <button type="button" onClick={() => void searchPlaces(station)}>
                        Suchen
                      </button>
                      {placeState === "loading" && <p className="station-hint">Suche läuft …</p>}
                      {placeState === "failed" && (
                        <p className="station-hint">Ortssuche gerade nicht erreichbar.</p>
                      )}
                      {placeHits.length > 0 && (
                        <ul className="station-hits">
                          {placeHits.map((hit) => (
                            <li key={`${hit.latitude},${hit.longitude}-${hit.name}`}>
                              <button type="button" onClick={() => void addPlace(station, hit)}>
                                {hit.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <ul className="station-place-list">
                        {places
                          .filter((p) => p.station_id === station.id)
                          .map((place) => (
                            <li key={place.id}>
                              <input
                                aria-label="Name des Ortes"
                                defaultValue={place.name}
                                onBlur={(e) => {
                                  const next = e.target.value.trim();
                                  if (next && next !== place.name) void renamePlace(place.id, next);
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => void deletePlace(place.id, place.name)}
                              >
                                Entfernen
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </div>}
                    <DialogFooter>
                      <button
                        type="button"
                        className="station-action-primary"
                        onClick={() => void saveStation()}
                        disabled={busy || !hasUnsavedStationChanges}
                      >
                        Station speichern
                      </button>
                      <button
                        type="button"
                        className="station-action-secondary"
                        onClick={() => void closeStationEditor()}
                        disabled={busy}
                      >
                        Beenden
                      </button>
                    </DialogFooter>

                  </DialogContent>
                </Dialog>
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
      {confirmDialog}
    </section>
  );
}
