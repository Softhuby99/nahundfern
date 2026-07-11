import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ALGORITHM = "HS256";
const COOKIE_NAME = "nahundfern_session";

export type Session = {
  userId: string;
  email: string;
};

function getSecret() {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(JWT_SECRET);
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

export async function createSessionToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: JWT_ALGORITHM })
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
  if (!payload.userId || typeof payload.userId !== "string" || !payload.email || typeof payload.email !== "string") {
    throw new Error("Invalid session token payload");
  }
  return { userId: payload.userId, email: payload.email };
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
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}
