import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { getServerPublicOrigin } from "./public-origin.server";


const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = "HS256";
const COOKIE_NAME = "nahundfern_session";

export type Session = {
  userId: string;
};

function getSecret() {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(JWT_SECRET);
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** Determine whether the current request is served over HTTPS. */
export function requestIsSecure(request: Request): boolean {
  // In production we always mark the cookie Secure to avoid accidentally
  // downgrading to a plaintext channel when a proxy header is missing.
  if (isProduction()) return true;
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  // Fallback for reverse proxies that forward the original HTTPS port
  // (e.g. OPNsense / some nginx setups) but omit X-Forwarded-Proto.
  if (request.headers.get("x-forwarded-port") === "443") return true;
  return new URL(request.url).protocol === "https:";
}

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// Pre-computed Argon2id hash of a fixed string. Used to burn ~equal CPU when
// verifying a login for a non-existent email so response times don't leak
// which addresses have accounts. Regenerate with the same argon2 params if
// you tighten `hashPassword` — otherwise the timing gap re-opens.
export const DUMMY_ARGON2_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$D6yihvzVMlbQMkPI/YdmYw$FzlZM4qrNhu9H93009O+C0UdZXtboD4B/12zvy626BM";

/**
 * Reject cross-origin write requests. For POST/PATCH/PUT/DELETE we require
 * that either the Origin/Referer matches our public origin OR that
 * Sec-Fetch-Site is `same-origin` / `same-site`. Safe methods pass through.
 *
 * Throws a Response(403) for the route handler to propagate.
 */
export function requireSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;

  const publicOrigin = getServerPublicOrigin();
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const secFetchSite = request.headers.get("sec-fetch-site");

  // Modern browsers set Sec-Fetch-Site — trust it when present.
  if (secFetchSite === "same-origin" || secFetchSite === "same-site") return;

  const check = (value: string | null): boolean => {
    if (!value) return false;
    try {
      return new URL(value).origin === publicOrigin;
    } catch {
      return false;
    }
  };

  if (check(origin) || check(referer)) return;

  throw new Response("Forbidden: cross-origin request rejected", { status: 403 });
}


export async function createSessionToken(userId: string): Promise<string> {
  // Keep the token as small as possible: only the subject identifier. Any
  // additional user data (email, name, role) is fetched from the DB on demand.
  return new SignJWT({})
    .setProtectedHeader({ alg: JWT_ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .setAudience("nahundfern")
    .setIssuer("nahundfern")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<Session> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: [JWT_ALGORITHM],
    audience: "nahundfern",
    issuer: "nahundfern",
  });
  const sub = payload.sub ?? (payload as { userId?: unknown }).userId;
  if (typeof sub !== "string" || sub.length === 0) {
    throw new Error("Invalid session token payload");
  }
  return { userId: sub };
}

export function parseSessionCookie(request: Request): string | undefined {
  const cookie = request.headers.get("cookie");
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function requireAuth(request: Request): Promise<Session> {
  const token = parseSessionCookie(request);
  if (!token) {
    throw new Response("Unauthorized", { status: 401 });
  }
  try {
    return await verifySessionToken(token);
  } catch {
    throw new Response("Unauthorized", { status: 401 });
  }
}

export function setSessionCookie(token: string, secure: boolean): string {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${60 * 60 * 24 * 7}`];
  if (secure || isProduction()) flags.push("Secure");
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; ${flags.join("; ")}`;
}

export function clearSessionCookie(secure: boolean): string {
  const flags = ["Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (secure || isProduction()) flags.push("Secure");
  return `${COOKIE_NAME}=; ${flags.join("; ")}`;
}
