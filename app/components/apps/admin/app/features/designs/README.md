# Designs feature

The only feature folder allowed to touch `Design`/`DesignView` directly.
This is the minimal slice of Stage 6 (Persistence + preview) that Stage 7's
commerce flow depends on — a customer's canvas state has to become a
durable row with an id before it can be attached to a cart line item or
looked up again from an order webhook. A full "My Designs" library UI is
still a Stage 8 concern.

- `design.server.ts` — `saveDesign()` (create-or-update, replace-in-place
  on the view list, uploads any freshly-rendered preview images),
  `getDesignForCustomer()` / `getDesignById()` (the latter has no
  ownership check — only `features/orders` calls it, which authenticates
  via webhook HMAC rather than a customer session), `markDesignOrdered()`.
- `production-file.server.ts` — stores the storefront widget's
  client-rendered, print-ready view exports (see
  `apps/storefront-widget/src/commerce/generate-production-files.ts`) via
  the existing `AssetStorageProvider`, no server-side rendering involved.

Both call sites are the app-proxy routes `proxy.designs.tsx`,
`proxy.designs.$id.tsx`, and `proxy.designs.$id.production-files.tsx`.
