import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  emptyTrip,
  loadStudioTrips,
  removeTrip,
  upsertTrip,
  type StudioTrip,
} from "@/lib/studio-store";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Vagabond" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudioPage,
});

const SESSION_KEY = "vagabond.studio.session";
const DEMO_PASSWORD = "demo";

function StudioPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setAuthed(typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1");
    setChecking(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1 px-6 md:px-8 py-12 max-w-6xl mx-auto w-full">
        {checking ? null : authed ? (
          <StudioApp onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} />
        ) : (
          <Gate onUnlock={() => { sessionStorage.setItem(SESSION_KEY, "1"); setAuthed(true); }} />
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Gate({ onUnlock }: { onUnlock: () => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="max-w-md mx-auto py-24">
      <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">Studio · Restricted</p>
      <h1 className="font-display text-5xl uppercase tracking-tighter mb-8">Login</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === DEMO_PASSWORD) onUnlock();
          else setErr(true);
        }}
        className="space-y-4"
      >
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          placeholder="Passwort"
          className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3"
          autoFocus
        />
        {err && <p className="text-destructive text-sm font-mono">Falsches Passwort.</p>}
        <button className="w-full px-6 py-3 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 transition-colors">
          Entsperren →
        </button>
        <p className="text-xs text-muted-foreground pt-2">
          Demo-Passwort: <code className="font-mono text-primary">demo</code>. Daten werden nur lokal im Browser gespeichert (localStorage).
        </p>
      </form>
    </div>
  );
}

function StudioApp({ onLogout }: { onLogout: () => void }) {
  const [list, setList] = useState<StudioTrip[]>([]);
  const [editing, setEditing] = useState<StudioTrip | null>(null);

  useEffect(() => { setList(loadStudioTrips()); }, []);

  const refresh = () => setList(loadStudioTrips());

  return (
    <div>
      <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
        <div>
          <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-3">Studio</p>
          <h1 className="font-display text-4xl md:text-6xl uppercase tracking-tighter">Reisen verwalten</h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(emptyTrip())}
            className="px-4 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90"
          >
            + Neue Reise
          </button>
          <button onClick={onLogout} className="px-4 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary">
            Logout
          </button>
        </div>
      </div>

      {editing ? (
        <Editor
          trip={editing}
          onCancel={() => setEditing(null)}
          onSave={(t) => { upsertTrip(t); setEditing(null); refresh(); }}
        />
      ) : (
        <TripList
          list={list}
          onEdit={setEditing}
          onDelete={(slug) => { if (confirm("Wirklich löschen?")) { removeTrip(slug); refresh(); } }}
          onTogglePublish={(t) => { upsertTrip({ ...t, published: !t.published }); refresh(); }}
        />
      )}
    </div>
  );
}

function TripList({
  list, onEdit, onDelete, onTogglePublish,
}: {
  list: StudioTrip[];
  onEdit: (t: StudioTrip) => void;
  onDelete: (slug: string) => void;
  onTogglePublish: (t: StudioTrip) => void;
}) {
  return (
    <div className="border border-border">
      {list.map((t) => (
        <div key={t.slug} className="flex items-center gap-4 p-4 border-b border-border last:border-b-0 hover:bg-card/50 transition-colors">
          <div className="w-16 h-20 bg-card overflow-hidden flex-none">
            {t.cover && <img src={t.cover} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-primary">{t.monthLabel || "—"}</span>
              <span className={`font-mono text-[10px] uppercase tracking-widest px-1.5 py-0.5 ${t.published ? "bg-primary/20 text-primary" : "bg-foreground/10 text-muted-foreground"}`}>
                {t.published ? "online" : "entwurf"}
              </span>
            </div>
            <h3 className="font-display text-xl uppercase tracking-tight truncate">{t.title}</h3>
            <p className="text-sm text-muted-foreground truncate">{t.excerpt}</p>
          </div>
          <div className="flex gap-2 flex-none">
            {t.published && (
              <Link to="/stories/$slug" params={{ slug: t.slug }} className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary">
                Ansehen
              </Link>
            )}
            <button onClick={() => onTogglePublish(t)} className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary">
              {t.published ? "Offline" : "Online"}
            </button>
            <button onClick={() => onEdit(t)} className="px-3 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90">
              Bearbeiten
            </button>
            <button onClick={() => onDelete(t.slug)} className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-destructive hover:text-destructive">
              Löschen
            </button>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="p-8 text-center text-muted-foreground">Noch keine Reisen.</p>}
    </div>
  );
}

function Editor({ trip, onSave, onCancel }: { trip: StudioTrip; onSave: (t: StudioTrip) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<StudioTrip>(trip);
  const [gallery, setGallery] = useState<string[]>([]);

  const set = <K extends keyof StudioTrip>(k: K, v: StudioTrip[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const handleCover = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("cover", String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleGallery = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const r = new FileReader();
      r.onload = () => setGallery((g) => [...g, String(r.result)]);
      r.readAsDataURL(f);
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave(draft); }}
      className="grid lg:grid-cols-[1fr_320px] gap-8"
    >
      <div className="space-y-6">
        <Input label="Titel" value={draft.title} onChange={(v) => set("title", v)} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Slug (URL)" value={draft.slug} onChange={(v) => set("slug", v.replace(/[^a-z0-9-]/gi, "-").toLowerCase())} />
          <Input label="Monats-Label" value={draft.monthLabel} onChange={(v) => set("monthLabel", v.toUpperCase())} placeholder="MAI 2024" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Ort" value={draft.where} onChange={(v) => set("where", v)} />
          <Input label="Zeitraum" value={draft.when} onChange={(v) => set("when", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Begleitung" value={draft.who} onChange={(v) => set("who", v)} />
          <div>
            <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Region</label>
            <select
              value={draft.region}
              onChange={(e) => set("region", e.target.value as StudioTrip["region"])}
              className="w-full bg-background border border-border focus:border-primary p-3"
            >
              <option value="Europe">Europe</option>
              <option value="North America">North America</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Teaser</label>
          <textarea
            value={draft.excerpt}
            onChange={(e) => set("excerpt", e.target.value)}
            rows={2}
            className="w-full bg-background border border-border focus:border-primary p-3"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Reisebericht (Absätze mit Leerzeile trennen)</label>
          <textarea
            value={draft.body.join("\n\n")}
            onChange={(e) => set("body", e.target.value.split(/\n\s*\n/))}
            rows={12}
            className="w-full bg-background border border-border focus:border-primary p-3 font-mono text-sm"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="px-6 py-3 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90">
            Speichern
          </button>
          <button type="button" onClick={onCancel} className="px-6 py-3 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary hover:text-primary">
            Abbrechen
          </button>
          <label className="flex items-center gap-2 ml-auto font-mono text-[10px] uppercase tracking-widest cursor-pointer">
            <input type="checkbox" checked={draft.published} onChange={(e) => set("published", e.target.checked)} />
            Online stellen
          </label>
        </div>
      </div>

      <aside className="space-y-6">
        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Coverbild</label>
          <div className="aspect-[4/5] bg-card border border-border overflow-hidden mb-3">
            {draft.cover ? (
              <img src={draft.cover} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">Kein Bild</div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => handleCover(e.target.files?.[0])}
            className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:text-[10px] file:uppercase file:tracking-widest hover:file:bg-primary/90"
          />
        </div>

        <div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Galerie (lokal)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleGallery(e.target.files)}
            className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:text-[10px] file:uppercase file:tracking-widest hover:file:bg-primary/90"
          />
          {gallery.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              {gallery.map((g, i) => (
                <img key={i} src={g} alt="" className="aspect-square object-cover" />
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Demo: Galerie wird nicht mit der Reise gespeichert — nur Vorschau.</p>
        </div>
      </aside>
    </form>
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
        className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3"
      />
    </div>
  );
}
