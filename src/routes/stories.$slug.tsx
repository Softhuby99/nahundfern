import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { getPublishedTrip, listPublishedTrips, type PublicTrip } from "@/lib/trips.functions";

export const Route = createFileRoute("/stories/$slug")({
  loader: async ({ params }) => {
    try {
      const trip = await getPublishedTrip({ data: params.slug });
      const all = await listPublishedTrips();
      return { trip, all };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => {
    const t = loaderData?.trip;
    if (!t) return { meta: [{ title: "Story — Vagabond" }] };
    const cover = t.cover.webp[1200];
    return {
      meta: [
        { title: `${t.title} — Vagabond` },
        { name: "description", content: t.excerpt },
        { property: "og:title", content: `${t.title} — Vagabond` },
        { property: "og:description", content: t.excerpt },
        { property: "og:image", content: cover },
        { name: "twitter:image", content: cover },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">404</p>
        <h1 className="font-display text-5xl tracking-tight font-light mb-6">Story not found</h1>
        <Link to="/stories" className="font-mono text-[10px] uppercase tracking-widest border-b border-border pb-1 hover:text-primary">
          ← All stories
        </Link>
      </div>
    </div>
  ),
  component: StoryPage,
});

function StoryPage() {
  const { trip, all } = Route.useLoaderData();
  const idx = all.findIndex((t: PublicTrip) => t.slug === trip.slug);
  const next = all[(idx + 1) % all.length];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />

      <article>
        {/* Cover */}
        <div className="relative h-[60vh] md:h-[80vh] overflow-hidden">
          <ResponsivePicture
            webp={trip.cover.webp}
            avif={trip.cover.avif}
            alt={trip.cover.alt ?? trip.title}
            width={1600}
            height={2000}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-6 md:px-8 pb-12 max-w-5xl mx-auto">
            <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">{trip.monthLabel} · {trip.region}</p>
            <h1 className="font-display text-5xl md:text-7xl tracking-tight font-light leading-[1.05]">{trip.title}</h1>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 md:px-8 max-w-5xl mx-auto py-12 grid md:grid-cols-3 gap-8 border-b border-border">
          <MetaCell label="Where" value={trip.where} />
          <MetaCell label="When" value={trip.when} />
          <MetaCell label="Crew" value={trip.who} />
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 max-w-3xl mx-auto py-16">
          <p className="font-display text-2xl md:text-3xl leading-snug mb-12 tracking-tight font-light text-primary">
            {trip.excerpt}
          </p>
          <div className="prose-story text-lg leading-relaxed text-foreground/90 space-y-6
                          [&_h2]:font-display [&_h2]:text-3xl [&_h2]:mt-10 [&_h2]:mb-4
                          [&_h3]:font-display [&_h3]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3
                          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4
                          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                          [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/70
                          [&_code]:font-mono [&_code]:text-sm [&_code]:bg-card [&_code]:px-1 [&_code]:rounded">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {trip.bodyMd}
            </ReactMarkdown>
          </div>
        </div>

        {/* Next */}
        <div className="px-6 md:px-8 max-w-5xl mx-auto py-16 border-t border-border flex items-center justify-between gap-8">
          <Link to="/stories" className="font-mono text-[10px] uppercase tracking-widest hover:text-primary">
            ← All stories
          </Link>
          <Link to="/stories/$slug" params={{ slug: next.slug }} className="group text-right">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Next station</p>
            <p className="font-display text-2xl md:text-3xl tracking-tight font-medium group-hover:text-primary transition-colors">{next.title} →</p>
          </Link>
        </div>
      </article>

      <SiteFooter />
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">{label}</p>
      <p className="text-base leading-relaxed">{value}</p>
    </div>
  );
}
