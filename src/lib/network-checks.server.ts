import { Resolver } from "node:dns/promises";
import https from "node:https";
import net from "node:net";

export const DEFAULT_HOSTS = ["tdh.servuswir.de", "nahundfern.servuswir.de"];

export function defaultInternalDns(): string {
  return process.env.INTERNAL_DNS_IP || "192.168.3.1";
}
export function defaultExternalDns(): string {
  return process.env.EXTERNAL_DNS_IP || "1.1.1.1";
}

export type CheckResult = {
  hostname: string;
  scope: "internal" | "external";
  dns_server: string;
  dns_ips: string[];
  dns_error: string | null;
  dns_ms: number | null;
  http_target: string | null;
  http_status: number | null;
  http_ms: number | null;
  http_error: string | null;
  tls_ok: boolean | null;
  tls_error: string | null;
};

async function resolveVia(server: string, hostname: string) {
  const r = new Resolver({ timeout: 4000, tries: 1 });
  r.setServers([server]);
  const t = Date.now();
  try {
    const ips = await r.resolve4(hostname);
    return { ips, error: null, ms: Date.now() - t };
  } catch (e) {
    return { ips: [] as string[], error: (e as Error).message, ms: Date.now() - t };
  }
}

function httpProbe(ip: string, hostname: string) {
  return new Promise<{
    status: number | null;
    ms: number;
    error: string | null;
    tlsOk: boolean | null;
    tlsError: string | null;
  }>((resolve) => {
    const t = Date.now();
    const req = https.request(
      {
        host: ip,
        port: 443,
        method: "HEAD",
        path: "/",
        servername: hostname,
        headers: { Host: hostname, "User-Agent": "nahundfern-netcheck" },
        rejectUnauthorized: false,
        timeout: 6000,
      },
      (res) => {
        const sock = res.socket as import("node:tls").TLSSocket;
        const err = sock.authorizationError;
        resolve({
          status: res.statusCode ?? null,
          ms: Date.now() - t,
          error: null,
          tlsOk: sock.authorized === true,
          tlsError: err ? String(err) : null,
        });
        res.resume();
      },
    );
    req.on("timeout", () => req.destroy(new Error("Zeitüberschreitung (6s)")));
    req.on("error", (e) =>
      resolve({ status: null, ms: Date.now() - t, error: e.message, tlsOk: null, tlsError: null }),
    );
    req.end();
  });
}

export function isValidIp(s: string): boolean {
  return net.isIP(s) !== 0;
}

export async function runCheck(
  hostname: string,
  scope: "internal" | "external",
  dnsServer: string,
): Promise<CheckResult> {
  const dns = await resolveVia(dnsServer, hostname);
  const base: CheckResult = {
    hostname,
    scope,
    dns_server: dnsServer,
    dns_ips: dns.ips,
    dns_error: dns.error,
    dns_ms: dns.ms,
    http_target: null,
    http_status: null,
    http_ms: null,
    http_error: dns.ips.length ? null : "Kein HTTP-Test: DNS lieferte keine IP",
    tls_ok: null,
    tls_error: null,
  };
  const ip = dns.ips[0];
  if (!ip) return base;
  const h = await httpProbe(ip, hostname);
  return {
    ...base,
    http_target: `https://${ip}:443 (SNI ${hostname})`,
    http_status: h.status,
    http_ms: h.ms,
    http_error: h.error,
    tls_ok: h.tlsOk,
    tls_error: h.tlsError,
  };
}
