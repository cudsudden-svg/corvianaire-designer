import { installGlobals } from "@remix-run/node";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// packages/shared has no build step — resolve straight to its TS source.
// tsconfig.json's "paths" (read via vite-tsconfig-paths below) covers
// type-checking; this resolve.alias is the belt-and-suspenders entry that
// makes sure the dev server and production build resolve it too.
const sharedSrc = path.resolve(__dirname, "../../packages/shared/src");

// Notify TS which Remix future flags are enabled, so route/loader types line up.
declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

installGlobals();

export default defineConfig(() => {
  return {
    server: {
      port: Number(process.env.PORT || 3000),
      // Required for the Shopify CLI tunnel (ngrok / Cloudflare tunnel) to proxy correctly.
      allowedHosts: process.env.HOST ? [process.env.HOST.replace(/^https?:\/\//, "")] : undefined,
    },
    plugins: [
      remix({
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          v3_singleFetch: true,
          v3_lazyRouteDiscovery: true,
        },
      }),
      tsconfigPaths(),
    ],
    resolve: {
      alias: {
        "@corvianaire/shared": sharedSrc,
      },
    },
    build: {
      assetsInlineLimit: 0,
    },
  } satisfies UserConfig;
});
