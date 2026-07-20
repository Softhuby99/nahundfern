import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { sql } from "./db.server";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const MAX_BYTES = 150 * 1024 * 1024;
const MAX_DURATION_MS = 60_000;
const ALLOWED_INPUT_EXT = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const MAX_WIDTH = 3840;
const MAX_HEIGHT = 2160;
const MAX_FPS = 120;
const FFMPEG_TIMEOUT_MS = 120_000;
const STALE_LOCK_MINUTES = 5;

export type VideoDirs = {
  root: string;
  originals: string;
  mp4: string;
  mp4Tmp: string;
  poster: string;
  posterTmp: string;
};

export async function ensureVideoDirs(): Promise<VideoDirs> {
  const dirs: VideoDirs = {
    root: UPLOADS_DIR,
    originals: path.join(UPLOADS_DIR, "videos", "originals"),
    mp4: path.join(UPLOADS_DIR, "videos", "mp4"),
    mp4Tmp: path.join(UPLOADS_DIR, "videos", "mp4", ".tmp"),
    poster: path.join(UPLOADS_DIR, "videos", "poster"),
    posterTmp: path.join(UPLOADS_DIR, "videos", "poster", ".tmp"),
  };
  await fs.mkdir(dirs.originals, { recursive: true });
  await fs.mkdir(dirs.mp4Tmp, { recursive: true });
  await fs.mkdir(dirs.posterTmp, { recursive: true });
  return dirs;
}

// -------- process helper ---------------------------------------------------

/**
 * spawn() with argument array (never a shell string) + hard timeout + bounded
 * stdout/stderr. Also supports an AbortSignal for request-scoped cancellation.
 */
function run(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const cap = (buf: string, chunk: Buffer) =>
      (buf + chunk.toString()).slice(-10_000);
    child.stdout.on("data", (c: Buffer) => (stdout = cap(stdout, c)));
    child.stderr.on("data", (c: Buffer) => (stderr = cap(stderr, c)));

    let killed: "timeout" | "abort" | null = null;
    const timer = setTimeout(() => {
      killed = "timeout";
      child.kill("SIGKILL");
    }, opts.timeoutMs ?? FFMPEG_TIMEOUT_MS);

    const onAbort = () => {
      killed = "abort";
      child.kill("SIGKILL");
    };
    opts.signal?.addEventListener("abort", onAbort, { once: true });

    child.on("error", (e) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      if (killed === "timeout") {
        const err = new Error(`${cmd} exceeded ${opts.timeoutMs ?? FFMPEG_TIMEOUT_MS}ms`);
        (err as Error & { kind?: string }).kind = "timeout";
        return reject(err);
      }
      if (killed === "abort") {
        const err = new Error(`${cmd} aborted`);
        (err as Error & { kind?: string }).kind = "abort";
        return reject(err);
      }
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

// -------- ffprobe ----------------------------------------------------------

type ProbeResult = {
  durationMs: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoStreamCount: number;
};

export async function ffprobeFull(file: string): Promise<ProbeResult> {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=index,codec_type,width,height,r_frame_rate:format=duration",
    "-of",
    "json",
    file,
  ]);
  const parsed = JSON.parse(stdout) as {
    streams?: Array<{
      codec_type?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };
  const streams = parsed.streams ?? [];
  const vStreams = streams.filter((s) => s.codec_type === "video");
  const aStreams = streams.filter((s) => s.codec_type === "audio");
  const v = vStreams[0];
  if (!v || !v.width || !v.height) {
    throw new Error("Video ohne gültigen Videostream");
  }
  const durSec = Number(parsed.format?.duration ?? 0);
  if (!Number.isFinite(durSec) || durSec <= 0) {
    throw new Error("Video ohne gültige Dauer");
  }
  let fps = 0;
  const rate = v.r_frame_rate;
  if (rate && rate.includes("/")) {
    const [n, d] = rate.split("/").map(Number);
    if (n && d) fps = n / d;
  }
  return {
    durationMs: Math.round(durSec * 1000),
    width: v.width,
    height: v.height,
    fps,
    hasAudio: aStreams.length > 0,
    videoStreamCount: vStreams.length,
  };
}

// -------- versioned public URLs -------------------------------------------

export function mp4PublicUrl(id: string, version: number): string {
  return `/uploads/videos/mp4/${id}_v${version}.mp4`;
}
export function posterPublicUrl(id: string, version: number): string {
  return `/uploads/videos/poster/${id}_v${version}.jpg`;
}
export function mp4DiskPath(id: string, version: number, dirs: VideoDirs): string {
  return path.join(dirs.mp4, `${id}_v${version}.mp4`);
}
export function posterDiskPath(id: string, version: number, dirs: VideoDirs): string {
  return path.join(dirs.poster, `${id}_v${version}.jpg`);
}
export function toDiskPath(publicPath: string): string {
  const rel = publicPath.replace(/^\/uploads\//, "");
  return path.join(UPLOADS_DIR, rel);
}

// -------- upload / initial store ------------------------------------------

export type StoredVideo = {
  id: string;
  originalPath: string;
  mp4_720_path: string;
  posterPath: string;
  width: number;
  height: number;
  durationMs: number;
  originalDurationMs: number;
  bytes: number;
  mime: string;
  videoVersion: number;
  posterVersion: number;
};

export async function storeVideo(buffer: Buffer, originalName: string): Promise<StoredVideo> {
  if (buffer.length > MAX_BYTES) {
    throw new VideoError(413, `Video zu groß (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB)`);
  }
  const inputExt = path.extname(originalName).toLowerCase();
  if (!ALLOWED_INPUT_EXT.has(inputExt)) {
    throw new VideoError(
      422,
      `Container nicht unterstützt: ${inputExt || "unbekannt"} (erlaubt: mp4, mov, webm, m4v)`,
    );
  }

  const dirs = await ensureVideoDirs();
  const id = randomUUID();
  const originalDisk = path.join(dirs.originals, `${id}${inputExt}`);
  const mp4Disk = mp4DiskPath(id, 1, dirs);
  const posterDisk = posterDiskPath(id, 1, dirs);
  const created: string[] = [];

  try {
    await fs.writeFile(originalDisk, buffer);
    created.push(originalDisk);

    const probe = await ffprobeFull(originalDisk);
    validateInputLimits(probe);
    if (probe.durationMs > MAX_DURATION_MS) {
      throw new VideoError(422, `Video zu lang (max ${MAX_DURATION_MS / 1000}s)`);
    }

    await runFfmpegRender({
      inputPath: originalDisk,
      startMs: null,
      endMs: null,
      outPath: mp4Disk,
      hasAudio: probe.hasAudio,
    });
    created.push(mp4Disk);

    // Poster ~1s in
    const posterAtMs = probe.durationMs >= 1500 ? 1000 : 0;
    await runFfmpegPoster({
      inputPath: originalDisk,
      atMs: posterAtMs,
      outPath: posterDisk,
    });
    created.push(posterDisk);

    const finalProbe = await ffprobeFull(mp4Disk);
    const bytes = (await fs.stat(mp4Disk)).size;

    return {
      id,
      originalPath: `/uploads/videos/originals/${id}${inputExt}`,
      mp4_720_path: mp4PublicUrl(id, 1),
      posterPath: posterPublicUrl(id, 1),
      width: finalProbe.width,
      height: finalProbe.height,
      durationMs: probe.durationMs,
      originalDurationMs: probe.durationMs,
      bytes,
      mime: "video/mp4",
      videoVersion: 1,
      posterVersion: 1,
    };
  } catch (err) {
    await Promise.allSettled(created.map((f) => fs.unlink(f).catch(() => {})));
    throw err;
  }
}

function validateInputLimits(probe: ProbeResult): void {
  if (probe.videoStreamCount !== 1) {
    throw new VideoError(422, `Video muss genau einen Videostream haben (gefunden: ${probe.videoStreamCount})`);
  }
  if (probe.width > MAX_WIDTH || probe.height > MAX_HEIGHT) {
    throw new VideoError(422, `Auflösung zu hoch (max ${MAX_WIDTH}×${MAX_HEIGHT})`);
  }
  if (probe.fps > MAX_FPS) {
    throw new VideoError(422, `Bildrate zu hoch (max ${MAX_FPS} fps)`);
  }
}

// -------- ffmpeg render helpers -------------------------------------------

async function runFfmpegRender(opts: {
  inputPath: string;
  startMs: number | null;
  endMs: number | null;
  outPath: string;
  hasAudio: boolean;
  signal?: AbortSignal;
}): Promise<void> {
  const args: string[] = [
    "-hide_banner",
    "-nostdin",
    "-i",
    opts.inputPath,
  ];
  if (opts.startMs !== null && opts.endMs !== null) {
    const startSec = (opts.startMs / 1000).toFixed(3);
    const durSec = ((opts.endMs - opts.startMs) / 1000).toFixed(3);
    args.push("-ss", startSec, "-t", durSec);
  }
  args.push("-map", "0:v:0");
  if (opts.hasAudio) args.push("-map", "0:a:0?");
  args.push(
    "-sn",
    "-dn",
    "-map_metadata",
    "-1",
    "-vf",
    "scale=min(1280\\,iw):-2:flags=lanczos,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
  );
  if (opts.hasAudio) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-movflags", "+faststart", "-y", opts.outPath);
  await run("ffmpeg", args, { signal: opts.signal });
}

async function runFfmpegPoster(opts: {
  inputPath: string;
  atMs: number;
  outPath: string;
  signal?: AbortSignal;
}): Promise<void> {
  await run(
    "ffmpeg",
    [
      "-hide_banner",
      "-nostdin",
      "-ss",
      (opts.atMs / 1000).toFixed(3),
      "-i",
      opts.inputPath,
      "-frames:v",
      "1",
      "-q:v",
      "4",
      "-vf",
      "scale=min(1280\\,iw):-2",
      "-y",
      opts.outPath,
    ],
    { signal: opts.signal, timeoutMs: 30_000 },
  );
}

// -------- errors -----------------------------------------------------------

export class VideoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// -------- claim / release --------------------------------------------------

export type VideoRow = {
  id: string;
  trip_id: string;
  original_path: string;
  mp4_720_path: string;
  poster_path: string;
  width: number;
  height: number;
  duration_ms: number;
  bytes: number;
  mime: string;
  alt: string | null;
  sort_order: number;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  poster_at_ms: number | null;
  original_duration_ms: number | null;
  video_version: number;
  poster_version: number;
};

/**
 * Kurze Transaktion: markiert das Video als "in Bearbeitung" für den eigenen
 * Token. Nach Ablauf von STALE_LOCK_MINUTES kann ein neuer Job die Sperre
 * eines abgestürzten Vorgängers übernehmen. Gibt null zurück, wenn ein
 * anderer aktiver Job läuft.
 */
export async function claimVideo(id: string): Promise<{ row: VideoRow; token: string } | null> {
  const token = randomUUID();
  const rows = await sql<VideoRow[]>`
    UPDATE videos
       SET processing = true,
           processing_started_at = now(),
           processing_token      = ${token}
     WHERE id = ${id}
       AND (processing = false
            OR processing_started_at < now() - (${STALE_LOCK_MINUTES} || ' minutes')::interval)
     RETURNING *
  `;
  const row = rows[0];
  return row ? { row, token } : null;
}

export async function releaseVideo(id: string, token: string): Promise<void> {
  await sql`
    UPDATE videos
       SET processing = false,
           processing_started_at = NULL,
           processing_token = NULL
     WHERE id = ${id} AND processing_token = ${token}
  `;
}

/** Beim App-Start (oder einmalig pro Prozess) alte Sperren aufräumen. */
let cleanupDone = false;
export async function cleanupStaleLocksOnce(): Promise<void> {
  if (cleanupDone) return;
  cleanupDone = true;
  try {
    await sql`
      UPDATE videos
         SET processing = false,
             processing_started_at = NULL,
             processing_token = NULL
       WHERE processing = true
         AND processing_started_at < now() - interval '10 minutes'
    `;
  } catch (err) {
    console.warn("cleanupStaleLocks failed", err);
  }
}

// -------- trim & poster jobs ----------------------------------------------

export type TrimResult = {
  video: VideoRow;
  posterBumped: boolean;
};

/**
 * Trimmt (oder resetted, wenn beide null) IMMER aus dem Original.
 * Alle Filesystem-Änderungen erst nach ffprobe-Validierung; DB-Update in
 * kurzer Transaktion; alte Dateien best-effort danach.
 */
export async function trimVideo(opts: {
  id: string;
  startMs: number | null;
  endMs: number | null;
  signal?: AbortSignal;
}): Promise<TrimResult> {
  const claim = await claimVideo(opts.id);
  if (!claim) throw new VideoError(409, "Video wird bereits bearbeitet");
  const { row: initial, token } = claim;
  const originalDisk = toDiskPath(initial.original_path);

  try {
    // Nach dem Claim erneut lesen ist hier redundant (RETURNING liefert die
    // frisch gelockte Zeile), aber wir müssen sicherstellen, dass die
    // Original-Dauer bekannt ist.
    const row = await ensureOriginalDuration(initial, originalDisk);

    // Reset-Semantik: startMs=endMs=null → aus vollem Original rendern.
    let effectiveStart: number | null = opts.startMs;
    let effectiveEnd: number | null = opts.endMs;
    if (effectiveStart === null && effectiveEnd === null) {
      // Reset
    } else if (effectiveStart === null || effectiveEnd === null) {
      throw new VideoError(422, "Trim-Werte müssen beide Zahlen oder beide null sein");
    } else {
      if (effectiveStart < 0) throw new VideoError(422, "Startzeit darf nicht negativ sein");
      if (effectiveEnd <= effectiveStart)
        throw new VideoError(422, "Endzeit muss größer als Startzeit sein");
      if (effectiveEnd > (row.original_duration_ms ?? 0))
        throw new VideoError(422, "Endzeit liegt hinter dem Videoende");
      if (effectiveEnd - effectiveStart < 1000)
        throw new VideoError(422, "Verbleibende Dauer muss mindestens 1 Sekunde sein");
    }

    const dirs = await ensureVideoDirs();
    const originalProbe = await ffprobeFull(originalDisk);
    const newVideoVersion = row.video_version + 1;
    const tmpOut = path.join(dirs.mp4Tmp, `${row.id}-${randomUUID()}.mp4`);
    const finalOut = mp4DiskPath(row.id, newVideoVersion, dirs);

    try {
      await runFfmpegRender({
        inputPath: originalDisk,
        startMs: effectiveStart,
        endMs: effectiveEnd,
        outPath: tmpOut,
        hasAudio: originalProbe.hasAudio,
        signal: opts.signal,
      });
      const outProbe = await ffprobeFull(tmpOut);
      if (outProbe.durationMs <= 0) throw new VideoError(500, "Ausgabe-Video ungültig");
      await fs.rename(tmpOut, finalOut);

      const bytes = (await fs.stat(finalOut)).size;
      const newDurationMs = outProbe.durationMs;
      const newMp4Path = mp4PublicUrl(row.id, newVideoVersion);

      // Muss der Poster-Zeitpunkt neu gewählt werden?
      let newPosterVersion = row.poster_version;
      let newPosterPath = row.poster_path;
      let newPosterAtMs = row.poster_at_ms;
      let posterBumped = false;

      const trimStart = effectiveStart ?? 0;
      const trimEnd = effectiveEnd ?? row.original_duration_ms ?? newDurationMs;
      const posterOk =
        row.poster_at_ms !== null &&
        row.poster_at_ms >= trimStart &&
        row.poster_at_ms <= trimEnd;

      if (!posterOk) {
        const newPosterAtSource = Math.min(
          trimStart + Math.min(1000, Math.floor(newDurationMs / 2)),
          trimEnd,
        );
        newPosterVersion = row.poster_version + 1;
        const posterTmp = path.join(dirs.posterTmp, `${row.id}-${randomUUID()}.jpg`);
        const posterFinal = posterDiskPath(row.id, newPosterVersion, dirs);
        await runFfmpegPoster({
          inputPath: originalDisk,
          atMs: newPosterAtSource,
          outPath: posterTmp,
          signal: opts.signal,
        });
        await fs.rename(posterTmp, posterFinal);
        newPosterPath = posterPublicUrl(row.id, newPosterVersion);
        newPosterAtMs = newPosterAtSource;
        posterBumped = true;
      }

      const [updated] = await sql<VideoRow[]>`
        UPDATE videos SET
          mp4_720_path   = ${newMp4Path},
          poster_path    = ${newPosterPath},
          duration_ms    = ${newDurationMs},
          bytes          = ${bytes},
          width          = ${outProbe.width},
          height         = ${outProbe.height},
          trim_start_ms  = ${effectiveStart},
          trim_end_ms    = ${effectiveEnd},
          poster_at_ms   = ${newPosterAtMs},
          video_version  = ${newVideoVersion},
          poster_version = ${newPosterVersion}
        WHERE id = ${row.id}
        RETURNING *
      `;

      // Best-effort: alte Ableitungen löschen (Fehler nur loggen).
      if (row.mp4_720_path && row.mp4_720_path !== newMp4Path) {
        fs.unlink(toDiskPath(row.mp4_720_path)).catch(() => {});
      }
      if (posterBumped && row.poster_path && row.poster_path !== newPosterPath) {
        fs.unlink(toDiskPath(row.poster_path)).catch(() => {});
      }

      return { video: updated, posterBumped };
    } catch (err) {
      await fs.unlink(tmpOut).catch(() => {});
      // Wenn finalOut angelegt wurde aber DB fehlschlug → auch entfernen.
      await fs.unlink(finalOut).catch(() => {});
      throw err;
    }
  } finally {
    await releaseVideo(opts.id, token);
  }
}

/**
 * Poster-Wechsel: atMs bezieht sich auf die AKTUELL SICHTBARE (getrimmte) Zeit.
 * Server rechnet in Originalzeit um, rendert Frame aus Original.
 */
export async function updatePoster(opts: {
  id: string;
  visibleAtMs: number;
  signal?: AbortSignal;
}): Promise<VideoRow> {
  const claim = await claimVideo(opts.id);
  if (!claim) throw new VideoError(409, "Video wird bereits bearbeitet");
  const { row: initial, token } = claim;
  const originalDisk = toDiskPath(initial.original_path);

  try {
    const row = await ensureOriginalDuration(initial, originalDisk);
    if (opts.visibleAtMs < 0) throw new VideoError(422, "Posterzeit ungültig");
    if (opts.visibleAtMs > row.duration_ms)
      throw new VideoError(422, "Posterzeit liegt hinter dem sichtbaren Videoende");

    const posterAtSource = (row.trim_start_ms ?? 0) + opts.visibleAtMs;
    if (posterAtSource > (row.original_duration_ms ?? Infinity))
      throw new VideoError(422, "Posterzeit liegt hinter dem Original");

    const dirs = await ensureVideoDirs();
    const newVersion = row.poster_version + 1;
    const tmpOut = path.join(dirs.posterTmp, `${row.id}-${randomUUID()}.jpg`);
    const finalOut = posterDiskPath(row.id, newVersion, dirs);

    try {
      await runFfmpegPoster({
        inputPath: originalDisk,
        atMs: posterAtSource,
        outPath: tmpOut,
        signal: opts.signal,
      });
      const st = await fs.stat(tmpOut);
      if (st.size <= 0) throw new VideoError(500, "Poster-Ausgabe leer");
      await fs.rename(tmpOut, finalOut);

      const newPosterPath = posterPublicUrl(row.id, newVersion);
      const [updated] = await sql<VideoRow[]>`
        UPDATE videos SET
          poster_path    = ${newPosterPath},
          poster_at_ms   = ${posterAtSource},
          poster_version = ${newVersion}
        WHERE id = ${row.id}
        RETURNING *
      `;
      if (row.poster_path && row.poster_path !== newPosterPath) {
        fs.unlink(toDiskPath(row.poster_path)).catch(() => {});
      }
      return updated;
    } catch (err) {
      await fs.unlink(tmpOut).catch(() => {});
      await fs.unlink(finalOut).catch(() => {});
      throw err;
    }
  } finally {
    await releaseVideo(opts.id, token);
  }
}

async function ensureOriginalDuration(row: VideoRow, originalDisk: string): Promise<VideoRow> {
  if (row.original_duration_ms != null) return row;
  const probe = await ffprobeFull(originalDisk);
  await sql`UPDATE videos SET original_duration_ms = ${probe.durationMs} WHERE id = ${row.id}`;
  return { ...row, original_duration_ms: probe.durationMs };
}

// -------- delete ----------------------------------------------------------

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
