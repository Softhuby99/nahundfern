import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";
import { Heart, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/journal")({
  loader: async () => {
    const trips = await listPublishedTrips();
    return { trips };
  },
  head: () => ({
    meta: [
      { title: "Mein Reisetagebuch — Reisejournal" },
      { name: "description", content: "Gedanken, Momente und kleine Geschichten von unterwegs." },
      { property: "og:title", content: "Mein Reisetagebuch — Reisejournal" },
      { property: "og:description", content: "Gedanken, Momente und kleine Geschichten von unterwegs." },
    ],
  }),
  component: JournalPage,
});

function splitDate(monthLabel: string) {
  // "Mai 2024" → { d: "—", m: "Mai", y: "2024" } (fallback if no day)
  const parts = monthLabel.split(" ");
  return { d: "•", m: parts[0] ?? "", y: parts[1] ?? "" };
}

function JournalPage() {
  const { trips } = Route.useLoaderData() as { trips: PublicTrip[] };
  const entries = trips.slice().reverse();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="max-w-7xl mx-auto px-6 md:px-8 pt-12 text-center">
        <p className="font-script text-2xl text-primary flex items-center justify-center gap-2">
          Meine Erinnerungen. Mein Weg. <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mt-2">
          Mein Reisetagebuch
        </h1>
        <p className="font-script text-2xl text-primary/80 mt-3">
          Gedanken, Momente und kleine Geschichten von unterwegs.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 md:px-8 py-10 grid lg:grid-cols-[1fr_320px] gap-8">
        <ul className="space-y-6">
          {entries.map((t: PublicTrip, i: number) => {
            const dt = splitDate(t.monthLabel);
            return (
              <li key={t.slug} className="paper-card p-4 md:p-5 flex flex-col md:flex-row gap-5 relative" style={{ animation: `revealNode 0.5s var(--ease-cinematic) ${i * 50}ms both` }}>
                <span className="absolute -top-2 left-8 h-4 w-16 bg-primary/15 rotate-[-3deg] rounded-sm" aria-hidden />
                <div className="flex-none grid place-items-center rounded-lg bg-primary text-primary-foreground w-20 h-20 md:w-24 md:h-24 text-center">
                  <div>
                    <div className="text-2xl font-semibold leading-none">{dt.d}</div>
                    <div className="text-xs uppercase tracking-widest mt-1">{dt.m}</div>
                    <div className="text-xs opacity-80 mt-0.5">{dt.y}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-primary flex items-center gap-1.5">
                    {t.title}, {t.region}
                  </p>
                  <h3 className="font-display text-2xl font-semibold mt-1 leading-tight">
                    {t.kicker ?? t.title}
                  </h3>
                  <p className="font-script text-lg text-foreground/85 mt-2 leading-snug">
                    {t.excerpt}
                  </p>
                  <Link
                    to="/stories/$slug"
                    params={{ slug: t.slug }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline underline-offset-4"
                  >
                    Ganzen Eintrag lesen <ArrowRight className="size-4" />
                  </Link>
                </div>
                <div className="md:w-[220px] flex-none">
                  <div className="rounded-lg overflow-hidden aspect-[4/3] shadow-sm">
                    <ResponsivePicture
                      webp={t.cover.webp}
                      avif={t.cover.avif}
                      alt={t.cover.alt ?? t.title}
                      width={440}
                      height={330}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="space-y-6">
          <div className="paper-card p-5 relative">
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 size-3 rounded-full bg-primary/70" aria-hidden />
            <h3 className="font-script text-2xl text-foreground">Unterwegs notiert</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>☕ Sonnenuntergänge sammeln</li>
              <li>✨ Öfter spontan sein</li>
              <li>💬 Mehr mit Locals sprechen</li>
              <li>🌿 Weniger planen, mehr fühlen</li>
            </ul>
          </div>
          <div className="paper-card p-5">
            <h3 className="font-script text-2xl">Heute gelernt</h3>
            <p className="font-script text-lg text-foreground/80 mt-2 leading-snug">
              Die schönsten Momente sind nicht die perfekten, sondern die echten.
            </p>
          </div>
          <div className="paper-card p-3">
            <div className="rounded-lg overflow-hidden aspect-[4/5]">
              {entries[0] && (
                <ResponsivePicture
                  webp={entries[0].cover.webp}
                  avif={entries[0].cover.avif}
                  alt={entries[0].cover.alt ?? ""}
                  width={400}
                  height={500}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <p className="font-script text-xl text-primary mt-3 text-center">Mein Lieblingsmoment</p>
          </div>
        </aside>
      </section>

      <SiteFooter />
    </div>
  );
}
