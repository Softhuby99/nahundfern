import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/admin/studio/$slug")({
  head: () => ({
    meta: [
      { title: "Reise-Editor — Vagabond" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditorPage,
});

type StudioTrip = {
  id?: string;
  slug: string;
  title: string;
  kicker: string;
  region: "Europe" | "North America";
  where: string;
  when: string;
  monthLabel: string;
  who: string;
  excerpt: string;
  body: string;
  published: boolean;
  coverImageId?: string | null;
  cover_webp_400?: string | null;
  tripStartDate: string;
  tripEndDate: string;
  countryCode: string;
  city: string;
  latitude: string;
  longitude: string;
  travelType: string;
  featured: boolean;
};

type StudioImage = {
  id: string;
  original_path: string;
  webp_400: string;
  avif_400: string;
  alt: string | null;
  sort_order: number;
};

function emptyTrip(): StudioTrip {
  return {
    slug: `new-${Date.now()}`,
    title: "",
    kicker: "",
    region: "Europe",
    where: "",
    when: "",
    monthLabel: "",
    who: "Solo",
    excerpt: "",
    body: "",
    published: false,
    coverImageId: null,
    tripStartDate: "",
    tripEndDate: "",
    countryCode: "",
    city: "",
    latitude: "",
    longitude: "",
    travelType: "",
    featured: false,
  };
}

function EditorPage() {
  const { slug } = Route.useParams();
  const isNew = slug === "new";
  const navigate = useNavigate();
  const [trip, setTrip] = useState<StudioTrip>(emptyTrip());
  const [images, setImages] = useState<StudioImage[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNew) return;
    fetch(`/api/studio/trips?slug=${encodeURIComponent(slug)}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (res.status === 401) {
          await navigate({ to: "/admin/login" });
          return;
        }
        if (!res.ok) throw new Error("Failed to load trip");
        const data = await res.json();
        const found = data.trip;
        if (!found) throw new Error("Trip not found");
        setTrip({
          ...found,
          body: found.body_md,
          tripStartDate: found.trip_start_date ? String(found.trip_start_date).slice(0, 10) : "",
          tripEndDate: found.trip_end_date ? String(found.trip_end_date).slice(0, 10) : "",
          countryCode: found.country_code ?? "",
          city: found.city ?? "",
          latitude: found.latitude !== null && found.latitude !== undefined ? String(found.latitude) : "",
          longitude: found.longitude !== null && found.longitude !== undefined ? String(found.longitude) : "",
          travelType: found.travel_type ?? "",
          featured: Boolean(found.featured),
        });
        return found.id;
      })
      .then((id) => {
        if (!id) return;
        return fetch(`/api/studio/images?tripId=${id}`, { credentials: "same-origin" })
          .then((res) => res.json())
          .then((data) => setImages(data.images));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, isNew, navigate]);

  const setField = <K extends keyof StudioTrip>(k: K, v: StudioTrip[K]) => setTrip((t) => ({ ...t, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...trip,
        body: trip.body,
        tripStartDate: trip.tripStartDate ? trip.tripStartDate : null,
        tripEndDate: trip.tripEndDate ? trip.tripEndDate : null,
        countryCode: trip.countryCode ? trip.countryCode.toUpperCase().slice(0, 2) : null,
        city: trip.city || null,
        latitude: trip.latitude === "" ? null : Number(trip.latitude),
        longitude: trip.longitude === "" ? null : Number(trip.longitude),
        travelType: trip.travelType || null,
        featured: trip.featured,
      };
      const method = isNew ? "POST" : "PATCH";
      const res = await fetch("/api/studio/trips", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      if (res.status === 401) {
        await navigate({ to: "/admin/login" });
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Speichern fehlgeschlagen");
      }
      const data = await res.json();
      await navigate({ to: "/admin/studio" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadCover = async (file: File) => {
    if (!trip.id) {
      setError("Speichere die Reise zuerst, bevor du Bilder hochlädst.");
      return;
    }
    const form = new FormData();
    form.append("tripId", trip.id);
    form.append("file", file);
    const res = await fetch("/api/studio/images", { method: "POST", body: form, credentials: "same-origin" });
    if (!res.ok) {
      setError("Cover-Upload fehlgeschlagen");
      return;
    }
    const data = await res.json();
    setTrip((t) => ({ ...t, coverImageId: data.image.id, cover_webp_400: data.image.webp_400 }));
  };

  const uploadGallery = async (file: File) => {
    if (!trip.id) {
      setError("Speichere die Reise zuerst, bevor du Bilder hochlädst.");
      return;
    }
    const form = new FormData();
    form.append("tripId", trip.id);
    form.append("file", file);
    const res = await fetch("/api/studio/images", { method: "POST", body: form, credentials: "same-origin" });
    if (!res.ok) {
      setError("Upload fehlgeschlagen");
      return;
    }
    const data = await res.json();
    setImages((list) => [...list, data.image]);
  };

  const deleteImage = async (id: string) => {
    const res = await fetch(`/api/studio/images?id=${id}`, { method: "DELETE", credentials: "same-origin" });
    if (!res.ok) {
      setError("Löschen fehlgeschlagen");
      return;
    }
    setImages((list) => list.filter((i) => i.id !== id));
    if (trip.coverImageId === id) {
      setTrip((t) => ({ ...t, coverImageId: null, cover_webp_400: null }));
    }
  };

  const setCover = (id: string) => {
    setTrip((t) => ({ ...t, coverImageId: id }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="px-6 md:px-8 py-12 max-w-6xl mx-auto">
          <p className="font-mono text-muted-foreground">Laden …</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <p className="font-mono text-primary text-xs uppercase tracking-[0.3em]">Studio · {isNew ? "Neue Reise" : "Bearbeiten"}</p>
          <Link to="/admin/studio" className="font-mono text-[10px] uppercase tracking-widest hover:text-primary">← Zurück</Link>
        </div>

        {error && <p className="text-destructive font-mono mb-6">{error}</p>}

        <div className="grid lg:grid-cols-[1fr_320px] gap-8">
          <div className="space-y-6">
            <Input label="Titel" value={trip.title} onChange={(v) => setField("title", v)} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Slug (URL)" value={trip.slug} onChange={(v) => setField("slug", v.replace(/[^a-z0-9-]/gi, "-").toLowerCase())} />
              <Input label="Monats-Label" value={trip.monthLabel} onChange={(v) => setField("monthLabel", v.toUpperCase())} placeholder="MAI 2024" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Ort" value={trip.where} onChange={(v) => setField("where", v)} />
              <Input label="Zeitraum (Text)" value={trip.when} onChange={(v) => setField("when", v)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Startdatum</label>
                <input
                  type="date"
                  value={trip.tripStartDate}
                  onChange={(e) => setField("tripStartDate", e.target.value)}
                  className="w-full bg-card border border-border focus:border-primary p-3 rounded-sm"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Enddatum</label>
                <input
                  type="date"
                  value={trip.tripEndDate}
                  onChange={(e) => setField("tripEndDate", e.target.value)}
                  className="w-full bg-card border border-border focus:border-primary p-3 rounded-sm"
                />
              </div>
            </div>

            {/* Optional structured metadata for later filters, maps, statistics. */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Länder-Code (ISO 3166, z. B. DE, BE)"
                value={trip.countryCode}
                onChange={(v) => setField("countryCode", v.toUpperCase().slice(0, 2))}
                placeholder="DE"
              />
              <Input label="Stadt / Region" value={trip.city} onChange={(v) => setField("city", v)} placeholder="Brüssel" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Breite (Lat)" value={trip.latitude} onChange={(v) => setField("latitude", v)} placeholder="50.8503" />
              <Input label="Länge (Lng)" value={trip.longitude} onChange={(v) => setField("longitude", v)} placeholder="4.3517" />
              <Input label="Reisetyp" value={trip.travelType} onChange={(v) => setField("travelType", v)} placeholder="Städtereise" />
            </div>
            <div className="flex items-center gap-3">
              <input id="featured" type="checkbox" checked={trip.featured} onChange={(e) => setField("featured", e.target.checked)} />
              <label htmlFor="featured" className="font-mono text-[10px] uppercase tracking-widest cursor-pointer">Als Highlight markieren</label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Begleitung" value={trip.who} onChange={(v) => setField("who", v)} />
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Region</label>
                <select
                  value={trip.region}
                  onChange={(e) => setField("region", e.target.value as StudioTrip["region"])}
                  className="w-full bg-card border border-border focus:border-primary p-3 rounded-sm"
                >
                  <option value="Europe">Europe</option>
                  <option value="North America">North America</option>
                </select>
              </div>
            </div>
            <Input label="Kicker / Untertitel" value={trip.kicker} onChange={(v) => setField("kicker", v)} />

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Teaser</label>
              <textarea
                value={trip.excerpt}
                onChange={(e) => setField("excerpt", e.target.value)}
                rows={3}
                className="w-full bg-card border border-border focus:border-primary p-3 rounded-sm"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Reisebericht (Absätze mit Leerzeile trennen)</label>
              <textarea
                value={trip.body}
                onChange={(e) => setField("body", e.target.value)}
                rows={16}
                className="w-full bg-card border border-border focus:border-primary p-3 font-mono text-sm rounded-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <input id="published" type="checkbox" checked={trip.published} onChange={(e) => setField("published", e.target.checked)} />
              <label htmlFor="published" className="font-mono text-[10px] uppercase tracking-widest cursor-pointer">Online stellen</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={save} disabled={saving} className="px-6 py-3 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 disabled:opacity-50 rounded-sm">
                {saving ? "…" : "Speichern"}
              </button>
              <Link to="/admin/studio" className="px-6 py-3 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary rounded-sm">
                Abbrechen
              </Link>
            </div>
          </div>

          <aside className="space-y-6">
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Coverbild</label>
              <div className="aspect-[4/5] bg-card border border-border overflow-hidden mb-3">
                {trip.cover_webp_400 ? (
                  <img src={trip.cover_webp_400} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Kein Bild</div>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                }}
                className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:text-[10px] file:uppercase file:tracking-widest hover:file:bg-primary/90"
              />
            </div>

            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Galerie</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  Array.from(e.target.files ?? []).forEach(uploadGallery);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:text-[10px] file:uppercase file:tracking-widest hover:file:bg-primary/90"
              />
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {images.map((img) => (
                    <div key={img.id} className={`relative group aspect-square border ${trip.coverImageId === img.id ? "border-primary" : "border-border"}`}>
                      <img src={img.webp_400} alt={img.alt ?? ""} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 items-center justify-center">
                        <button onClick={() => setCover(img.id)} className="text-[10px] font-mono uppercase hover:text-primary">Cover</button>
                        <button onClick={() => deleteImage(img.id)} className="text-[10px] font-mono uppercase text-destructive">Löschen</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-card border border-border focus:border-primary focus:outline-none p-3 rounded-sm"
      />
    </div>
  );
}
