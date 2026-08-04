import { createProxyClient } from "@corvianaire/shared/api";

// Matches the [app_proxy] prefix configured in apps/admin/shopify.app.toml.
// One client instance is reused for products (proxy.products.$handle.tsx),
// uploads (proxy.uploads.tsx), and clipart (proxy.clipart.tsx) — they all
// share the same "apps/studio" proxy base path.
const proxy = createProxyClient({ proxyBasePath: "/apps/studio" });

export const productClient = proxy;
export const uploadClient = proxy;
export const clipartClient = proxy;
export const designClient = proxy;
