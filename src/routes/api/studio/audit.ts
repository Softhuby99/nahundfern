import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql } from "@/lib/db.server";
import { requireAuth } from "@/lib/auth.server";

const Query = z.object({
  action: z.string().max(64).optional(),
  actionPrefix: z.string().max(32).optional(),
  requestId: z.string().max(128).optional(),
  userId: z.string().uuid().optional(),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const Route = createFileRoute("/api/studio/audit")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const url = new URL(request.url);
        const parsed = Query.safeParse({
          action: url.searchParams.get("action") ?? undefined,
          actionPrefix: url.searchParams.get("actionPrefix") ?? undefined,
          requestId: url.searchParams.get("requestId") ?? undefined,
          userId: url.searchParams.get("userId") ?? undefined,
          before: url.searchParams.get("before") ?? undefined,
          limit: url.searchParams.get("limit")
            ? Number(url.searchParams.get("limit"))
            : undefined,
        });
        if (!parsed.success) {
          return Response.json({ error: "Invalid query" }, { status: 400 });
        }
        const { action, actionPrefix, requestId, userId, before, limit } = parsed.data;

        // Compose predicates dynamically with postgres.js dynamic where. Keep
        // everything parameterised — no string interpolation into SQL.
        const rows = await sql`
          SELECT id, request_id, user_id, action, target_id, ip, user_agent,
                 email_hash, meta, created_at
          FROM audit_log
          WHERE 1=1
            ${action ? sql`AND action = ${action}` : sql``}
            ${actionPrefix ? sql`AND action LIKE ${actionPrefix + "%"}` : sql``}
            ${requestId ? sql`AND request_id = ${requestId}` : sql``}
            ${userId ? sql`AND user_id = ${userId}` : sql``}
            ${before ? sql`AND created_at < ${before}` : sql``}
          ORDER BY created_at DESC, id DESC
          LIMIT ${limit}
        `;
        return Response.json({ entries: rows });
      },
    },
  },
});
