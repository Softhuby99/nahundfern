import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Vagabond" },
      { name: "description", content: "Schreib mir — Fragen, Routen, gemeinsame Projekte." },
      { property: "og:title", content: "Contact — Vagabond" },
      { property: "og:description", content: "Schreib mir — Fragen, Routen, gemeinsame Projekte." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <section className="px-6 md:px-8 pt-16 pb-24 max-w-3xl mx-auto w-full flex-1">
        <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">Inquiries</p>
        <h1 className="font-display text-5xl md:text-7xl uppercase leading-[0.9] tracking-tighter mb-8">Schreib mir.</h1>
        <p className="text-muted-foreground leading-relaxed mb-12 max-w-prose">
          Frage zur Route, Idee für ein Projekt, oder einfach Lust auf einen Kaffee in Berlin? Schreib mir — ich antworte persönlich, meistens innerhalb von zwei Tagen.
        </p>

        {sent ? (
          <div className="border border-primary p-8">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Sent</p>
            <p className="font-display text-3xl uppercase tracking-tight">Danke. Bis bald.</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="space-y-6"
          >
            <Field label="Name" name="name" required />
            <Field label="E-Mail" name="email" type="email" required />
            <Field label="Betreff" name="subject" />
            <div>
              <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Nachricht</label>
              <textarea
                name="message"
                rows={6}
                required
                className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3 text-foreground transition-colors"
              />
            </div>
            <button
              type="submit"
              className="px-6 py-3 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 transition-colors"
            >
              Senden →
            </button>
            <p className="text-xs text-muted-foreground">Demo-Formular — die Nachricht wird nicht versendet.</p>
          </form>
        )}
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({ label, name, type = "text", required = false }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">{label}</label>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full bg-background border border-border focus:border-primary focus:outline-none p-3 text-foreground transition-colors"
      />
    </div>
  );
}
