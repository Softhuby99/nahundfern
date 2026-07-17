import { Instagram, Mail, Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-[color:var(--color-deep-teal)] text-white/90">
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-8">
        <p className="font-script text-2xl md:text-3xl flex items-center gap-2">
          Danke, dass du hier bist!{" "}
          <Heart className="size-5 fill-white/60 text-white/60" strokeWidth={1.5} />
        </p>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-white/10">
            <Instagram className="size-5" strokeWidth={1.5} />
          </span>
          <div className="text-sm leading-tight">
            <p className="opacity-80">Folge mir auf Instagram</p>
            <p className="font-medium">@reisejournal.laura</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-white/10">
            <Mail className="size-5" strokeWidth={1.5} />
          </span>
          <div className="text-sm leading-tight">
            <p className="opacity-80">Lass uns in Kontakt bleiben</p>
            <p className="font-medium">hallo@reisejournal.de</p>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs opacity-60">
        © {new Date().getFullYear()} Reisejournal — Mein Weg. Meine Welt. · v{__APP_VERSION__}
      </div>
    </footer>
  );
}
