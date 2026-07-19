import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Heart, Search, Menu, X, LogOut } from "lucide-react";
import { useIsAuthenticated, emitAuthChanged } from "@/hooks/useIsAuthenticated";

const nav = [
  { to: "/", label: "Startseite" },
  { to: "/timeline", label: "Timeline" },
  { to: "/stories", label: "Reiseberichte" },
  { to: "/journal", label: "Reisetagebuch" },
  { to: "/gallery", label: "Fotogalerie" },
  { to: "/about", label: "Über mich" },
  { to: "/contact", label: "Kontakt" },
] as const;

export function SiteHeader() {
  const isAuthenticated = useIsAuthenticated();
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
    } finally {
      emitAuthChanged();
      await navigate({ to: "/" });
    }
  };

  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-8 py-4">
          <Link to="/" className="group" onClick={() => setOpen(false)}>
            <div className="flex items-baseline gap-2 leading-none">
              <span className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
                Reisejournal
              </span>
              <Heart className="size-4 text-primary fill-primary/40" strokeWidth={1.5} />
            </div>
            <p className="font-script text-lg text-primary/80 mt-0.5">Mein Weg. Meine Welt.</p>
          </Link>

          <nav className="hidden lg:flex items-center gap-7">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="text-sm text-foreground/80 hover:text-primary transition-colors"
                activeProps={{
                  className: "text-primary font-medium border-b-2 border-primary pb-1",
                }}
                activeOptions={{ exact: n.to === "/" }}
              >
                {n.label}
              </Link>
            ))}
            {isAuthenticated && (
              <>
                <Link
                  to="/admin/studio"
                  className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                  activeProps={{ className: "border-b-2 border-primary pb-1" }}
                >
                  Studio
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 text-sm text-foreground/70 hover:text-primary transition-colors"
                  aria-label="Abmelden"
                >
                  <LogOut className="size-4" strokeWidth={1.5} />
                  Abmelden
                </button>
              </>
            )}
          </nav>


          <div className="flex items-center gap-3">
            <button
              aria-label="Suche"
              className="hidden md:inline-flex p-2 text-foreground/70 hover:text-primary transition-colors"
            >
              <Search className="size-5" strokeWidth={1.5} />
            </button>
            <button
              aria-label="Menü"
              onClick={() => setOpen((v) => !v)}
              className="lg:hidden p-2 text-foreground"
            >
              {open ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-background/97 backdrop-blur-xl pt-24 px-8 lg:hidden">
          <nav className="flex flex-col gap-5 max-w-7xl mx-auto">
            {nav.map((n, i) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="font-display text-3xl md:text-5xl tracking-tight font-medium hover:text-primary transition-colors"
                style={{ animation: `revealNode 0.4s var(--ease-cinematic) ${i * 50}ms both` }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
