import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const tips = [
  {
    n: "01",
    title: "Pack die Hälfte",
    body: "Lege alles auf das Bett, was du mitnehmen willst. Dann nimm die Hälfte zurück in den Schrank. Du wirst sie nicht vermissen.",
  },
  {
    n: "02",
    title: "Komm bei Dämmerung an",
    body: "Eine neue Stadt erschlägt dich am Tag und verzaubert dich am Abend. Plane deine Ankunft eine Stunde vor Sonnenuntergang.",
  },
  {
    n: "03",
    title: "Eine Sache pro Tag",
    body: "Plane einen Programmpunkt pro Tag. Alles andere darf passieren. Du erinnerst dich an Begegnungen, nicht an abgehakte Listen.",
  },
  {
    n: "04",
    title: "Offline-Karten + Bargeld",
    body: "Lade Google-Maps-Bereiche offline. Hebe immer etwas Bargeld in Landeswährung ab. Beides hat mir mehrfach den Tag gerettet.",
  },
  {
    n: "05",
    title: "Eine Mahlzeit teuer",
    body: "Iss eine Mahlzeit pro Reise in einem teureren Restaurant. Nicht für den Geschmack — für die Geschichten der Kellner.",
  },
  {
    n: "06",
    title: "Schreib am Abend, nicht zuhause",
    body: "Notiere abends drei Sätze über den Tag. Sonst verschwimmen die Reisen, wenn du zurück bist.",
  },
];

export const Route = createFileRoute("/tips")({
  head: () => ({
    meta: [
      { title: "Tips — Vagabond" },
      { name: "description", content: "Sechs Reisetipps, die wirklich helfen — keine Affiliate-Links." },
      { property: "og:title", content: "Tips — Vagabond" },
      { property: "og:description", content: "Sechs Reisetipps, die wirklich helfen — keine Affiliate-Links." },
    ],
  }),
  component: TipsPage,
});

function TipsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="px-6 md:px-8 pt-16 pb-12 max-w-5xl mx-auto">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">Field Notes</p>
        <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.9] tracking-tighter">Sechs Regeln</h1>
        <p className="mt-6 max-w-2xl text-muted-foreground">Alles, was ich in zehn Jahren Reisen gelernt habe und was tatsächlich funktioniert. Keine Listen mit zwanzig Punkten.</p>
      </section>
      <section className="px-6 md:px-8 max-w-5xl mx-auto pb-24 grid md:grid-cols-2 gap-px bg-border">
        {tips.map((t) => (
          <div key={t.n} className="bg-background p-8 md:p-10">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">{t.n}</p>
            <h2 className="font-display text-3xl uppercase tracking-tight mb-4">{t.title}</h2>
            <p className="text-foreground/80 leading-relaxed">{t.body}</p>
          </div>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
