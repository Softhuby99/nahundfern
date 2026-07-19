import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import {
  DUMMY_ARGON2_HASH,
  createSessionToken,
  requestIsSecure,
  requireSameOrigin,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // CSRF: reject cross-origin submissions before doing any work.
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }

        const body = await request.json().catch(() => null);
        const parsed = LoginInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const { email, password } = parsed.data;
        const [user] = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;

        // Burn ~equal CPU whether or not the user exists so response times
        // don't leak account existence. Using a real Argon2 verify against a
        // pre-computed dummy hash is closer to constant-time than hashing a
        // throwaway password (which pays the salt-generation cost as well).
        if (!user) {
          await verifyPassword(DUMMY_ARGON2_HASH, password).catch(() => false);
          await auditLog({
            request,
            action: "auth.login.failure",
            emailPlain: email,
            meta: { reason: "unknown_email" },
          });
          return Response.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const valid = await verifyPassword(user.password_hash, password);
        if (!valid) {
          await auditLog({
            request,
            userId: user.id,
            action: "auth.login.failure",
            emailPlain: email,
            meta: { reason: "bad_password" },
          });
          return Response.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await createSessionToken(user.id);
        const isSecure = requestIsSecure(request);
        // Track last successful login for the User admin view. Prefer
        // X-Forwarded-For (nginx sets it), fall back to request headers.
        const xff = request.headers.get("x-forwarded-for");
        const ip = xff ? xff.split(",")[0].trim() : null;
        await sql`
          UPDATE users SET last_login_at = now(), last_login_ip = ${ip}
          WHERE id = ${user.id}
        `;
        await auditLog({
          request,
          userId: user.id,
          action: "auth.login.success",
          emailPlain: email,
        });
        return Response.json(
          { ok: true },
          {
            status: 200,
            headers: {
              "Set-Cookie": setSessionCookie(token, isSecure),
            },
          },
        );
      },
    },
  },
});
