import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const MAX_BYTES = 150 * 1024 * 1024; // 150 MB
const MAX_DURATION_MS = 60_000; // 60s cap keeps transcoding costs bounded
const ALLOWED_INPUT_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);

export type VideoDirs = {
  root: string;
  originals: string;
  mp4: string;
  poster: string;
};

export async function ensureVideoDirs(): Promise<VideoDirs> {
  const dirs: VideoDirs = {
    root: UPLOADS_DIR,
    originals: path.join(UPLOADS_DIR, "videos", "originals"),
    mp4: path.join(UPLOADS_DIR, "videos", "mp4"),
    poster: path.join(UPLOADS_DIR, "videos", "poster"),
  };
  await fs.mkdir(dirs.originals, { recursive: true });
  await fs.mkdir(dirs.mp4, { recursive: true });
  await fs.mkdir(dirs.poster, { recursive: true });
  return dirs;
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c) => (stdout += c.toString()));
    child.stderr.on("data", (c) => (stderr += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

type ProbeResult = {
  durationMs: number;
  width: number;
  height: number;
};

async function ffprobe(file: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    file,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{ width?: number; height?: number }>;
    format?: { duration?: string };
  };
  const s = parsed.streams?.[0];
  if (!s || !s.width || !s.height) {
    throw new Error("Video ohne gültigen Videostream");
  }
  const durSec = Number(parsed.format?.duration ?? 0);
  if (!Number.isFinite(durSec) || durSec <= 0) {
    throw new Error("Video ohne gültige Dauer");
  }
  return {
    durationMs: Math.round(durSec * 1000),
    width: s.width,
    height: s.height,
  };
}

export type StoredVideo = {
  id: string;
  originalPath: string;
  mp4_720_path: string;
  posterPath: string;
  width: number;
  height: number;
  durationMs: number;
  bytes: number;
  mime: string;
};

/**
 * Persist an uploaded video: strip metadata via re-encode to H.264/AAC MP4
 * (browser-universal), extract a JPEG poster frame at ~1s.
 * Rejects too-large / too-long / wrong-container inputs before transcoding.
 */
export async function storeVideo(buffer: Buffer, originalName: string): Promise<StoredVideo> {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`Video zu groß (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB)`);
  }
  const inputExt = path.extname(originalName).toLowerCase();
  if (!ALLOWED_INPUT_EXT.has(inputExt)) {
    throw new Error(`Container nicht unterstützt: ${inputExt || "unbekannt"} (erlaubt: mp4, mov, webm, m4v)`);
  }

  const dirs = await ensureVideoDirs();
  const id = randomUUID();
  const originalDisk = path.join(dirs.originals, `${id}${inputExt}`);
  const mp4Disk = path.join(dirs.mp4, `${id}.mp4`);
  const posterDisk = path.join(dirs.poster, `${id}.jpg`);
  const created: string[] = [];

  try {
    await fs.writeFile(originalDisk, buffer);
    created.push(originalDisk);

    // Probe first so we can reject overlong clips BEFORE transcoding cost.
    const probe = await ffprobe(originalDisk);
    if (probe.durationMs > MAX_DURATION_MS) {
      throw new Error(`Video zu lang (max ${MAX_DURATION_MS / 1000}s)`);
    }

    // Transcode to a broadly compatible MP4:
    //  - H.264 baseline+ / yuv420p → plays on every browser + iOS Safari
    //  - AAC audio (or none)
    //  - +faststart → moov atom at file head, enables progressive playback
    //  - scale='min(1280,iw)':-2 → cap width at 1280px, keep aspect, even h
    //  - -map_metadata -1 → strip all container metadata (incl. GPS)
    await run("ffmpeg", [
      "-y",
      "-i",
      originalDisk,
      "-map_metadata",
      "-1",
      "-vf",
      "scale='min(1280,iw)':-2:flags=lanczos,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      mp4Disk,
    ]);
    created.push(mp4Disk);

    // Poster frame at 1s (or the very first frame for shorter clips).
    const posterAt = probe.durationMs >= 1500 ? "00:00:01" : "00:00:00";
    await run("ffmpeg", [
      "-y",
      "-ss",
      posterAt,
      "-i",
      mp4Disk,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      "-vf",
      "scale='min(1280,iw)':-2",
      posterDisk,
    ]);
    created.push(posterDisk);

    // Read final MP4 dimensions (may differ from source after scaling).
    const finalProbe = await ffprobe(mp4Disk);
    const bytes = (await fs.stat(mp4Disk)).size;

    return {
      id,
      originalPath: `/uploads/videos/originals/${id}${inputExt}`,
      mp4_720_path: `/uploads/videos/mp4/${id}.mp4`,
      posterPath: `/uploads/videos/poster/${id}.jpg`,
      width: finalProbe.width,
      height: finalProbe.height,
      durationMs: probe.durationMs,
      bytes,
      mime: "video/mp4",
    };
  } catch (err) {
    await Promise.allSettled(created.map((f) => fs.unlink(f).catch(() => {})));
    throw err;
  }
}

function toDiskPath(publicPath: string): string {
  const rel = publicPath.replace(/^\/uploads\//, "");
  return path.join(UPLOADS_DIR, rel);
}

export async function deleteVideoFiles(paths: {
  originalPath: string;
  mp4_720_path: string;
  posterPath: string;
}): Promise<void> {
  await Promise.allSettled(
    [paths.originalPath, paths.mp4_720_path, paths.posterPath].map(async (p) => {
      try {
        await fs.unlink(toDiskPath(p));
      } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException | undefined)?.code;
        if (code !== "ENOENT") console.error("deleteVideoFiles:", p, err);
      }
    }),
  );
}
