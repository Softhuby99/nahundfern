// Server-only helper: resolves the canonical origin used for CSRF / same-origin
// checks. Reads runtime `PUBLIC_BASE_URL` (set in docker-compose per env) with a
// safe fallback. Reading process.env at module scope is fine here because the
// app runs on a persistent Node/Bun process, not a serverless edge worker.

const FALLBACK = "https://nahundfern.servuswir.de";

export function getServerPublicOrigin(): string {
  const raw = process.env.PUBLIC_BASE_URL?.trim();
  try {
    const u = new URL(raw || FALLBACK);
    if (u.protocol !== "http:" && u.protocol !== "https:") return FALLBACK;
    return u.origin;
  } catch {
    return FALLBACK;
  }
}
