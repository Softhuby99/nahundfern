import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Heart, Mail, Instagram, Send, Lock, Briefcase } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Kontakt — Reisejournal" },
      {
        name: "description",
        content:
          "Ob Fragen, Feedback oder Reiseinspiration — ich freue mich riesig, von dir zu lesen.",
      },
      { property: "og:title", content: "Kontakt — Reisejournal" },
      { property: "og:description", content: "Lass uns in Kontakt bleiben." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <section className="max-w-6xl mx-auto px-6 md:px-8 pt-12 pb-20 grid lg:grid-cols-2 gap-12">
        <div>
          <p className="font-script text-2xl text-primary flex items-center gap-2">
            Ich freue mich von dir zu hören.{" "}
            <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-semibold tracking-tight mt-3 leading-none">
            Lass uns in
            <br />
            Kontakt bleiben
          </h1>
          <p className="font-script text-xl md:text-2xl text-primary/80 mt-6 leading-snug">
            Ob Fragen, Feedback, Reiseinspiration oder einfach ein Hallo — ich freue mich riesig,
            von dir zu lesen!
          </p>

          <div className="paper-card p-4 mt-8 max-w-sm rotate-[-1.5deg]">
            <p className="font-script text-lg leading-snug">
              Ich lese jede Nachricht persönlich und antworte so schnell wie möglich. Danke, dass du
              Teil meiner Reise bist!
            </p>
          </div>

          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            <a
              href="mailto:hallo@reisejournal.de"
              className="paper-card p-4 flex flex-col gap-1 hover:-translate-y-0.5 transition-transform"
            >
              <Mail className="size-5 text-primary" strokeWidth={1.5} />
              <p className="font-display font-semibold">E-Mail</p>
              <p className="text-xs text-muted-foreground">
                Für Fragen, Feedback oder einfach zum Austauschen.
              </p>
              <p className="text-primary text-sm mt-1">hallo@reisejournal.de</p>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              className="paper-card p-4 flex flex-col gap-1 hover:-translate-y-0.5 transition-transform"
            >
              <Instagram className="size-5 text-primary" strokeWidth={1.5} />
              <p className="font-display font-semibold">Instagram</p>
              <p className="text-xs text-muted-foreground">
                Folge mir für tägliche Eindrücke und kleine Abenteuer.
              </p>
              <p className="text-primary text-sm mt-1">@reisejournal</p>
            </a>
            <div className="paper-card p-4">
              <Mail className="size-5 text-primary" strokeWidth={1.5} />
              <p className="font-display font-semibold">Newsletter</p>
              <p className="text-xs text-muted-foreground">
                Neue Reiseberichte, Tipps & Inspiration direkt in dein Postfach.
              </p>
              <p className="text-primary text-sm mt-1">Jetzt anmelden →</p>
            </div>
            <div className="paper-card p-4">
              <Briefcase className="size-5 text-primary" strokeWidth={1.5} />
              <p className="font-display font-semibold">Zusammenarbeit</p>
              <p className="text-xs text-muted-foreground">
                Du möchtest mit mir arbeiten oder ein Projekt vorschlagen?
              </p>
              <p className="text-primary text-sm mt-1">Kooperationsanfrage senden →</p>
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="paper-card p-6 md:p-8 relative self-start"
        >
          <div className="paper-card px-5 py-2 -mt-12 mx-auto w-max rotate-[-3deg]">
            <p className="font-script text-2xl flex items-center gap-2">
              Schreib mir{" "}
              <Heart className="size-4 fill-primary/40 text-primary" strokeWidth={1.5} />
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <Field label="Dein Name" placeholder="Wie darf ich dich nennen?" />
            <Field label="Deine E-Mail" type="email" placeholder="Damit ich dir antworten kann." />
            <Field label="Betreff (optional)" placeholder="Worum geht es?" />
            <div>
              <label className="font-display text-sm">Deine Nachricht</label>
              <textarea
                required
                rows={5}
                placeholder="Ich freue mich auf deine Nachricht ..."
                className="mt-1 w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:opacity-95 hover:-translate-y-0.5 transition-all"
            >
              {sent ? (
                "Nachricht gesendet ✓"
              ) : (
                <>
                  Nachricht senden <Send className="size-4" strokeWidth={1.5} />
                </>
              )}
            </button>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="size-3.5" strokeWidth={1.5} /> Deine Daten werden vertraulich
              behandelt und nicht an Dritte weitergegeben.
            </p>
          </div>
        </form>
      </section>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  type = "text",
  placeholder,
}: {
  label: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-display text-sm">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-1 w-full bg-background border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-primary"
      />
    </div>
  );
}
