// Gemeinsame Hilfen für Stationstexte: Auspacken, Vergleichen, Fassungen sichern.
import type { TransactionSql } from "postgres";

export type DayEntry = { date: string; bodyMd: string };

/** Packt mehrfach als Text kodierte Tageseinträge aus und liefert eine saubere Liste. */
export function normalizeDayEntries(value: unknown): DayEntry[] {
  let raw = value;
  for (let i = 0; i < 5 && typeof raw === "string"; i++) {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((d) => d && typeof d === "object" && typeof (d as DayEntry).date === "string")
    .map((d) => ({
      date: String((d as DayEntry).date).slice(0, 10),
      bodyMd: String((d as DayEntry).bodyMd ?? ""),
    }));
}

/** Stabiler Vergleichsschlüssel für Text + Tagestexte. */
export function textFingerprint(bodyMd: unknown, dayEntries: unknown): string {
  const days = normalizeDayEntries(dayEntries)
    .filter((d) => d.bodyMd.trim().length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  return JSON.stringify([String(bodyMd ?? ""), days]);
}

type StationTextRow = {
  id: string;
  trip_id: string;
  name: string;
  body_md: string | null;
  day_entries: unknown;
  daily_enabled: boolean | null;
};

/** Legt die aktuelle Fassung ab, bevor sie überschrieben wird. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveStationVersion(tx: TransactionSql<any>, row: StationTextRow, userId: string | null) {
  await tx`
    INSERT INTO trip_station_versions
      (station_id, trip_id, name, body_md, day_entries, daily_enabled, user_id)
    VALUES (
      ${row.id}, ${row.trip_id}, ${row.name}, ${row.body_md ?? ""},
      ${JSON.stringify(normalizeDayEntries(row.day_entries))}::jsonb,
      ${Boolean(row.daily_enabled)}, ${userId}
    )
  `;
}
