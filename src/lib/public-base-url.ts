// Resolves the public base URL used for absolute canonical / og / twitter
// URLs. Reads ONLY `VITE_PUBLIC_BASE_URL` (baked in at build time by Vite) so
// the same helper works identically in SSR and in the browser bundle.
//
// The Docker build receives PUBLIC_BASE_URL and forwards it as
// VITE_PUBLIC_BASE_URL — see Dockerfile and docker-compose.yml.

const DEFAULT_PUBLIC_BASE_URL = "https://nahundfern.servuswir.de";

export function getPublicBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL?.trim();
  try {
    const url = new URL(configured || DEFAULT_PUBLIC_BASE_URL);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_PUBLIC_BASE_URL;
    }
    // `.origin` drops any trailing path/query/hash so callers can safely
    // `new URL(relative, baseUrl)` without duplicate segments.
    return url.origin;
  } catch {
    return DEFAULT_PUBLIC_BASE_URL;
  }
}

export function absoluteUrl(pathOrUrl: string, baseUrl = getPublicBaseUrl()): string {
  return new URL(pathOrUrl, baseUrl).toString();
}
