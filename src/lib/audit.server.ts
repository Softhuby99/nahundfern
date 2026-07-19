// Append-only audit log for sensitive Studio actions.
// Never stores raw email / password / tokens — email is SHA-256 hashed so we
// can correlate events for the same account without leaking PII to backups.

import { createHash, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { sql } from "./db.server";

export type AuditAction =
  | "auth.login.success"
  | "auth.login.failure"
  | "auth.logout"
  | "trip.create"
  | "trip.update"
  | "trip.delete"
  | "trip.publish"
  | "trip.unpublish"
  | "image.upload"
  | "image.update"
  | "image.delete"
  | "video.upload"
  | "video.update"
  | "video.delete"
  | "user.create"
  | "user.update.email"
  | "user.update.password"
  | "user.delete";

export type AuditContext = {
  request: Request;
  userId?: string | null;
  action: AuditAction;
  targetId?: string | null;
  emailPlain?: string | null;
  meta?: Record<string, unknown> | null;
};

export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

// Extract the first hop from X-Forwarded-For, falling back to X-Real-IP.
// Only returns a value if it parses as IPv4 or IPv6 — never trust arbitrary
// header content in the DB.
export function clientIp(request: Request): string | null {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && isIP(first)) return first;
  }
  const real = request.headers.get("x-real-ip")?.trim();
  if (real && isIP(real)) return real;
  return null;
}

export function requestId(request: Request): string {
  const provided = request.headers.get("x-request-id")?.trim();
  if (provided && provided.length <= 128) return provided;
  return randomUUID();
}

export async function auditLog(ctx: AuditContext): Promise<void> {
  try {
    const ip = clientIp(ctx.request);
    const ua = ctx.request.headers.get("user-agent")?.slice(0, 500) ?? null;
    const emailHash = hashEmail(ctx.emailPlain);
    const reqId = requestId(ctx.request);
    const meta = ctx.meta ? JSON.stringify(ctx.meta) : null;

    await sql`
      INSERT INTO audit_log (request_id, user_id, action, target_id, ip, user_agent, email_hash, meta)
      VALUES (${reqId}, ${ctx.userId ?? null}, ${ctx.action}, ${ctx.targetId ?? null},
              ${ip}, ${ua}, ${emailHash}, ${meta}::jsonb)
    `;
  } catch (err) {
    // Never let audit-log failures break the primary action; just warn.
    console.warn("audit_log insert failed", err);
  }
}
