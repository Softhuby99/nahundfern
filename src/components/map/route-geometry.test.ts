import { describe, expect, it } from "vitest";
import {
  boundsOf,
  buildRouteLegs,
  distanceKm,
  greatCirclePoints,
  isValidLatLon,
  sortByArrival,
  splitAtAntimeridian,
} from "./route-geometry";
import { simplifyLine } from "@/lib/routing.server";

const munich = { latitude: 48.137, longitude: 11.575 };
const tokyo = { latitude: 35.68, longitude: 139.77 };

describe("isValidLatLon", () => {
  it("weist ungültige Werte ab", () => {
    expect(isValidLatLon(48, 11)).toBe(true);
    expect(isValidLatLon(91, 11)).toBe(false);
    expect(isValidLatLon(48, 181)).toBe(false);
    expect(isValidLatLon(Number.NaN, 11)).toBe(false);
  });
});

describe("distanceKm", () => {
  it("berechnet plausible Entfernungen", () => {
    expect(distanceKm(munich, munich)).toBeCloseTo(0, 5);
    const d = distanceKm(munich, tokyo);
    expect(d).toBeGreaterThan(9000);
    expect(d).toBeLessThan(9800);
  });
});

describe("greatCirclePoints", () => {
  it("beginnt und endet an den Eingabepunkten", () => {
    const pts = greatCirclePoints(munich, tokyo, 16);
    expect(pts.length).toBe(17);
    expect(pts[0]![0]).toBeCloseTo(munich.longitude, 3);
    expect(pts[pts.length - 1]![1]).toBeCloseTo(tokyo.latitude, 3);
  });

  it("liefert bei identischen Punkten keine Linie", () => {
    expect(greatCirclePoints(munich, munich).length).toBe(1);
  });
});

describe("splitAtAntimeridian", () => {
  it("trennt bei einem Sprung über die Datumsgrenze", () => {
    const segments = splitAtAntimeridian([
      [170, 10],
      [179, 12],
      [-178, 14],
      [-170, 15],
    ]);
    expect(segments.length).toBe(2);
    expect(segments[0]![segments[0]!.length - 1]![0]).toBe(180);
    expect(segments[1]![0]![0]).toBe(-180);
  });

  it("lässt normale Linien unverändert", () => {
    const segments = splitAtAntimeridian([
      [10, 48],
      [12, 49],
    ]);
    expect(segments.length).toBe(1);
    expect(segments[0]!.length).toBe(2);
  });
});

describe("buildRouteLegs", () => {
  const base = { legMode: "drive" as const, legGeometry: null };

  it("zeichnet ohne Straßengeometrie einen gestrichelten Bogen", () => {
    const legs = buildRouteLegs([
      { ...munich, ...base },
      { ...tokyo, ...base },
    ]);
    expect(legs.length).toBe(1);
    expect(legs[0]!.dashed).toBe(true);
  });

  it("nutzt gespeicherte Straßengeometrie durchgezogen", () => {
    const legs = buildRouteLegs([
      { ...munich, ...base },
      {
        latitude: 48.3,
        longitude: 11.9,
        legMode: "drive",
        legGeometry: [
          [
            [11.575, 48.137],
            [11.9, 48.3],
          ],
        ],
      },
    ]);
    expect(legs[0]!.dashed).toBe(false);
  });

  it("ignoriert gespeicherte Geometrie bei Flugabschnitten", () => {
    const legs = buildRouteLegs([
      { ...munich, ...base },
      {
        ...tokyo,
        legMode: "air",
        legGeometry: [
          [
            [11.575, 48.137],
            [139.77, 35.68],
          ],
        ],
      },
    ]);
    expect(legs[0]!.dashed).toBe(true);
    expect(legs[0]!.mode).toBe("air");
    // Flugbogen über die Datumsgrenze wird aufgeteilt oder bleibt zusammenhängend,
    // aber niemals leer.
    expect(legs[0]!.segments.length).toBeGreaterThan(0);
  });

  it("überspringt Abschnitte mit ungültigen Koordinaten", () => {
    const legs = buildRouteLegs([
      { ...munich, ...base },
      { latitude: 999, longitude: 11, ...base },
    ]);
    expect(legs.length).toBe(0);
  });

  it("übernimmt die Transportart des Zielpunkts für Verbindungssymbole", () => {
    const legs = buildRouteLegs([
      { ...munich, ...base },
      { latitude: 48.3, longitude: 11.9, legMode: "train", legGeometry: null },
      { latitude: 48.6, longitude: 12.1, legMode: "cycle", legGeometry: null },
    ]);
    expect(legs.map((leg) => leg.mode)).toEqual(["train", "cycle"]);
  });
});

describe("boundsOf", () => {
  it("liefert null ohne gültige Punkte", () => {
    expect(boundsOf([])).toBeNull();
    expect(boundsOf([{ latitude: 200, longitude: 0 }])).toBeNull();
  });

  it("umschließt alle Punkte", () => {
    expect(boundsOf([munich, tokyo])).toEqual([11.575, 35.68, 139.77, 48.137]);
  });
});

describe("sortByArrival", () => {
  it("sortiert stabil und stellt Stationen ohne Datum ans Ende", () => {
    const items = [
      { id: "c", arrivalDate: null },
      { id: "a", arrivalDate: "2026-05-02" },
      { id: "b", arrivalDate: "2026-05-01" },
      { id: "d", arrivalDate: null },
      { id: "e", arrivalDate: "2026-05-01" },
    ];
    expect(sortByArrival(items).map((i) => i.id)).toEqual(["b", "e", "a", "c", "d"]);
  });
});

describe("simplifyLine", () => {
  it("reduziert lange Linien auf die Obergrenze", () => {
    const long = Array.from({ length: 5000 }, (_, i) => [
      10 + i * 0.001,
      48 + Math.sin(i / 40) * 0.01,
    ]);
    const simplified = simplifyLine(long, 500);
    expect(simplified.length).toBeLessThanOrEqual(500);
    expect(simplified.length).toBeGreaterThan(1);
    expect(simplified[0]).toEqual(long[0]);
  });

  it("lässt kurze Linien unverändert", () => {
    const short = [
      [10, 48],
      [11, 49],
    ];
    expect(simplifyLine(short)).toBe(short);
  });
});
