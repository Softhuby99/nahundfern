import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { sql, isDbConfigured } from "@/lib/db.server";
import { requireAuth, requireSameOrigin } from "@/lib/auth.server";

const Body = z.object({ notes: z.string().max(20000).default("") });

const SYSTEM = `Du bist Netzwerk-Experte für Heim-/Kleinbüro-Setups mit OPNsense (Nginx Reverse Proxy, Unbound DNS), Docker und nginx.
Setup: OPNsense-LAN 192.168.3.1 terminiert HTTPS 443 für nahundfern.servuswir.de (Upstream WebSrv-1 192.168.2.20:443) und tdh.servuswir.de (Upstream 192.168.2.20:8443). Interne Clients sollen per Unbound Host Override auf 192.168.3.1 auflösen.
Analysiere die Messwerte und Admin-Eingaben. Antworte auf Deutsch in Markdown mit genau zwei Abschnitten:
## Wahrscheinliche Ursache
## Konkrete Handlungsschritte
Sei knapp, nenne konkrete OPNsense-Menüpfade/Befehle. Maximal ca. 350 Wörter. Wiederhole niemals Passwörter oder Geheimnisse aus den Eingaben.`;

export const Route = createFileRoute("/api/studio/network-diagnose")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        requireSameOrigin(request);
        await requireAuth(request);
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "KI-Diagnose nicht eingerichtet: LOVABLE_API_KEY fehlt in der .env." },
            { status: 500 },
          );
        }
        const parsed = Body.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return Response.json({ error: "Ungültige Eingabe" }, { status: 400 });

        let latest: unknown[] = [];
        if (isDbConfigured()) {
          latest = await sql`
            SELECT hostname, scope, dns_server, dns_ips, dns_error, dns_ms, http_target,
                   http_status, http_ms, http_error, tls_ok, tls_error, created_at
            FROM network_checks
            WHERE run_id = (SELECT run_id FROM network_checks ORDER BY created_at DESC LIMIT 1)
          `;
        }
        const user = `Letzte Server-Messung (aus Sicht von WebSrv-1):\n${JSON.stringify(latest, null, 2)}\n\nEingaben des Administrators (nslookup, curl, Fehlermeldungen):\n${parsed.data.notes || "(keine)"}`;

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          signal: request.signal,
          headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "fetch",
          },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            store: false,
            reasoning: { effort: "medium" },
            input: [
              { role: "system", content: SYSTEM },
              { role: "user", content: user },
            ],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          let msg = text;
          try {
            const j = JSON.parse(text);
            msg = j.message || j.error?.message || j.error || text;
          } catch {
            /* keep text */
          }
          const nice =
            upstream.status === 402
              ? "KI-Guthaben aufgebraucht. Bitte Credits im Lovable-Workspace aufladen."
              : upstream.status === 429
                ? "Zu viele Anfragen – bitte kurz warten und erneut versuchen."
                : `KI-Anfrage fehlgeschlagen (${upstream.status}): ${String(msg).slice(0, 300)}`;
          return Response.json({ error: nice }, { status: upstream.status });
        }

        const reader = upstream.body.getReader();
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(ctrl) {
            let buf = "";
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                let idx;
                while ((idx = buf.indexOf("\n")) >= 0) {
                  const line = buf.slice(0, idx).trim();
                  buf = buf.slice(idx + 1);
                  if (!line.startsWith("data:")) continue;
                  const data = line.slice(5).trim();
                  if (!data || data === "[DONE]") continue;
                  try {
                    const ev = JSON.parse(data);
                    if (ev.type === "response.output_text.delta" && ev.delta) {
                      ctrl.enqueue(enc.encode(ev.delta));
                    } else if (ev.type === "response.failed" || ev.type === "error") {
                      ctrl.enqueue(enc.encode("\n\n[Fehler: Analyse abgebrochen]"));
                    }
                  } catch {
                    /* partial line */
                  }
                }
              }
            } catch {
              /* client aborted */
            }
            ctrl.close();
          },
          cancel() {
            reader.cancel().catch(() => {});
          },
        });
        const headers = new Headers({ "Content-Type": "text/plain; charset=utf-8" });
        upstream.headers.forEach((v, k) => {
          if (k.toLowerCase().startsWith("x-lovable-aig-")) headers.set(k, v);
        });
        return new Response(stream, { headers });
      },
    },
  },
});
