import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StudioNav } from "./admin.studio.system";

export const Route = createFileRoute("/admin/studio/")({
  head: () => ({
    meta: [{ title: "Studio — Vagabond" }, { name: "robots", content: "noindex" }],
  }),
  component: StudioPage,
});

type StudioTrip = {
  id: string;
  slug: string;
  title: string;
  kicker: string | null;
  region: "Europe" | "North America";
  where: string;
  when: string;
  month_label: string;
  who: string;
  excerpt: string;
  body_md: string;
  published: boolean;
  cover_image_id: string | null;
  cover_webp_400: string | null;
  trip_start_date: string | null;
  trip_end_date: string | null;
};

function toApiPayload(trip: StudioTrip) {
  return {
    id: trip.id,
    slug: trip.slug,
    title: trip.title,
    kicker: trip.kicker ?? "",
    region: trip.region,
    where: trip.where,
    when: trip.when,
    monthLabel: trip.month_label,
    who: trip.who,
    excerpt: trip.excerpt,
    body: trip.body_md,
    published: trip.published,
    coverImageId: trip.cover_image_id,
    tripStartDate: trip.trip_start_date ? String(trip.trip_start_date).slice(0, 10) : null,
    tripEndDate: trip.trip_end_date ? String(trip.trip_end_date).slice(0, 10) : null,
  };
}

function StudioPage() {
  const [trips, setTrips] = useState<StudioTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/studio/trips", { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!res.ok) throw new Error("Failed to load trips");
        const data = await res.json();
        setTrips(data.trips);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [navigate]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    await navigate({ to: "/admin/login" });
  };

  const togglePublish = async (trip: StudioTrip) => {
    const next = { ...toApiPayload(trip), published: !trip.published };
    const res = await fetch("/api/studio/trips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
      credentials: "same-origin",
    });
    if (!res.ok) {
      alert("Speichern fehlgeschlagen");
      return;
    }
    setTrips((list) =>
      list.map((t) => (t.id === trip.id ? { ...trip, published: !trip.published } : t)),
    );
  };

  const deleteTrip = async (trip: StudioTrip) => {
    if (!confirm(`Reise "${trip.title}" wirklich löschen?`)) return;
    const res = await fetch(`/api/studio/trips?id=${trip.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      alert("Löschen fehlgeschlagen");
      return;
    }
    setTrips((list) => list.filter((t) => t.id !== trip.id));
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-3">Studio</p>
            <h1 className="font-display text-4xl md:text-6xl tracking-tight font-light">
              Reisen verwalten
            </h1>
          </div>
          <div className="flex gap-3">
            <Link
              to="/admin/studio/$slug"
              params={{ slug: "new" }}
              className="px-4 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90"
            >
              + Neue Reise
            </Link>
            <button
              onClick={logout}
              className="px-4 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary"
            >
              Logout
            </button>
          </div>
        </div>

        {loading && <p className="font-mono text-muted-foreground">Laden …</p>}
        {error && <p className="text-destructive font-mono">{error}</p>}

        {!loading && !error && (
          <div className="border border-border">
            {trips.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-card/50 transition-colors"
              >
                <div className="w-16 h-20 bg-card overflow-hidden flex-none">
                  {t.cover_webp_400 && (
                    <img src={t.cover_webp_400} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-primary">
                      {t.month_label || "—"}
                    </span>
                    <span
                      className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${t.published ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}
                    >
                      {t.published ? "online" : "entwurf"}
                    </span>
                  </div>
                  <h3 className="font-display text-xl tracking-tight font-medium truncate">
                    {t.title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">{t.excerpt}</p>
                </div>
                <div className="flex gap-2 flex-none">
                  {t.published && (
                    <Link
                      to="/stories/$slug"
                      params={{ slug: t.slug }}
                      className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary"
                    >
                      Ansehen
                    </Link>
                  )}
                  <button
                    onClick={() => togglePublish(t)}
                    className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary"
                  >
                    {t.published ? "Offline" : "Online"}
                  </button>
                  <Link
                    to="/admin/studio/$slug"
                    params={{ slug: t.slug }}
                    className="px-3 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90"
                  >
                    Bearbeiten
                  </Link>
                  <button
                    onClick={() => deleteTrip(t)}
                    className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-destructive hover:text-destructive"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))}
            {trips.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">Noch keine Reisen.</p>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
