import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sql, isDbConfigured } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";
import {
  DEFAULT_HOSTS,
  defaultExternalDns,
  defaultInternalDns,
  isValidIp,
  runCheck,
} from "@/lib/network-checks.server";

const Body = z.object({
  internalDns: z.string().max(45).refine(isValidIp, "Ungültige interne DNS-IP").optional(),
  externalDns: z.string().max(45).refine(isValidIp, "Ungültige externe DNS-IP").optional(),
});

export const Route = createFileRoute("/api/studio/network")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAuth(request);
        const defaults = {
          internalDns: defaultInternalDns(),
          externalDns: defaultExternalDns(),
          hosts: DEFAULT_HOSTS,
        };
        if (!isDbConfigured()) return Response.json({ defaults, entries: [] });
        const entries = await sql`
          SELECT * FROM network_checks ORDER BY created_at DESC, id DESC LIMIT 100
        `;
        return Response.json({ defaults, entries });
      },
      POST: async ({ request }) => {
        requireSameOrigin(request);
        const session = await requireAuth(request);
        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
        }
        const internalDns = parsed.data.internalDns || defaultInternalDns();
        const externalDns = parsed.data.externalDns || defaultExternalDns();
        const results = await Promise.all(
          DEFAULT_HOSTS.flatMap((h) => [
            runCheck(h, "internal", internalDns),
            runCheck(h, "external", externalDns),
          ]),
        );
        const runId = randomUUID();
        if (isDbConfigured()) {
          for (const r of results) {
            await sql`
              INSERT INTO network_checks (run_id, user_id, hostname, scope, dns_server, dns_ips,
                dns_error, dns_ms, http_target, http_status, http_ms, http_error, tls_ok, tls_error)
              VALUES (${runId}, ${session.userId}, ${r.hostname}, ${r.scope}, ${r.dns_server},
                ${r.dns_ips}, ${r.dns_error}, ${r.dns_ms}, ${r.http_target}, ${r.http_status},
                ${r.http_ms}, ${r.http_error}, ${r.tls_ok}, ${r.tls_error})
            `;
          }
        }
        return Response.json({ runId, results });
      },
    },
  },
});
