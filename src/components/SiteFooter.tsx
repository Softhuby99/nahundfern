import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="px-6 md:px-8 py-16 border-t border-border flex flex-col md:flex-row justify-between items-start md:items-end gap-12">
      <div>
        <div className="flex items-center gap-2 mb-8">
          <div className="size-3 bg-primary rounded-full" />
          <span className="font-display text-xl tracking-tight font-medium">Vagabond.</span>
        </div>
        <nav className="flex flex-wrap gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <Link to="/timeline" className="hover:text-primary transition-colors">Timeline</Link>
          <Link to="/stories" className="hover:text-primary transition-colors">Stories</Link>
          <Link to="/about" className="hover:text-primary transition-colors">About</Link>
          <Link to="/tips" className="hover:text-primary transition-colors">Tips</Link>
          <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
        </nav>
      </div>
      <div className="text-left md:text-right">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Inquiries</p>
        <a
          href="mailto:hello@vagabond.studio"
          className="font-display text-2xl md:text-4xl tracking-tight font-light hover:text-primary transition-colors underline decoration-border decoration-1 underline-offset-8 hover:decoration-primary"
        >
          hello@vagabond.studio
        </a>
        <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">© 2024 Vagabond Journal</p>
      </div>
    </footer>
  );
}
