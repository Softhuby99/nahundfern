import fs from "node:fs/promises";
import path from "node:path";
import sharp, { type ResizeOptions } from "sharp";
import { randomUUID } from "node:crypto";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";

const SIZES = [400, 1200, 2000] as const;

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

export async function storeImage(buffer: Buffer, originalName: string): Promise<StoredImage> {
  const dirs = await ensureUploadDirs();
  const id = randomUUID();
  const ext = path.extname(originalName).toLowerCase() || ".jpg";
  const originalFileName = `${id}${ext}`;
  const originalPath = path.join(dirs.originals, originalFileName);

  // Apply EXIF orientation and read metadata.
  const processed = sharp(buffer).rotate();
  await processed.toFile(originalPath);
  const metadata = await sharp(originalPath).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const mime = metadata.format ? `image/${metadata.format}` : "image/jpeg";

  const webp: Record<number, string> = {};
  const avif: Record<number, string> = {};

  for (const size of SIZES) {
    const resizeOptions: ResizeOptions = {
      width: size,
      withoutEnlargement: true,
      fit: "inside",
    };

    const webpPath = path.join(dirs.webp, `${id}_${size}.webp`);
    await sharp(originalPath)
      .resize(resizeOptions)
      .webp({ quality: 80, effort: 4 })
      .toFile(webpPath);
    webp[size] = `/uploads/webp/${id}_${size}.webp`;

    const avifPath = path.join(dirs.avif, `${id}_${size}.avif`);
    await sharp(originalPath)
      .resize(resizeOptions)
      .avif({ quality: 70, effort: 4 })
      .toFile(avifPath);
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

export async function deleteImageFiles(stored: ImagePaths) {
  const dirs = await ensureUploadDirs();
  const files = [
    path.join(dirs.root, stored.originalPath),
    ...Object.values(stored.webp).map((p) => path.join(dirs.root, p)),
    ...Object.values(stored.avif).map((p) => path.join(dirs.root, p)),
  ];
  await Promise.all(
    files.map(async (f) => {
      try {
        await fs.unlink(f);
      } catch {
        // ignore missing files
      }
    }),
  );
}

export function imagePathsFromRow(row: {
  original_path: string;
  webp_400: string;
  webp_1200: string;
  webp_2000: string;
  avif_400: string;
  avif_1200: string;
  avif_2000: string;
}): ImagePaths["webp"] & ImagePaths["avif"] & { original: string } {
  return {
    original: row.original_path,
    400: row.webp_400,
    1200: row.webp_1200,
    2000: row.webp_2000,
  };
}
