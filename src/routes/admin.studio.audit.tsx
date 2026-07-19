import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudioNav } from "./admin.studio.system";

export const Route = createFileRoute("/admin/studio/audit")({
  head: () => ({
    meta: [{ title: "Audit — Studio" }, { name: "robots", content: "noindex" }],
  }),
  component: AuditPage,
});

type Entry = {
  id: string;
  request_id: string | null;
  user_id: string | null;
  action: string;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  email_hash: string | null;
  meta: unknown;
  created_at: string;
};

function AuditPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [action, setAction] = useState("");
  const [requestId, setRequestId] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (requestId) params.set("requestId", requestId);
    params.set("limit", "100");
    fetch(`/api/studio/audit?${params.toString()}`, { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!r.ok) throw new Error("Fehler beim Laden");
        const d = await r.json();
        setEntries(d.entries);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [navigate, action, requestId]);

  useEffect(load, [load]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <StudioNav active="audit" />
        <h1 className="font-display text-4xl md:text-5xl tracking-tight font-light mb-8">Audit</h1>
        <div className="flex gap-3 mb-6 flex-wrap">
          <input
            placeholder="Aktion (z. B. trip.update)"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-background border border-border px-3 py-2 font-mono text-sm"
          />
          <input
            placeholder="Request-ID"
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            className="bg-background border border-border px-3 py-2 font-mono text-sm"
          />
          <button
            onClick={load}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase"
          >
            Filtern
          </button>
        </div>
        {error && <p className="text-destructive font-mono mb-4">{error}</p>}
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-left border-b border-border">
              <tr>
                <th className="p-2">Zeit</th>
                <th className="p-2">Action</th>
                <th className="p-2">User</th>
                <th className="p-2">Target</th>
                <th className="p-2">IP</th>
                <th className="p-2">Request-ID</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-card/50">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("de-DE")}
                  </td>
                  <td className="p-2">{e.action}</td>
                  <td className="p-2 truncate max-w-[10rem]">{e.user_id ?? "—"}</td>
                  <td className="p-2 truncate max-w-[10rem]">{e.target_id ?? "—"}</td>
                  <td className="p-2">{e.ip ?? "—"}</td>
                  <td className="p-2 truncate max-w-[12rem]">{e.request_id ?? "—"}</td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Keine Einträge.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
