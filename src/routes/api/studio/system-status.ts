import { createFileRoute } from "@tanstack/react-router";
import fs from "node:fs/promises";
import path from "node:path";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth.server";

const APP_VERSION = (import.meta.env?.VITE_APP_VERSION as string | undefined) ?? "dev";
const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/app/uploads";
const BACKUPS_DIR = process.env.BACKUPS_DIR ?? "/backups";

// FS scans (uploads, backups) can be expensive on large volumes. Cache
// aggregated results in-process for 60s so a dashboard auto-refresh at 30s
// interval doesn't hammer disk.
type CacheEntry<T> = { at: number; value: T };
const CACHE_TTL_MS = 60_000;
const caches: { uploads?: CacheEntry<UploadsInfo>; backups?: CacheEntry<BackupsInfo> } = {};

type UploadsInfo = {
  totalBytes: number;
  byDir: Record<string, number>;
};

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await dirSize(full);
    else if (entry.isFile()) {
      try {
        total += (await fs.stat(full)).size;
      } catch {
        /* file vanished mid-walk — ignore */
      }
    }
  }
  return total;
}

async function readUploads(): Promise<UploadsInfo> {
  if (caches.uploads && Date.now() - caches.uploads.at < CACHE_TTL_MS) {
    return caches.uploads.value;
  }
  const parts = ["originals", "webp", "avif", "videos"];
  const byDir: Record<string, number> = {};
  let totalBytes = 0;
  for (const p of parts) {
    const size = await dirSize(path.join(UPLOADS_DIR, p));
    byDir[p] = size;
    totalBytes += size;
  }
  const info = { totalBytes, byDir };
  caches.uploads = { at: Date.now(), value: info };
  return info;
}

type BackupFile = {
  name: string;
  kind: "db" | "uploads" | "other";
  bytes: number;
  mtime: string;
  ok: boolean;
};
type BackupsInfo = {
  present: boolean;
  files: BackupFile[];
};

async function readBackups(): Promise<BackupsInfo> {
  if (caches.backups && Date.now() - caches.backups.at < CACHE_TTL_MS) {
    return caches.backups.value;
  }
  let entries: string[];
  try {
    entries = await fs.readdir(BACKUPS_DIR);
  } catch {
    const info = { present: false, files: [] as BackupFile[] };
    caches.backups = { at: Date.now(), value: info };
    return info;
  }
  const stats = await Promise.all(
    entries.map(async (name) => {
      try {
        const st = await fs.stat(path.join(BACKUPS_DIR, name));
        if (!st.isFile()) return null;
        const lower = name.toLowerCase();
        const kind: BackupFile["kind"] = /\.(sql|dump)(\.gz)?(\.gpg)?$/.test(lower)
          ? "db"
          : /uploads.*\.tar\.gz(\.gpg)?$/.test(lower)
            ? "uploads"
            : "other";
        return {
          name,
          kind,
          bytes: st.size,
          mtime: st.mtime.toISOString(),
          ok: st.size > 1024,
        };
      } catch {
        return null;
      }
    }),
  );
  const files = stats.filter((f): f is BackupFile => f !== null);
  files.sort((a, b) => b.mtime.localeCompare(a.mtime));
  const info = { present: true, files: files.slice(0, 20) };
  caches.backups = { at: Date.now(), value: info };
  return info;
}

export const Route = createFileRoute("/api/studio/system-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);

        const [{ db_bytes }] = await sql<{ db_bytes: string }[]>`
          SELECT pg_database_size(current_database())::text AS db_bytes
        `;
        const [{ started_at }] = await sql<{ started_at: Date }[]>`
          SELECT pg_postmaster_start_time() AS started_at
        `;
        const counts = await sql<{ table_name: string; c: string }[]>`
          SELECT 'trips' AS table_name, count(*)::text AS c FROM trips
          UNION ALL SELECT 'images', count(*)::text FROM images
          UNION ALL SELECT 'videos', count(*)::text FROM videos
          UNION ALL SELECT 'users', count(*)::text FROM users
          UNION ALL SELECT 'audit_log', count(*)::text FROM audit_log
        `;
        const dbCounts: Record<string, number> = {};
        for (const r of counts) dbCounts[r.table_name] = Number(r.c);

        const [uploads, backups] = await Promise.all([readUploads(), readBackups()]);

        return Response.json({
          app: {
            version: APP_VERSION,
            nodeVersion: process.version,
            uptimeSeconds: Math.round(process.uptime()),
            env: process.env.NODE_ENV ?? "unknown",
          },
          db: {
            bytes: Number(db_bytes),
            startedAt: started_at instanceof Date ? started_at.toISOString() : String(started_at),
            counts: dbCounts,
          },
          uploads,
          backups: {
            present: backups.present,
            files: backups.files,
            dir: BACKUPS_DIR,
            keepDays: process.env.BACKUP_KEEP_DAYS ?? "14",
            schedule: "Täglich (24h-Loop im backup-Container)",
          },
        });
      },
    },
  },
});
