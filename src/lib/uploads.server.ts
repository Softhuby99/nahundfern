import fs from "node:fs/promises";
import path from "node:path";
import sharp, { type ResizeOptions } from "sharp";
import { randomUUID } from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";

const SIZES = [400, 1200, 2000] as const;

// Safety limits — reject overly large / decompression-bomb inputs before
// spending memory decoding them.
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_INPUT_PIXELS = 50_000_000; //     ~50 megapixels

// Whitelisted decoded formats. HEIF (iPhone HEIC) is accepted as INPUT but is
// re-encoded to JPEG for the stored "original" — see storeImage() below.
const SUPPORTED_INPUT_FORMATS = new Set(["jpeg", "png", "webp", "avif", "heif"]);

// Output-format → extension / MIME map. Note: no HEIC, no GIF, no TIFF.
const FORMAT_TO_EXT: Record<string, string> = {
  jpeg: ".jpg",
  png: ".png",
  webp: ".webp",
  avif: ".avif",
};

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
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

  // Decide handling from the actual decoded format, not the user-supplied
  // filename. Reject anything outside the whitelist so we don't ship formats
  // with weak downstream support (GIF/TIFF/SVG/unknown).
  const probe = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" });
  const meta = await probe.metadata();
  const format = meta.format ?? "";

  if (format === "gif") {
    throw new Error(
      "Animierte GIF-Dateien werden nicht unterstützt. Bitte JPEG, PNG, WebP, AVIF oder HEIC verwenden.",
    );
  }
  if (!SUPPORTED_INPUT_FORMATS.has(format)) {
    throw new Error(`Nicht unterstütztes Bildformat: ${format || "unbekannt"}`);
  }
  if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
    throw new Error("Bild hat zu viele Pixel");
  }

  // HEIC/HEIF is decoded by libvips and re-encoded as a clean JPEG so the
  // stored "original" is a broadly supported format on every browser/OS.
  const outputFormat = format === "heif" ? "jpeg" : format;
  const ext = FORMAT_TO_EXT[outputFormat];
  const mime = FORMAT_TO_MIME[outputFormat];
  if (!ext || !mime) {
    // Defensive: whitelist mismatch would be a coding error, not user input.
    throw new Error(`Interner Bildpipeline-Fehler: Ausgabeformat ${outputFormat} unbekannt`);
  }

  const id = randomUUID();
  const originalFileName = `${id}${ext}`;
  const originalDiskPath = path.join(dirs.originals, originalFileName);

  // Every path we *might* have written. If any step fails partway through we
  // best-effort delete all of them so orphaned blobs don't accumulate on disk.
  const potentialFiles: string[] = [originalDiskPath];
  for (const size of SIZES) {
    potentialFiles.push(path.join(dirs.webp, `${id}_${size}.webp`));
    potentialFiles.push(path.join(dirs.avif, `${id}_${size}.avif`));
  }

  try {
    // Bake in the EXIF orientation, THEN drop all metadata. Not calling
    // withMetadata() is what strips EXIF (incl. GPS coords, capture time,
    // camera serial) — sharp only preserves metadata when explicitly asked.
    const originalPipeline = sharp(buffer, {
      limitInputPixels: MAX_INPUT_PIXELS,
      failOn: "error",
    }).rotate();

    const originalOutput =
      outputFormat === "jpeg" && format === "heif"
        ? // HEIC → clean JPEG
          await originalPipeline.jpeg({ quality: 92, mozjpeg: true }).toFile(originalDiskPath)
        : // Passthrough (jpeg/png/webp/avif) — rotation was applied, metadata dropped.
          await originalPipeline.toFile(originalDiskPath);

    // Use dimensions from the ACTUAL written file. `meta` describes the input
    // BEFORE EXIF rotation, which swaps width/height on portrait phone shots.
    const width = originalOutput.width;
    const height = originalOutput.height;

    const webp: Record<number, string> = {};
    const avif: Record<number, string> = {};

    for (const size of SIZES) {
      const resizeOptions: ResizeOptions = {
        width: size,
        withoutEnlargement: true,
        fit: "inside",
      };

      // Original is already rotated and metadata-free on disk, so variants
      // do not need another .rotate() pass.
      const webpDisk = path.join(dirs.webp, `${id}_${size}.webp`);
      await sharp(originalDiskPath, { limitInputPixels: MAX_INPUT_PIXELS })
        .resize(resizeOptions)
        .webp({ quality: 80, effort: 4 })
        .toFile(webpDisk);
      webp[size] = `/uploads/webp/${id}_${size}.webp`;

      const avifDisk = path.join(dirs.avif, `${id}_${size}.avif`);
      await sharp(originalDiskPath, { limitInputPixels: MAX_INPUT_PIXELS })
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
  } catch (error) {
    // Best-effort cleanup of anything the pipeline may have written before
    // failing. allSettled + swallow ENOENT: unlinking a file that was never
    // created is not an error worth surfacing.
    await Promise.allSettled(
      potentialFiles.map(async (f) => {
        try {
          await fs.unlink(f);
        } catch (err: unknown) {
          const code = (err as NodeJS.ErrnoException | undefined)?.code;
          if (code !== "ENOENT") {
            console.error(`storeImage cleanup: failed to unlink ${f}:`, err);
          }
        }
      }),
    );
    throw error;
  }
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
