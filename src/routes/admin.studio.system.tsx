import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/admin/studio/system")({
  head: () => ({
    meta: [{ title: "System — Studio" }, { name: "robots", content: "noindex" }],
  }),
  component: SystemPage,
});

type Status = {
  app: { version: string; nodeVersion: string; uptimeSeconds: number; env: string };
  db: { bytes: number; startedAt: string; counts: Record<string, number> };
  uploads: { totalBytes: number; byDir: Record<string, number> };
  backups: {
    present: boolean;
    files: { name: string; kind: string; bytes: number; mtime: string; ok: boolean }[];
    dir: string;
    keepDays: string;
    schedule: string;
  };
};

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3));
  return `${(n / 1000 ** i).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function SystemPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => {
      fetch("/api/studio/system-status", { credentials: "same-origin" })
        .then(async (r) => {
          if (r.status === 401) {
            await navigate({ to: "/admin/login" });
            return;
          }
          if (!r.ok) throw new Error("Fehler beim Laden");
          setStatus(await r.json());
          setError("");
        })
        .catch((e) => setError(e.message));
    };
    load();
    // Auto-refresh every 30s while the tab is open. Backend caches FS scans.
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <StudioNav active="system" />
        <h1 className="font-display text-4xl md:text-5xl tracking-tight font-light mb-8">System</h1>
        {error && <p className="text-destructive font-mono">{error}</p>}
        {!status && !error && <p className="font-mono text-muted-foreground">Laden …</p>}
        {status && (
          <div className="grid md:grid-cols-2 gap-6">
            <Card title="App">
              <KV label="Version" value={status.app.version} />
              <KV label="Node" value={status.app.nodeVersion} />
              <KV label="Env" value={status.app.env} />
              <KV label="Uptime" value={fmtUptime(status.app.uptimeSeconds)} />
            </Card>
            <Card title="Datenbank">
              <KV label="Größe" value={fmtBytes(status.db.bytes)} />
              <KV
                label="Postgres seit"
                value={new Date(status.db.startedAt).toLocaleString("de-DE")}
              />
              {Object.entries(status.db.counts).map(([k, v]) => (
                <KV key={k} label={k} value={String(v)} />
              ))}
            </Card>
            <Card title="Uploads">
              <KV label="Gesamt" value={fmtBytes(status.uploads.totalBytes)} />
              {Object.entries(status.uploads.byDir).map(([k, v]) => (
                <KV key={k} label={k} value={fmtBytes(v)} />
              ))}
            </Card>
            <Card title="Backups">
              <KV label="Verzeichnis" value={status.backups.dir} />
              <KV label="Aufbewahrung" value={`${status.backups.keepDays} Tage`} />
              <KV label="Plan" value={status.backups.schedule} />
              <div className="mt-3 space-y-1 text-xs font-mono max-h-48 overflow-auto">
                {status.backups.files.length === 0 && (
                  <p className="text-muted-foreground">Noch keine Backups.</p>
                )}
                {status.backups.files.map((f) => (
                  <div
                    key={f.name}
                    className={`flex justify-between ${f.ok ? "" : "text-destructive"}`}
                    title={f.ok ? "" : "Datei verdächtig klein — bitte prüfen"}
                  >
                    <span className="truncate mr-2">{f.name}</span>
                    <span>{fmtBytes(f.bytes)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border p-6">
      <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function StudioNav({ active }: { active: string }) {
  const items: { to: string; key: string; label: string }[] = [
    { to: "/admin/studio", key: "trips", label: "Reisen" },
    { to: "/admin/studio/system", key: "system", label: "System" },
    { to: "/admin/studio/users", key: "users", label: "User" },
    { to: "/admin/studio/audit", key: "audit", label: "Audit" },
    { to: "/admin/studio/logins", key: "logins", label: "Logins" },
  ];
  return (
    <nav className="mb-8 flex gap-4 flex-wrap font-mono text-[10px] uppercase tracking-widest">
      {items.map((it) => (
        <Link
          key={it.key}
          to={it.to}
          className={`pb-1 border-b ${it.key === active ? "text-primary border-primary" : "text-muted-foreground border-transparent hover:text-primary"}`}
        >
          {it.label}
        </Link>
      ))}
    </nav>
  );
}
