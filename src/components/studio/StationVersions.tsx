// Liste früherer Textfassungen einer Station mit Wiederherstellen.
import { useEffect, useState } from "react";

type Version = { id: string; name: string; createdAt: string; days: number; chars: number };

export function StationVersions({
  stationId,
  refreshKey,
  hasUnsavedChanges,
  onRestored,
}: {
  stationId: string;
  refreshKey: unknown;
  hasUnsavedChanges: boolean;
  onRestored: (station: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch(`/api/studio/station-versions?stationId=${stationId}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { versions: Version[] }) => !cancelled && setVersions(d.versions))
      .catch(() => !cancelled && setMessage("Frühere Fassungen konnten nicht geladen werden."));
    return () => {
      cancelled = true;
    };
  }, [open, stationId, refreshKey]);

  async function restore(v: Version) {
    if (hasUnsavedChanges) {
      setMessage("Bitte zuerst speichern oder die ungespeicherten Änderungen verwerfen.");
      return;
    }
    if (!window.confirm(`Fassung vom ${formatDate(v.createdAt)} wiederherstellen? Der jetzige Stand wird vorher ebenfalls gesichert.`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/studio/station-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ versionId: v.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Wiederherstellen fehlgeschlagen");
      onRestored(data.station);
      setMessage("Fassung wiederhergestellt.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="station-versions" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>Frühere Fassungen</summary>
      {message && <p className="station-hint">{message}</p>}
      {versions === null && open && !message && <p className="station-hint">Lade …</p>}
      {versions?.length === 0 && (
        <p className="station-hint">Noch keine früheren Fassungen — sie entstehen ab jetzt bei jedem Speichern.</p>
      )}
      {versions && versions.length > 0 && (
        <ul>
          {versions.map((v) => (
            <li key={v.id}>
              {formatDate(v.createdAt)} · {v.name} · {v.days} Tage · {v.chars} Zeichen{" "}
              <button type="button" disabled={busy} onClick={() => void restore(v)}>
                Wiederherstellen
              </button>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}
