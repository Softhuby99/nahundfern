import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import { getPublishedTrip, listTripNavigationEntries } from "@/lib/trips.functions";
import { getPublicBaseUrl } from "@/lib/public-base-url";

export const Route = createFileRoute("/stories/$slug")({
  loader: async ({ params }) => {
    // Load story and navigation entries in parallel. A missing story is a real
    // 404; every other failure (DB down, bug, config) is rethrown so the error
    // boundary / SSR middleware can surface a proper 500 instead of silently
    // pretending the story doesn't exist.
    const [trip, navigationEntries] = await Promise.all([
      getPublishedTrip({ data: params.slug }),
      listTripNavigationEntries(),
    ]);
    if (!trip) throw notFound();
    return { trip, navigationEntries };
  },
  head: ({ loaderData, params }) => {
    const baseUrl = getPublicBaseUrl();
    const storyUrl = new URL(`/stories/${encodeURIComponent(params.slug)}`, baseUrl).toString();

    const t = loaderData?.trip;
    if (!t) {
      return {
        meta: [{ title: "Story — Reisejournal" }, { name: "robots", content: "noindex" }],
      };
    }

    const title = `${t.title} — Reisejournal`;
    // Cover is a LEFT JOIN — guard against missing/invalid variants so we
    // never emit og:image=".../null" or a relative path.
    const coverPath = t.cover.webp[1200];
    const coverUrl =
      typeof coverPath === "string" && coverPath.length > 0
        ? new URL(coverPath, baseUrl).toString()
        : null;

    const meta: Array<{ title?: string; name?: string; property?: string; content?: string }> = [
      { title },
      { name: "description", content: t.excerpt },
      { property: "og:title", content: title },
      { property: "og:description", content: t.excerpt },
      { property: "og:type", content: "article" },
      { property: "og:url", content: storyUrl },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (coverUrl) {
      meta.push(
        { property: "og:image", content: coverUrl },
        { name: "twitter:image", content: coverUrl },
      );
    }

    return {
      meta,
      links: [{ rel: "canonical", href: storyUrl }],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <div className="max-w-3xl mx-auto px-6 py-32 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-4">404</p>
        <h1 className="font-display text-5xl tracking-tight font-light mb-6">Story not found</h1>
        <Link
          to="/stories"
          className="font-mono text-[10px] uppercase tracking-widest border-b border-border pb-1 hover:text-primary"
        >
          ← All stories
        </Link>
      </div>
    </div>
  ),
  component: StoryPage,
});

function StoryPage() {
  const { trip, navigationEntries } = Route.useLoaderData();

  // List is sorted newest → oldest, so index-1 is the more recent trip and
  // index+1 is the older one. Defensive: if the current slug is missing from
  // the nav list (data inconsistency), disable both directions rather than
  // linking to the newest entry by accident.
  const index = navigationEntries.findIndex((e: { slug: string }) => e.slug === trip.slug);
  const newer = index > 0 ? navigationEntries[index - 1] : null;
  const older = index >= 0 ? (navigationEntries[index + 1] ?? null) : null;

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
            <p className="font-mono text-primary text-xs uppercase tracking-[0.3em] mb-4">
              {trip.monthLabel} · {trip.region}
            </p>
            <h1 className="font-display text-5xl md:text-7xl tracking-tight font-light leading-[1.05]">
              {trip.title}
            </h1>
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
          <div
            className="prose-story text-lg leading-relaxed text-foreground/90 space-y-6
                          [&_h2]:font-display [&_h2]:text-3xl [&_h2]:mt-10 [&_h2]:mb-4
                          [&_h3]:font-display [&_h3]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3
                          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4
                          [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6
                          [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-foreground/70
                          [&_code]:font-mono [&_code]:text-sm [&_code]:bg-card [&_code]:px-1 [&_code]:rounded"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {trip.bodyMd}
            </ReactMarkdown>
          </div>
        </div>

        {/* Navigation: symmetrical 3-column footer — newer / all / older.
            Placeholders keep the layout stable when a direction is missing. */}
        <div className="px-6 md:px-8 max-w-5xl mx-auto py-16 border-t border-border grid grid-cols-3 items-center gap-8">
          <div className="text-left">
            {newer ? (
              <Link
                to="/stories/$slug"
                params={{ slug: newer.slug }}
                className="group inline-block"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  ← Neuere Reise
                </p>
                <p className="font-display text-xl md:text-2xl tracking-tight font-medium group-hover:text-primary transition-colors">
                  {newer.title}
                </p>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>

          <div className="text-center">
            <Link
              to="/stories"
              className="font-mono text-[10px] uppercase tracking-widest border-b border-border pb-1 hover:text-primary"
            >
              Alle Reisen
            </Link>
          </div>

          <div className="text-right">
            {older ? (
              <Link
                to="/stories/$slug"
                params={{ slug: older.slug }}
                className="group inline-block"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Ältere Reise →
                </p>
                <p className="font-display text-xl md:text-2xl tracking-tight font-medium group-hover:text-primary transition-colors">
                  {older.title}
                </p>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
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
