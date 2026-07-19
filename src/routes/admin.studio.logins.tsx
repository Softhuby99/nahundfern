import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudioNav } from "./admin.studio.system";

export const Route = createFileRoute("/admin/studio/logins")({
  head: () => ({
    meta: [{ title: "Anmeldungen — Studio" }, { name: "robots", content: "noindex" }],
  }),
  component: LoginsPage,
});

type Entry = {
  id: string;
  action: string;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  email_hash: string | null;
  created_at: string;
};

function LoginsPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // Show successes + failures side-by-side — combined view is more useful
    // than filtering, since brute-force attempts stand out visually.
    fetch("/api/studio/audit?actionPrefix=auth.login&limit=200", {
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (r.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!r.ok) throw new Error("Fehler beim Laden");
        const d = await r.json();
        setEntries(d.entries);
      })
      .catch((e) => setError(e.message));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <StudioNav active="logins" />
        <h1 className="font-display text-4xl md:text-5xl tracking-tight font-light mb-8">
          Anmeldungen
        </h1>
        {error && <p className="text-destructive font-mono mb-4">{error}</p>}
        <div className="border border-border overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead className="text-left border-b border-border">
              <tr>
                <th className="p-2">Zeit</th>
                <th className="p-2">Status</th>
                <th className="p-2">User-ID</th>
                <th className="p-2">IP</th>
                <th className="p-2">User-Agent</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const ok = e.action === "auth.login.success";
                return (
                  <tr key={e.id} className="border-b border-border/50 hover:bg-card/50">
                    <td className="p-2 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString("de-DE")}
                    </td>
                    <td className={`p-2 ${ok ? "text-primary" : "text-destructive"}`}>
                      {ok ? "OK" : "FEHL"}
                    </td>
                    <td className="p-2 truncate max-w-[12rem]">{e.user_id ?? "—"}</td>
                    <td className="p-2">{e.ip ?? "—"}</td>
                    <td className="p-2 truncate max-w-[24rem]">{e.user_agent ?? "—"}</td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">
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
