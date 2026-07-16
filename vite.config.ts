// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import packageJson from "./package.json" with { type: "json" };

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Build for self-hosted Node.js Docker deployment. Inside the Lovable sandbox
  // this preset is forced to cloudflare-module for preview, but on your own server
  // (docker compose build) it will be respected and produce a Node-compatible server.
  nitro: {
    preset: "node-server",
  },
  // Single source of truth for the app version: package.json#version. Exposed
  // to client and server bundles as the `__APP_VERSION__` compile-time
  // constant (see src/vite-env.d.ts).
  vite: {
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
  },
});
