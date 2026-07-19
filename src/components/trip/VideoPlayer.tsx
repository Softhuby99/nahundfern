export type PublicVideo = {
  id: string;
  mp4: string;
  poster: string;
  width: number;
  height: number;
  alt: string | null;
};

/**
 * Lightweight <video> wrapper: HTML5 controls, no autoplay (respects data
 * usage + prefers-reduced-motion), poster for instant paint, `preload=metadata`
 * so the browser only fetches headers until the user hits play.
 */
export function VideoPlayer({ video, title }: { video: PublicVideo; title: string }) {
  return (
    <div
      className="relative bg-card overflow-hidden rounded-sm"
      style={{ aspectRatio: `${video.width} / ${video.height}` }}
    >
      <video
        controls
        preload="metadata"
        playsInline
        poster={video.poster}
        className="w-full h-full object-contain bg-black"
        aria-label={video.alt ?? `Video: ${title}`}
      >
        <source src={video.mp4} type="video/mp4" />
        Dein Browser unterstützt kein HTML5-Video.
      </video>
    </div>
  );
}
