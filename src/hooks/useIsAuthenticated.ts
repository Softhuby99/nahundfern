import { useEffect, useState } from "react";

// Module-level cache so multiple mounted headers / navigations do not
// hammer /api/auth/me. `null` = unknown/loading.
let cached: boolean | null = null;
let inflight: Promise<boolean> | null = null;
const listeners = new Set<(v: boolean | null) => void>();

const EVENT_NAME = "nahundfern:auth-changed";

async function fetchStatus(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      const ok = res.ok;
      cached = ok;
      return ok;
    } catch {
      cached = false;
      return false;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

function notify() {
  for (const cb of listeners) cb(cached);
}

export function invalidateAuth() {
  cached = null;
  notify();
  void fetchStatus().then(notify);
}

if (typeof window !== "undefined") {
  window.addEventListener(EVENT_NAME, () => invalidateAuth());
}

export function emitAuthChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

export function useIsAuthenticated(): boolean | null {
  const [state, setState] = useState<boolean | null>(cached);

  useEffect(() => {
    listeners.add(setState);
    if (cached === null) {
      void fetchStatus().then(() => setState(cached));
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}
