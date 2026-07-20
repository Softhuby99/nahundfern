/**
 * Realer ffmpeg-Smoke-Test. Wird nur ausgeführt, wenn ffmpeg + ffprobe auf PATH
 * verfügbar sind (CI-Docker-Container). Erzeugt eine winzige 2 s-Testquelle,
 * trimmt sie auf 1 s und prüft die Ausgabe mit ffprobe.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function has(bin: string): boolean {
  const r = spawnSync(bin, ["-version"], { stdio: "ignore" });
  return r.status === 0;
}

const ffmpegOk = has("ffmpeg") && has("ffprobe");

describe.skipIf(!ffmpegOk)("videos ffmpeg integration", () => {
  it("trimmt eine 2s-Testquelle auf ~1s (H.264, faststart)", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vidtest-"));
    const src = path.join(dir, "src.mp4");
    const out = path.join(dir, "out.mp4");

    // 2s Testsignal (H.264/AAC).
    const mk = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-f",
        "lavfi",
        "-i",
        "testsrc=duration=2:size=320x240:rate=25",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=2",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        "-movflags",
        "+faststart",
        "-y",
        src,
      ],
      { stdio: "ignore" },
    );
    expect(mk.status).toBe(0);

    // Trim auf 1s.
    const trim = spawnSync(
      "ffmpeg",
      [
        "-hide_banner",
        "-nostdin",
        "-i",
        src,
        "-ss",
        "0.500",
        "-t",
        "1.000",
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
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
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-movflags",
        "+faststart",
        "-y",
        out,
      ],
      { stdio: "pipe" },
    );
    expect(trim.status).toBe(0);

    const probe = spawnSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_name:format=duration",
        "-of",
        "json",
        out,
      ],
      { encoding: "utf8" },
    );
    expect(probe.status).toBe(0);
    const j = JSON.parse(probe.stdout) as {
      streams: Array<{ codec_name: string }>;
      format: { duration: string };
    };
    expect(j.streams[0].codec_name).toBe("h264");
    const dur = Number(j.format.duration);
    expect(dur).toBeGreaterThan(0.7);
    expect(dur).toBeLessThan(1.5);

    fs.rmSync(dir, { recursive: true, force: true });
  }, 30_000);
});
