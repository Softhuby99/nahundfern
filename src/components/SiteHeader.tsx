import { Link } from "@tanstack/react-router";
import { useState } from "react";

const nav = [
  { to: "/", label: "Home" },
  { to: "/timeline", label: "Timeline" },
  { to: "/stories", label: "Stories" },
  { to: "/about", label: "About" },
  { to: "/tips", label: "Tips" },
  { to: "/contact", label: "Contact" },
  { to: "/admin/studio", label: "Studio" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 py-5 backdrop-blur-md border-b border-border bg-background/70">
        <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <div className="size-3 bg-primary rounded-full" />
          <span className="font-display text-2xl tracking-tight font-medium">Vagabond.</span>
        </Link>
        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="group flex flex-col gap-1.5 p-2"
        >
          <span className={`block w-6 h-0.5 bg-foreground transition-all ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block w-6 h-0.5 bg-foreground transition-all ${open ? "opacity-0" : ""}`} />
          <span className={`block w-6 h-0.5 bg-foreground transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 bg-background/95 backdrop-blur-xl pt-24 px-8">
          <nav className="flex flex-col gap-6 max-w-7xl mx-auto">
            {nav.map((n, i) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="font-display text-5xl md:text-7xl tracking-tight font-light hover:text-primary transition-colors"
                style={{ animation: `revealNode 0.5s var(--ease-cinematic) ${i * 60}ms both` }}
              >
                {String(i + 1).padStart(2, "0")} — {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
