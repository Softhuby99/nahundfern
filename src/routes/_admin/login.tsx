import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/_admin/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Vagabond" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError("Login fehlgeschlagen.");
        return;
      }
      await navigate({ to: "/_admin/studio" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-md mx-auto w-full">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">Admin</p>
        <h1 className="font-display text-5xl uppercase tracking-tighter mb-8">Login</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3"
            />
          </div>
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3"
            />
          </div>
          {error && <p className="text-destructive text-sm font-mono">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "…" : "Login →"}
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary">← Zurück zur Startseite</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
