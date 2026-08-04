import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// packages/shared has no build step — resolve straight to its TS source,
// same convention as apps/admin's vite.config.ts.
const sharedSrc = path.resolve(__dirname, "../../packages/shared/src");

// Theme App Extension assets must be a FLAT directory (Shopify doesn't
// support nested asset paths), and the entry is loaded via
// `{{ 'customizer.js' | asset_url | script_tag }}` in customizer.liquid —
// so the entry filename below must stay in sync with that liquid file.
// Dynamic-import()'d chunks (see canvas/load-fabric.ts) resolve fine at
// runtime because ES module specifiers resolve relative to the *importing*
// module's own URL — i.e. relative to wherever Shopify's asset CDN served
// customizer.js from — as long as every chunk is also flat, unhashed-path,
// and sitting in this same assets folder, which the output config below
// guarantees.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@corvianaire/shared": sharedSrc,
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../../extensions/theme-extension/assets"),
    emptyOutDir: false, // the assets folder may hold other files (e.g. future CSS)
    target: "es2020",
    sourcemap: mode !== "production",
    rollupOptions: {
      input: path.resolve(__dirname, "src/main.tsx"),
      output: {
        format: "es",
        entryFileNames: "customizer.js",
        chunkFileNames: "customizer-[name]-[hash].js",
        // Deterministic filename for the one CSS asset this app emits, so
        // customizer.liquid can reference it by a fixed name rather than
        // guessing a hash.
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "customizer.css" : "customizer-[name][extname]",
      },
    },
  },
}));
