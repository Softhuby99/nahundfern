import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudioNav } from "./admin.studio.system";

export const Route = createFileRoute("/admin/studio/users")({
  head: () => ({
    meta: [{ title: "User — Studio" }, { name: "robots", content: "noindex" }],
  }),
  component: UsersPage,
});

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_login_at: string | null;
  last_login_ip: string | null;
};

function UsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const load = () => {
    fetch("/api/studio/users", { credentials: "same-origin" })
      .then(async (r) => {
        if (r.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!r.ok) throw new Error("Fehler beim Laden");
        const d = await r.json();
        setUsers(d.users);
        setError("");
      })
      .catch((e) => setError(e.message));
  };
  useEffect(load, [navigate]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/studio/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email: newEmail, password: newPassword }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Anlegen fehlgeschlagen");
      return;
    }
    setNewEmail("");
    setNewPassword("");
    load();
  };

  const setPassword = async (u: UserRow) => {
    const pw = prompt(`Neues Passwort für ${u.email} (mind. 12 Zeichen, Buchstaben+Ziffern):`);
    if (!pw) return;
    const res = await fetch("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: u.id, password: pw }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Passwort setzen fehlgeschlagen");
    } else {
      alert("Passwort gesetzt.");
    }
  };

  const rename = async (u: UserRow) => {
    const email = prompt(`Neue E-Mail für ${u.email}:`, u.email);
    if (!email || email === u.email) return;
    const res = await fetch("/api/studio/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ id: u.id, email }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Umbenennen fehlgeschlagen");
      return;
    }
    load();
  };

  const del = async (u: UserRow) => {
    if (!confirm(`User ${u.email} wirklich löschen?`)) return;
    const res = await fetch(`/api/studio/users?id=${u.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Löschen fehlgeschlagen");
      return;
    }
    load();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <StudioNav active="users" />
        <h1 className="font-display text-4xl md:text-5xl tracking-tight font-light mb-8">
          User verwalten
        </h1>

        <form onSubmit={create} className="border border-border p-6 mb-8 grid gap-3 md:grid-cols-3">
          <input
            type="email"
            required
            placeholder="E-Mail"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="bg-background border border-border px-3 py-2 font-mono text-sm"
          />
          <input
            type="password"
            required
            minLength={12}
            placeholder="Passwort (mind. 12)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="bg-background border border-border px-3 py-2 font-mono text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase disabled:opacity-50"
          >
            + User anlegen
          </button>
        </form>

        {error && <p className="text-destructive font-mono mb-4">{error}</p>}

        <div className="border border-border">
          {users.map((u) => (
            <div
              key={u.id}
              className="p-4 border-b border-border last:border-b-0 flex items-center gap-4 flex-wrap"
            >
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm truncate">{u.email}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  angelegt: {new Date(u.created_at).toLocaleString("de-DE")}
                  {" · "}
                  letzter Login:{" "}
                  {u.last_login_at
                    ? new Date(u.last_login_at).toLocaleString("de-DE")
                    : "nie"}
                  {u.last_login_ip ? ` (${u.last_login_ip})` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => rename(u)}
                  className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary"
                >
                  Umbenennen
                </button>
                <button
                  onClick={() => setPassword(u)}
                  className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary"
                >
                  Passwort
                </button>
                <button
                  onClick={() => del(u)}
                  className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-destructive hover:text-destructive"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">Keine User.</p>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
