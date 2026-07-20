import { useEffect, useRef, useState } from "react";

export type StudioVideo = {
  id: string;
  trip_id: string;
  mp4_720_path: string;
  poster_path: string;
  original_path: string;
  width: number;
  height: number;
  duration_ms: number;
  original_duration_ms: number | null;
  bytes: number;
  alt: string | null;
  sort_order: number;
  trim_start_ms: number | null;
  trim_end_ms: number | null;
  poster_at_ms: number | null;
  video_version: number;
  poster_version: number;
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

async function postJson(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
}

async function readError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return data.error ?? `Fehler ${res.status}`;
  } catch {
    return `Fehler ${res.status}`;
  }
}

/** Upload with XHR to get progress + a two-phase status: upload → processing. */
function uploadVideo(
  file: File,
  tripId: string,
  onPhase: (phase: "upload" | "processing", pct: number) => void,
): Promise<{ video: StudioVideo }> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("tripId", tripId);
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/studio/videos");
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onPhase("upload", Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => onPhase("processing", 0);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Ungültige Server-Antwort"));
        }
      } else {
        let msg = `Upload fehlgeschlagen (${xhr.status})`;
        try {
          const d = JSON.parse(xhr.responseText);
          if (d?.error) msg = d.error;
        } catch {
          /* ignore */
        }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error("Netzwerkfehler beim Upload"));
    xhr.send(form);
  });
}

export function VideoEditor({ tripId }: { tripId: string }) {
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{
    phase: "upload" | "processing";
    pct: number;
    done: number;
    total: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/studio/videos?tripId=${tripId}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setVideos(d.videos ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [tripId]);

  const uploadBatch = async (files: File[]) => {
    setError("");
    for (let i = 0; i < files.length; i++) {
      try {
        const { video } = await uploadVideo(files[i], tripId, (phase, pct) =>
          setUploadStatus({ phase, pct, done: i, total: files.length }),
        );
        setVideos((v) => [...v, video]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
      }
    }
    setUploadStatus(null);
  };

  const deleteVideo = async (id: string) => {
    if (!confirm("Video wirklich löschen?")) return;
    const res = await fetch(`/api/studio/videos?id=${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!res.ok) {
      setError(await readError(res));
      return;
    }
    setVideos((v) => v.filter((x) => x.id !== id));
  };

  const updateVideo = (v: StudioVideo) => {
    setVideos((list) => list.map((x) => (x.id === v.id ? v : x)));
  };

  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
        Videos
      </label>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
        multiple
        disabled={uploadStatus !== null}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) uploadBatch(files);
          if (fileRef.current) fileRef.current.value = "";
        }}
        className="block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:bg-primary file:text-primary-foreground file:font-mono file:text-[10px] file:uppercase file:tracking-widest hover:file:bg-primary/90 disabled:opacity-50"
      />
      <p className="mt-1 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
        MP4/MOV/WebM · max 150 MB · max 60 s
      </p>
      {uploadStatus && (
        <div className="mt-3">
          <div className="h-2 w-full bg-card border border-border rounded-sm overflow-hidden">
            <div
              className="h-full bg-primary transition-[width] duration-150 ease-out"
              style={{
                width: `${uploadStatus.phase === "processing" ? 100 : uploadStatus.pct}%`,
              }}
            />
          </div>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Video {uploadStatus.done + 1} von {uploadStatus.total} ·{" "}
            {uploadStatus.phase === "upload"
              ? `Hochladen ${uploadStatus.pct}%`
              : "Video wird verarbeitet …"}
          </p>
        </div>
      )}
      {error && <p className="text-destructive font-mono text-xs mt-3">{error}</p>}
      {loading && (
        <p className="mt-4 font-mono text-xs text-muted-foreground">Videos werden geladen …</p>
      )}
      <div className="mt-6 space-y-6">
        {videos.map((v) => (
          <VideoRow key={v.id} video={v} onUpdate={updateVideo} onDelete={deleteVideo} />
        ))}
      </div>
    </div>
  );
}

function VideoRow({
  video,
  onUpdate,
  onDelete,
}: {
  video: StudioVideo;
  onUpdate: (v: StudioVideo) => void;
  onDelete: (id: string) => void;
}) {
  const [alt, setAlt] = useState(video.alt ?? "");
  const [sortOrder, setSortOrder] = useState(video.sort_order);
  const [busy, setBusy] = useState<null | string>(null);
  const [msg, setMsg] = useState("");
  const [start, setStart] = useState(video.trim_start_ms ?? 0);
  const [end, setEnd] = useState(video.trim_end_ms ?? video.duration_ms);
  const [posterAt, setPosterAt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Bezugswerte: für den Trim-Slider brauchen wir die Original-Dauer (fällt beim
  // ersten Bearbeiten via ffprobe an; solange NULL zeigen wir die aktuelle Dauer).
  const trimMax = video.original_duration_ms ?? video.duration_ms;

  useEffect(() => {
    setStart(video.trim_start_ms ?? 0);
    setEnd(video.trim_end_ms ?? trimMax);
  }, [video.trim_start_ms, video.trim_end_ms, trimMax]);

  const runAction = async (label: string, fn: () => Promise<Response>) => {
    setBusy(label);
    setMsg("");
    try {
      const res = await fn();
      if (!res.ok) {
        setMsg(await readError(res));
        return;
      }
      const data = await res.json();
      if (data.video) onUpdate(data.video);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Fehler");
    } finally {
      setBusy(null);
    }
  };

  const saveMeta = () =>
    runAction("meta", () =>
      fetch("/api/studio/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: video.id, alt, sortOrder }),
        credentials: "same-origin",
      }),
    );

  const applyTrim = () =>
    runAction("trim", () =>
      postJson("/api/studio/videos/trim", { id: video.id, startMs: start, endMs: end }),
    );

  const resetTrim = () =>
    runAction("trim", () =>
      postJson("/api/studio/videos/trim", { id: video.id, startMs: null, endMs: null }),
    );

  const applyPoster = () =>
    runAction("poster", () => postJson("/api/studio/videos/poster", { id: video.id, atMs: posterAt }));

  return (
    <div className="border border-border rounded-sm p-4 space-y-3">
      <div className="flex gap-4 flex-wrap">
        <video
          ref={videoRef}
          controls
          preload="metadata"
          poster={video.poster_path}
          src={video.mp4_720_path}
          className="w-64 max-w-full bg-black rounded-sm"
        />
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Dauer: {fmt(video.duration_ms)} · {(video.bytes / 1024 / 1024).toFixed(1)} MB · v
            {video.video_version}/p{video.poster_version}
          </div>
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary">
            Alt-Text
          </label>
          <input
            type="text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            className="w-full bg-card border border-border focus:border-primary p-2 rounded-sm text-sm"
          />
          <label className="block font-mono text-[10px] uppercase tracking-widest text-primary">
            Reihenfolge
          </label>
          <input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-24 bg-card border border-border focus:border-primary p-2 rounded-sm text-sm"
          />
          <div className="flex gap-2 pt-1">
            <button
              onClick={saveMeta}
              disabled={busy !== null}
              className="px-3 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 disabled:opacity-50 rounded-sm"
            >
              {busy === "meta" ? "…" : "Speichern"}
            </button>
            <button
              onClick={() => onDelete(video.id)}
              disabled={busy !== null}
              className="px-3 py-2 border border-border text-destructive font-mono text-[10px] tracking-widest uppercase hover:border-destructive disabled:opacity-50 rounded-sm"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>

      {/* Trim */}
      <div className="border-t border-border pt-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          Trim (bezogen aufs Original, {fmt(trimMax)})
        </p>
        <div className="grid grid-cols-2 gap-3 items-end">
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Start ({fmt(start)})
            </span>
            <input
              type="range"
              min={0}
              max={trimMax}
              step={100}
              value={start}
              onChange={(e) => {
                const v = Math.min(Number(e.target.value), end - 1000);
                setStart(v);
                if (videoRef.current) videoRef.current.currentTime = v / 1000;
              }}
              className="w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Ende ({fmt(end)})
            </span>
            <input
              type="range"
              min={0}
              max={trimMax}
              step={100}
              value={end}
              onChange={(e) => {
                const v = Math.max(Number(e.target.value), start + 1000);
                setEnd(v);
                if (videoRef.current) videoRef.current.currentTime = v / 1000;
              }}
              className="w-full"
            />
          </label>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={applyTrim}
            disabled={busy !== null || end - start < 1000}
            className="px-3 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 disabled:opacity-50 rounded-sm"
          >
            {busy === "trim" ? "Verarbeite …" : "Trim anwenden"}
          </button>
          <button
            onClick={resetTrim}
            disabled={busy !== null}
            className="px-3 py-2 border border-border font-mono text-[10px] tracking-widest uppercase hover:border-primary disabled:opacity-50 rounded-sm"
          >
            Trim zurücksetzen
          </button>
        </div>
      </div>

      {/* Poster */}
      <div className="border-t border-border pt-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">
          Poster (sichtbare Zeit, {fmt(video.duration_ms)})
        </p>
        <input
          type="range"
          min={0}
          max={video.duration_ms}
          step={100}
          value={posterAt}
          onChange={(e) => {
            const v = Number(e.target.value);
            setPosterAt(v);
            if (videoRef.current) videoRef.current.currentTime = v / 1000;
          }}
          className="w-full"
        />
        <div className="flex items-center gap-3 mt-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {fmt(posterAt)}
          </span>
          <button
            onClick={applyPoster}
            disabled={busy !== null}
            className="px-3 py-2 bg-primary text-primary-foreground font-mono text-[10px] tracking-widest uppercase hover:bg-primary/90 disabled:opacity-50 rounded-sm"
          >
            {busy === "poster" ? "Verarbeite …" : "Aktuellen Frame als Poster"}
          </button>
        </div>
      </div>

      {msg && <p className="text-destructive font-mono text-xs">{msg}</p>}
    </div>
  );
}
