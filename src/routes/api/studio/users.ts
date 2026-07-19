import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import postgres from "postgres";
import { sql } from "@/lib/db.server";
import { requireAuth, requireSameOrigin, hashPassword } from "@/lib/auth.server";
import { auditLog } from "@/lib/audit.server";

// NOTE: In v0.6.0 there are no roles yet — every authenticated user has full
// admin access. Rollout of user_roles/has_role is intentionally deferred.
// Until then, we prevent lockout by refusing self-delete and last-user delete.

const emailSchema = z.string().trim().email().max(255).toLowerCase();
// Length + at least one letter + at least one digit. Deliberately not overly
// prescriptive: 12+ chars beats character-class rules for real-world entropy.
const passwordSchema = z
  .string()
  .min(12, "Passwort muss mindestens 12 Zeichen haben")
  .max(256)
  .refine((s) => /[A-Za-z]/.test(s) && /[0-9]/.test(s), {
    message: "Passwort muss Buchstaben und Ziffern enthalten",
  });

const CreateInput = z.object({ email: emailSchema, password: passwordSchema });
const PatchInput = z
  .object({
    id: z.string().uuid(),
    email: emailSchema.optional(),
    password: passwordSchema.optional(),
  })
  .refine((d) => d.email || d.password, {
    message: "Nichts zu ändern",
  });

export const Route = createFileRoute("/api/studio/users")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const rows = await sql`
          SELECT id, email, created_at, last_login_at, last_login_ip
          FROM users
          ORDER BY created_at DESC
        `;
        return Response.json({ users: rows });
      },

      POST: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const body = await request.json().catch(() => null);
        const parsed = CreateInput.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid input", details: parsed.error.format() },
            { status: 400 },
          );
        }
        const { email, password } = parsed.data;
        const hash = await hashPassword(password);
        try {
          const [user] = await sql`
            INSERT INTO users (email, password_hash)
            VALUES (${email}, ${hash})
            RETURNING id, email, created_at
          `;
          await auditLog({
            request,
            userId: session.userId,
            action: "user.create",
            targetId: user.id,
            emailPlain: email,
          });
          return Response.json({ user }, { status: 201 });
        } catch (err) {
          if (err instanceof postgres.PostgresError && err.code === "23505") {
            return Response.json({ error: "E-Mail existiert bereits" }, { status: 409 });
          }
          throw err;
        }
      },

      PATCH: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const body = await request.json().catch(() => null);
        const parsed = PatchInput.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid input", details: parsed.error.format() },
            { status: 400 },
          );
        }
        const { id, email, password } = parsed.data;

        // Email change: unique-check via 23505 catch below.
        if (email) {
          try {
            const [row] = await sql`
              UPDATE users SET email = ${email} WHERE id = ${id}
              RETURNING id, email
            `;
            if (!row) return Response.json({ error: "User nicht gefunden" }, { status: 404 });
            await auditLog({
              request,
              userId: session.userId,
              action: "user.update.email",
              targetId: id,
              emailPlain: email,
            });
          } catch (err) {
            if (err instanceof postgres.PostgresError && err.code === "23505") {
              return Response.json({ error: "E-Mail existiert bereits" }, { status: 409 });
            }
            throw err;
          }
        }

        if (password) {
          const hash = await hashPassword(password);
          const [row] = await sql`
            UPDATE users SET password_hash = ${hash} WHERE id = ${id}
            RETURNING id
          `;
          if (!row) return Response.json({ error: "User nicht gefunden" }, { status: 404 });
          await auditLog({
            request,
            userId: session.userId,
            action: "user.update.password",
            targetId: id,
          });
        }

        return Response.json({ ok: true });
      },

      DELETE: async ({ request }) => {
        try {
          requireSameOrigin(request);
        } catch (r) {
          return r as Response;
        }
        const session = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get("id");
        const idParsed = z.string().uuid().safeParse(id);
        if (!idParsed.success) {
          return Response.json({ error: "Missing or invalid id" }, { status: 400 });
        }
        if (idParsed.data === session.userId) {
          return Response.json({ error: "Selbst-Löschung nicht erlaubt" }, { status: 400 });
        }
        const [{ count }] = await sql`SELECT count(*)::int AS count FROM users`;
        if (Number(count) <= 1) {
          return Response.json({ error: "Letzter User kann nicht gelöscht werden" }, { status: 400 });
        }
        const [row] = await sql`DELETE FROM users WHERE id = ${idParsed.data} RETURNING id, email`;
        if (!row) return Response.json({ error: "User nicht gefunden" }, { status: 404 });
        await auditLog({
          request,
          userId: session.userId,
          action: "user.delete",
          targetId: row.id,
          emailPlain: row.email,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
