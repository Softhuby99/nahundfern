/// <reference types="vite/client" />

// Injected by Vite `define` in vite.config.ts from package.json#version.
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_PUBLIC_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
