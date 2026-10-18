import { describe, expect, it } from "vitest";
import { pickFarthestStation } from "./map-destination";

const korsika = [
  ["Bruckmühl", 47.882833, 11.914614],
  ["Livorno", 43.556991, 10.147409],
  ["Bastia", 42.697461, 9.449771],
  ["L'Île-Rousse", 42.634764, 8.938817],
  ["Calvi", 42.567664, 8.75887],
  ["Santa Gulia", 41.53477, 9.268294],
  ["Bastia", 42.697461, 9.449771],
  ["Livorno", 43.519252, 10.282475],
  ["Bruckmühl", 47.882833, 11.914614],
].map(([name, latitude, longitude], sortOrder) => ({
  name: name as string,
  latitude: latitude as number,
  longitude: longitude as number,
  sortOrder,
}));

describe("pickFarthestStation", () => {
  it("wählt bei der Korsika-Rundreise Santa Giulia", () => {
    expect(pickFarthestStation(korsika)?.name).toBe("Santa Gulia");
  });
  it("hängt nicht von der Reihenfolge im Array ab", () => {
    expect(pickFarthestStation([...korsika].reverse())?.name).toBe("Santa Gulia");
  });
});
