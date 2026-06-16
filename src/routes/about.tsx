import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import aboutDesk from "@/assets/about-desk.jpg";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Vagabond" },
      { name: "description", content: "Wer hinter Vagabond steckt — Philosophie, Werkzeug, Haltung." },
      { property: "og:title", content: "About — Vagabond" },
      { property: "og:description", content: "Wer hinter Vagabond steckt — Philosophie, Werkzeug, Haltung." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <section className="px-6 md:px-8 pt-16 pb-12 max-w-5xl mx-auto">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">About</p>
        <h1 className="font-display text-5xl md:text-8xl uppercase leading-[0.9] tracking-tighter">
          Slow movement.<br />Sharp images.
        </h1>
      </section>

      <section className="px-6 md:px-8 max-w-5xl mx-auto grid md:grid-cols-[1fr_320px] gap-12 pb-24">
        <div className="space-y-6 text-lg leading-relaxed text-foreground/90">
          <p>
            Ich heiße Jonas, bin 34, lebe in Berlin und reise seit zehn Jahren mit einer kleinen Filmkamera in der Jackentasche. Vagabond ist mein digitales Archiv — eine Sammlung von Reisen, die langsam genug waren, um sie noch zu erinnern.
          </p>
          <p>
            Mich interessiert das Dazwischen: der Geruch eines Bahnhofs um 6 Uhr morgens, das Geräusch eines fremden Dialekts, das Licht, das fünf Minuten später wieder weg ist. Daraus mache ich Bilder und kurze Texte. Keine Top-10-Listen.
          </p>
          <p>
            Wenn du selbst los willst und nicht weißt, wo du anfangen sollst — schreib mir. Ich antworte auf jede Mail, manchmal langsam, aber immer.
          </p>
        </div>
        <div>
          <div className="aspect-[4/5] bg-card overflow-hidden mb-6">
            <img src={aboutDesk} alt="Desk with camera and maps" loading="lazy" width={1024} height={1280} className="w-full h-full object-cover" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-3">Gear</p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>Leica M6 + 35mm Summicron</li>
            <li>Fujifilm X100V (immer dabei)</li>
            <li>Moleskine, schwarz, kariert</li>
            <li>Eine ausreichend gute Hose</li>
          </ul>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
