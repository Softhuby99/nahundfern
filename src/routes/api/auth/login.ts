import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth.server";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const Route = createFileRoute("/api/auth/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json();
        const parsed = LoginInput.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const { email, password } = parsed.data;
        const [user] = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
        if (!user) {
          // Hash anyway to avoid timing attacks revealing user existence.
          await hashPassword("dummy");
          return Response.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const valid = await verifyPassword(user.password_hash, password);
        if (!valid) {
          return Response.json({ error: "Invalid credentials" }, { status: 401 });
        }

        const token = await createSessionToken(user.id);
        const isSecure = request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
        return Response.json({ ok: true }, {
          status: 200,
          headers: {
            "Set-Cookie": setSessionCookie(token, isSecure),
          },
        });
      },
    },
  },
});
