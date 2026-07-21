import { useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { ResponsivePicture } from "@/components/HorizontalTimeline";
import type { GalleryImage } from "@/lib/trips.functions";

type Props = {
  images: GalleryImage[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  title: string;
};

function getLargestSrc(img: GalleryImage): string | null {
  const src = img.webp?.[2000] ?? img.webp?.[1200] ?? img.webp?.[400];
  return typeof src === "string" && src.length > 0 ? src : null;
}

export function GalleryLightbox({ images, startIndex, open, onClose, title }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(startIndex);

  const total = images.length;
  const hasMultiple = total > 1;

  // Sync activeIndex on open / when startIndex changes while opening
  useEffect(() => {
    if (open && total > 0) {
      setActiveIndex(Math.min(Math.max(startIndex, 0), total - 1));
    }
  }, [open, startIndex, total]);

  // Focus + scroll-lock: depends only on `open` so focus-return runs on close, not on index change
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    // Defer focus to next tick so the button is mounted
    const id = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Keyboard handling + focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (hasMultiple && event.key === "ArrowRight") {
        event.preventDefault();
        setActiveIndex((i) => (i + 1) % total);
        return;
      }
      if (hasMultiple && event.key === "ArrowLeft") {
        event.preventDefault();
        setActiveIndex((i) => (i - 1 + total) % total);
        return;
      }
      if (event.key === "Tab" && rootRef.current) {
        const focusables = rootRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, hasMultiple, total, onClose]);

  // Keep active thumbnail in view
  useEffect(() => {
    if (!open) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    activeThumbRef.current?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex, open]);

  // Preload neighbours (best-effort)
  useEffect(() => {
    if (!open || !hasMultiple) return;
    const nextIdx = (activeIndex + 1) % total;
    const prevIdx = (activeIndex - 1 + total) % total;
    for (const idx of [nextIdx, prevIdx]) {
      const src = getLargestSrc(images[idx]);
      if (src) {
        const im = new Image();
        im.src = src;
      }
    }
  }, [activeIndex, open, hasMultiple, total, images]);

  if (!open || total === 0) return null;

  const current = images[activeIndex];
  const goPrev = () => setActiveIndex((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIndex((i) => (i + 1) % total);

  const onOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Bildergalerie: ${title}`}
      className="gallery-lightbox fixed inset-0 bg-black/90 flex flex-col"
      onClick={onOverlayClick}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 md:px-6 py-3 text-white/90"
        onClick={onOverlayClick}
      >
        <p className="font-mono text-xs tracking-widest">
          {activeIndex + 1} / {total}
        </p>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="p-2 rounded hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Main image + arrows */}
      <div
        className="flex-1 flex items-center justify-center px-2 md:px-6 min-h-0 relative"
        onClick={onOverlayClick}
      >
        {hasMultiple && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Vorheriges Bild"
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        )}

        <div
          className="max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ResponsivePicture
            key={current.id}
            webp={current.webp}
            avif={current.avif}
            alt={current.alt ?? title}
            width={current.width}
            height={current.height}
            sizes="(max-width: 768px) 100vw, 1600px"
            className="max-h-[calc(100dvh-14rem)] w-auto h-auto object-contain"
            priority
          />
        </div>

        {hasMultiple && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Nächstes Bild"
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 p-2 md:p-3 rounded-full bg-black/50 hover:bg-black/70 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {hasMultiple && (
        <div className="px-4 md:px-6 py-4 overflow-x-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2 justify-start md:justify-center min-w-max">
            {images.map((img, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={img.id}
                  ref={isActive ? activeThumbRef : undefined}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Bild ${idx + 1} von ${total}`}
                  aria-current={isActive ? "true" : undefined}
                  className={`shrink-0 h-16 w-24 md:h-20 md:w-28 overflow-hidden rounded border-2 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                    isActive
                      ? "border-primary opacity-100"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={img.webp?.[400] ?? img.webp?.[1200] ?? ""}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
