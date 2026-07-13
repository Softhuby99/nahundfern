type Props = {
  webp: Record<number, string>;
  avif: Record<number, string>;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  /**
   * CSS aspect-ratio applied to the wrapper, e.g. "16 / 10".
   * Combined with object-cover on the img this keeps the layout stable while
   * images stream in.
   */
  aspectRatio?: string;
  /**
   * srcset sizes hint. Provide the actual rendered CSS width so the browser
   * downloads the smallest variant that still looks sharp.
   */
  sizes?: string;
  /** Set true for the largest above-the-fold image (cover of the first card). */
  priority?: boolean;
};

/**
 * Serves AVIF > WebP with a 400 / 1200 / 2000 srcset. Ships `sizes` so the
 * browser doesn't blindly assume 100vw and download the 2000px variant for a
 * 180px timeline thumbnail. Wrapper enforces an explicit aspect-ratio to
 * avoid layout shift while images stream in.
 */
export function ResponsivePicture({
  webp,
  avif,
  alt,
  className,
  width,
  height,
  aspectRatio,
  sizes = "(min-width: 768px) 33vw, 100vw",
  priority = false,
}: Props) {
  const wrapperStyle = aspectRatio ? { aspectRatio } : undefined;
  return (
    <picture style={wrapperStyle} className={aspectRatio ? "block w-full" : undefined}>
      <source
        srcSet={`${avif[400]} 400w, ${avif[1200]} 1200w, ${avif[2000]} 2000w`}
        sizes={sizes}
        type="image/avif"
      />
      <source
        srcSet={`${webp[400]} 400w, ${webp[1200]} 1200w, ${webp[2000]} 2000w`}
        sizes={sizes}
        type="image/webp"
      />
      <img
        src={webp[1200] ?? webp[400]}
        alt={alt}
        width={width ?? 400}
        height={height ?? 300}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        className={className}
      />
    </picture>
  );
}
