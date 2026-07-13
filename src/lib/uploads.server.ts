import fs from "node:fs/promises";
import path from "node:path";
import sharp, { type ResizeOptions } from "sharp";
import { randomUUID } from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";

const SIZES = [400, 1200, 2000] as const;

// Safety limits — reject overly large / decompression-bomb inputs before
// spending memory decoding them.
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_INPUT_PIXELS = 50_000_000;     // ~50 megapixels

const FORMAT_TO_EXT: Record<string, string> = {
  jpeg: ".jpg",
  jpg: ".jpg",
  png: ".png",
  webp: ".webp",
  avif: ".avif",
  heif: ".heic",
  tiff: ".tiff",
  gif: ".gif",
};

export type UploadDirs = {
  root: string;
  originals: string;
  webp: string;
  avif: string;
};

export async function ensureUploadDirs(): Promise<UploadDirs> {
  const dirs: UploadDirs = {
    root: UPLOADS_DIR,
    originals: path.join(UPLOADS_DIR, "originals"),
    webp: path.join(UPLOADS_DIR, "webp"),
    avif: path.join(UPLOADS_DIR, "avif"),
  };
  await fs.mkdir(dirs.originals, { recursive: true });
  await fs.mkdir(dirs.webp, { recursive: true });
  await fs.mkdir(dirs.avif, { recursive: true });
  return dirs;
}

export type StoredImage = {
  id: string;
  originalPath: string;
  webp: Record<number, string>;
  avif: Record<number, string>;
  width: number;
  height: number;
  mime: string;
  ext: string;
};

export async function storeImage(buffer: Buffer, _originalName: string): Promise<StoredImage> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`Bilddatei ist zu groß (max ${MAX_FILE_BYTES / (1024 * 1024)} MB)`);
  }

  const dirs = await ensureUploadDirs();

  // Decide the extension from the actual decoded format, not the user-supplied
  // filename. Reject formats we won't ship (e.g. SVG, unknown blobs).
  const probe = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const meta = await probe.metadata();
  const format = meta.format ?? "";
  const ext = FORMAT_TO_EXT[format];
  if (!ext) {
    throw new Error(`Nicht unterstütztes Bildformat: ${format || "unbekannt"}`);
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new Error("Bild hat zu viele Pixel");
  }

  const id = randomUUID();
  const originalFileName = `${id}${ext}`;
  const originalDiskPath = path.join(dirs.originals, originalFileName);

  // Apply EXIF orientation, strip metadata, and write the sanitized original.
  await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
    .rotate()
    .withMetadata({ orientation: undefined })
    .toFile(originalDiskPath);

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const mime = format ? `image/${format}` : "image/jpeg";

  const webp: Record<number, string> = {};
  const avif: Record<number, string> = {};

  for (const size of SIZES) {
    const resizeOptions: ResizeOptions = {
      width: size,
      withoutEnlargement: true,
      fit: "inside",
    };

    const webpDisk = path.join(dirs.webp, `${id}_${size}.webp`);
    await sharp(originalDiskPath, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(resizeOptions)
      .webp({ quality: 80, effort: 4 })
      .toFile(webpDisk);
    webp[size] = `/uploads/webp/${id}_${size}.webp`;

    const avifDisk = path.join(dirs.avif, `${id}_${size}.avif`);
    await sharp(originalDiskPath, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize(resizeOptions)
      .avif({ quality: 70, effort: 4 })
      .toFile(avifDisk);
    avif[size] = `/uploads/avif/${id}_${size}.avif`;
  }

  return {
    id,
    originalPath: `/uploads/originals/${originalFileName}`,
    webp,
    avif,
    width,
    height,
    mime,
    ext,
  };
}

export type ImagePaths = {
  originalPath: string;
  webp: Record<number, string>;
  avif: Record<number, string>;
};

/**
 * Translate a stored public URL (e.g. `/uploads/webp/foo.webp`) into the
 * absolute path inside the uploads volume (e.g. `/app/uploads/webp/foo.webp`).
 * Handles both legacy leading-slash values and already-relative paths.
 */
function toDiskPath(publicPath: string): string {
  const relative = publicPath.replace(/^\/?uploads\//, "").replace(/^\/+/, "");
  return path.join(UPLOADS_DIR, relative);
}

export async function deleteImageFiles(stored: ImagePaths) {
  await ensureUploadDirs();
  const files = [
    toDiskPath(stored.originalPath),
    ...Object.values(stored.webp).map(toDiskPath),
    ...Object.values(stored.avif).map(toDiskPath),
  ];
  await Promise.all(
    files.map(async (f) => {
      try {
        await fs.unlink(f);
      } catch (err: unknown) {
        // Only ignore the file being absent — surface any other error so the
        // operator sees permission/path issues instead of silently leaking blobs.
        const code = (err as NodeJS.ErrnoException | undefined)?.code;
        if (code !== "ENOENT") {
          console.error(`deleteImageFiles: failed to unlink ${f}:`, err);
        }
      }
    }),
  );
}
