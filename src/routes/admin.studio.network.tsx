import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudioNav } from "./admin.studio.system";

export const Route = createFileRoute("/admin/studio/network")({
  head: () => ({
    meta: [{ title: "Netzwerk — Studio" }, { name: "robots", content: "noindex" }],
  }),
  component: NetworkPage,
});

type Entry = {
  id?: number;
  run_id?: string;
  hostname: string;
  scope: "internal" | "external";
  dns_server: string;
  dns_ips: string[];
  dns_error: string | null;
  dns_ms: number | null;
  http_target: string | null;
  http_status: number | null;
  http_ms: number | null;
  http_error: string | null;
  tls_ok: boolean | null;
  tls_error: string | null;
  created_at?: string;
};

function ok(e: Entry) {
  return e.dns_ips.length > 0 && e.http_status !== null && e.http_status < 500;
}

function NetworkPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [internalDns, setInternalDns] = useState("");
  const [externalDns, setExternalDns] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/studio/network", { credentials: "same-origin" });
    if (r.status === 401) return navigate({ to: "/admin/login" });
    if (!r.ok) return setError("Fehler beim Laden");
    const j = await r.json();
    setEntries(j.entries);
    setInternalDns((v) => v || j.defaults.internalDns);
    setExternalDns((v) => v || j.defaults.externalDns);
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  async function runNow() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/studio/network", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalDns, externalDns }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Prüfung fehlgeschlagen");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setAnalysis("");
    try {
      const r = await fetch("/api/studio/network-diagnose", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Analyse fehlgeschlagen");
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnalysis((a) => a + dec.decode(value, { stream: true }));
      }
    } catch (e) {
      setAnalysis(`Fehler: ${(e as Error).message}`);
    } finally {
      setAnalyzing(false);
    }
  }

  const latestRun = entries[0]?.run_id;
  const latest = entries.filter((e) => e.run_id === latestRun);
  const hosts = Array.from(new Set(latest.map((e) => e.hostname)));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <StudioNav active="network" />
        <h1 className="font-display text-4xl md:text-5xl tracking-tight font-light mb-8">
          Netzwerk
        </h1>

        <div className="border border-border p-6 mb-8 flex flex-wrap gap-4 items-end">
          <label className="text-sm">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Interner DNS
            </span>
            <input
              className="border border-border bg-background px-3 py-2 font-mono text-sm"
              value={internalDns}
              onChange={(e) => setInternalDns(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              Externer DNS
            </span>
            <input
              className="border border-border bg-background px-3 py-2 font-mono text-sm"
              value={externalDns}
              onChange={(e) => setExternalDns(e.target.value)}
            />
          </label>
          <button
            onClick={runNow}
            disabled={busy}
            className="bg-primary text-primary-foreground px-4 py-2 font-mono text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {busy ? "Prüfe …" : "Jetzt prüfen"}
          </button>
          {error && <p className="text-destructive font-mono text-sm w-full">{error}</p>}
          <p className="text-xs text-muted-foreground w-full">
            Messung erfolgt vom Webserver aus. Intern = Abfrage über den internen DNS, extern =
            über den öffentlichen DNS; anschließend HTTPS-Aufruf der aufgelösten IP.
          </p>
        </div>

        {hosts.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {hosts.map((h) => (
              <div key={h} className="border border-border p-6">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
                  {h}
                </h2>
                {latest
                  .filter((e) => e.hostname === h)
                  .sort((a) => (a.scope === "internal" ? -1 : 1))
                  .map((e) => (
                    <div key={e.scope} className="mb-4 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {e.scope === "internal" ? "Intern" : "Extern"}
                        </span>
                        <span className={ok(e) ? "text-primary" : "text-destructive"}>
                          {ok(e) ? "OK" : "Fehler"}
                        </span>
                      </div>
                      <KV
                        label={`DNS @${e.dns_server}`}
                        value={e.dns_error ?? `${e.dns_ips.join(", ")} (${e.dns_ms} ms)`}
                      />
                      <KV
                        label="HTTP"
                        value={
                          e.http_error ??
                          `${e.http_status} (${e.http_ms} ms)${e.tls_ok === false ? " · TLS ungültig" : ""}`
                        }
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>
        )}

        <section className="border border-border p-6 mb-10">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
            KI-Diagnose
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            nslookup-, curl-Ausgaben oder Fehlermeldungen einfügen. Die letzte Messung wird
            automatisch mitgeschickt. Keine Passwörter einfügen.
          </p>
          <textarea
            className="w-full min-h-40 border border-border bg-background p-3 font-mono text-xs"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={"C:\\> nslookup tdh.servuswir.de\nServer: fw ..."}
          />
          <button
            onClick={analyze}
            disabled={analyzing}
            className="mt-3 bg-primary text-primary-foreground px-4 py-2 font-mono text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {analyzing ? "Analysiere …" : "Ursache ermitteln"}
          </button>
          {analysis && (
            <pre className="mt-4 whitespace-pre-wrap text-sm font-sans border-t border-border pt-4">
              {analysis}
            </pre>
          )}
        </section>

        <h2 className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">
          Verlauf
        </h2>
        <div className="overflow-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-muted-foreground text-left">
              <tr>
                <th className="py-1 pr-3">Zeit</th>
                <th className="pr-3">Host</th>
                <th className="pr-3">Sicht</th>
                <th className="pr-3">DNS</th>
                <th className="pr-3">HTTP</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-muted-foreground">
                    Noch keine Prüfungen.
                  </td>
                </tr>
              )}
              {entries.map((e) => (
                <tr key={e.id} className={`border-t border-border ${ok(e) ? "" : "text-destructive"}`}>
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {e.created_at ? new Date(e.created_at).toLocaleString("de-DE") : ""}
                  </td>
                  <td className="pr-3">{e.hostname}</td>
                  <td className="pr-3">{e.scope === "internal" ? "intern" : "extern"}</td>
                  <td className="pr-3">{e.dns_error ?? e.dns_ips.join(", ")}</td>
                  <td className="pr-3">{e.http_error ?? `${e.http_status} · ${e.http_ms} ms`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-right break-all">{value}</span>
    </div>
  );
}
