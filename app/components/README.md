# Corvianaire Studio

Shopify app for fully customizing Apliiq products before purchase.

## Stage 8 — Admin dashboard (current)

### Restored: Stage 6's full persistence system

The richer draft/autosave/checkpoint/guest-login-conflict system (autosave
while editing, a "My Designs" checkpoint library, careful guest→account
handoff at login) was present as files — Prisma schema fields, the full
`design.server.ts` service, every `proxy.designs.*` route, and the
widget's `persistence/` hooks and components all existed — but **`App.tsx`
imported `useDesignDraft`, `useLoginDraftConflict`, `LoginConflictPrompt`,
and `SaveCheckpointControl` without ever calling or rendering any of
them**, and never passed `customerId` through despite declaring it in
its own props. The autosaving draft and the add-to-cart save were two
completely disconnected code paths — `AddToCartPanel` maintained its own
local, ephemeral design id and created a second, unrelated `Design` row
on every add-to-cart rather than reusing the draft the customer had
already been autosaving into.

Fixed by actually wiring the pieces together in `App.tsx`
(`useDesignDraft`, `useLoginDraftConflict`, rendering
`LoginConflictPrompt` and `SaveCheckpointControl`, passing `designId`
into both `CanvasStage` and `AddToCartPanel`), and updating
`AddToCartPanel` to accept that `designId` and finalize the same draft
row instead of managing an independent one. Confirmed `saveDesign()`
already handles this correctly on its own — reusing an existing `DRAFT`
row promotes it to `SAVED` — so no service-layer change was needed, only
the missing wiring.

### Fixed after review

- **Two Stage 7 bugs had regressed** — this upload was built from a
  pre-fix baseline again. Reapplied both: the webhook idempotency guard
  in `order.server.ts` (without it, a redelivered `orders/create` could
  place a second real production order with the supplier), and the
  crop-before-scale fix in `render-view-image.ts` (without it, every
  production file and preview came out oversized with the artwork
  shifted off-frame).
- **"Delete designs" and "Reassign designs" (Phase 18) were entirely
  missing** — the dashboard had view/search/preview/download but no
  delete or reassign action anywhere, despite both being explicit
  requirements. Added `deleteDesignAdmin()` and `reassignDesignCustomer()`
  to `design.server.ts` (both shop-scoped, matching every other function
  in this file), wired into `app.designs.$id.tsx` with a confirmation
  prompt on delete and a customer-id field on reassign. Delete also
  best-effort removes each view's stored preview/production files
  through the storage provider — that needed a small addition to the
  storage layer itself: `AssetStorageProvider` had no way to go from a
  stored URL back to a deletable key, so `keyFromUrl()` (the inverse of
  `getUrl()`) and a `deleteByUrl()` convenience helper were added to
  `features/storage/`, implemented in both the local and S3 providers.

Wires up the Polaris pages every earlier stage deferred to "the admin
dashboard" — no new Prisma models; this is UI plus a few read-oriented
queries over what Stages 1–7 already built. See
`apps/admin/app/features/admin/README.md` for the full breakdown. Nav
(`app.tsx`) now links to all five management pages.

- **Dashboard home** (`app._index.tsx`) replaces the Stage 1 placeholder
  stage-list with real status counts and a "needs attention" banner for
  the Stage 7 stuck-supplier-submission case (`ORDERED` with no
  `supplierOrderId`).
- **Saved Designs** — the "My Designs" library deferred from Stage 6/7,
  plus order search. There's no separate `Order` model; `Design`'s
  `shopifyOrderId`/`supplierOrderId` fields are the order-tracking data,
  so order search lives here rather than a standalone Orders page. The
  detail page adds a "Retry supplier submission" action
  (`retryProductionSubmission()` in `order.server.ts`) for designs that
  got marked `ORDERED` but never reached a supplier.
- **Pricing Rules** CRUD (`app.pricing.*`) — deferred from Stage 5;
  `computePrice()`'s matching logic is unchanged, this only adds
  create/edit/delete over the same `PricingRule` rows it already read.
- **Suppliers** CRUD (`app.suppliers.*`) — the missing half of Stage 5's
  "modular supplier structure." Print zones and pricing already
  referenced `Supplier` rows via a picker; nothing could create one
  until now. The provider dropdown is constrained to
  `IMPLEMENTED_SUPPLIER_SLUGS` so it can never offer a slug with no
  `SupplierProvider` class behind it.
- **Clipart Library** management (`app.clipart._index.tsx`) — a
  merchant-facing UI over `clipart.server.ts`'s functions (already built
  in Stage 4 for exactly this). Upload validation reuses the same
  magic-byte sniffing + SVG sanitization path as the customer-facing
  upload endpoint — a merchant-supplied SVG renders in this page's grid
  too, so it's no less deserving of sanitization.

No migration needed — every model this stage manages (`PricingRule`,
`Supplier`, `Design`) already existed in the schema.

## Stage 7 — Commerce: cart, order integration, production files

Builds on Stage 5's print zones/pricing and adds the minimal slice of
Stage 6 (Persistence + preview) that commerce actually depends on — a
design has to be a durable, id-bearing row before it can ride along on a
cart line item or get looked up again from an order webhook. A full
"My Designs" library/reopen UI is still a Stage 8 concern.

- **Design persistence** (`apps/admin/app/features/designs/`) —
  `saveDesign()` creates or updates a `Design` + its `DesignView` rows in
  one transaction, replacing the view list in place (a view with no
  canvas content simply isn't written — its absence, not an
  empty-but-present row, is what "not customized" means downstream).
  Reached via `POST /apps/studio/designs` and
  `GET /apps/studio/designs/:id` (`proxy.designs.tsx`,
  `proxy.designs.$id.tsx`).
- **Preview + production renders** — both are the *same* client-side
  render path (`apps/storefront-widget/src/commerce/render-view-image.ts`
  — a headless, off-DOM `fabric.StaticCanvas` that can render any view's
  saved `canvasJson`, not just whichever one `CanvasStage` currently has
  mounted), just at different export scales: previews at `multiplier: 1`
  (`commerce/save-design.ts`), production files at
  `productionRenderMultiplier(zone)` — a new
  `packages/shared/src/utils/print-zones.ts` helper that scales the whole
  canvas so its safe area lands at exactly
  `physicalWidthIn/HeightIn × targetDpi` pixels
  (`commerce/generate-production-files.ts`, uploaded via
  `POST /apps/studio/designs/:id/production-files`). Rendering stays
  client-side on purpose — the admin app has no native image/canvas
  library in its dependency tree (same reasoning as
  `image-dimensions.server.ts`), and re-implementing Fabric's rendering
  server-side would just be a second, divergent path for no accuracy
  gain.
- **Cart integration** (`apps/storefront-widget/src/commerce/add-to-cart.ts`,
  `AddToCartPanel.tsx`) — the widget is a Theme App Extension block on
  Shopify's own product page, so "add to cart" is Shopify's own AJAX Cart
  API (`/cart/add.js`), not a custom endpoint; the customized line item
  behaves like any other for cart drawers, upsells, discount codes, etc.
  The design's id rides along as a hidden `_design_id` line item property
  (Shopify excludes `_`-prefixed properties from customer-facing
  cart/checkout/order UI automatically) alongside a visible
  `Customization` property listing which views were used. The panel's
  flow — save design → best-effort generate production files → add to
  cart — never lets a production-render hiccup block checkout; a design
  short on production files is still purchasable and just shows up in
  Stage 8's dashboard as needing attention.
- **Order integration** (`apps/admin/app/features/orders/`,
  `webhooks.orders.create.tsx`) — the `orders/create` webhook subscription
  was already scaffolded in `shopify.app.toml` back in Stage 1; this is
  its real handler. Reads each line item's `_design_id`, marks the
  matching `Design` `ORDERED`, and — if it has production files — resolves
  a `SupplierProvider` from the print zone attached to the design's first
  used view (same "manual is a fully supported default" fallback chain as
  `getSupplierProviderForZone`) and calls `submitProductionOrder()`. A
  supplier API failure is caught and logged rather than failing the
  webhook — Shopify retries non-2xx deliveries, which would just
  resubmit; the design stays `ORDERED` with no `supplierOrderId`,
  flaggable in Stage 8 as needing manual follow-up.
- New `Design` fields: `shopifyOrderId`, `supplierOrderId`,
  `productionSubmittedAt` — added for this stage; run
  `npx prisma migrate dev` to apply.

## Stage 5 — Product-aware features: print zones, pricing, color/variant, DPI

- **Merchant print zone editor** (`apps/admin/app/routes/app.print-zones._index.tsx`
  + `app.print-zones.$productId.tsx`) — a numeric form (not a visual
  drag/resize editor; that's the customer-facing Studio's job) covering
  safe/bleed geometry, physical print size (in), target DPI, allowed file
  formats, and an optional supplier assignment, per view, per product.
  Backed by `features/print-zones/print-zone.server.ts`. A product with
  no configured zones is a valid, non-error state — it just isn't
  customizable yet, and the widget says so rather than guessing geometry.
- **Real `ViewConfigurationProvider`** — `LivePrintZoneProvider`
  (`apps/storefront-widget/src/config/view-configuration-provider.ts`)
  replaces Stage 3's hardcoded fallback, fetching real per-product zones
  via `GET /apps/studio/print-zones/:productId`. Zero changes needed in
  `App.tsx`/`ViewTabs`/`CanvasStage` beyond consuming the interface, exactly
  as designed back in Stage 3.
- **Safe/bleed overlay + live DPI warnings** — `use-fabric-canvas.ts` draws
  each view's safe/bleed rects as non-interactive guide overlays (never
  persisted into history — see the `suppressPersistRef` guard) and
  recalculates effective DPI live as an image is scaled, using the zone's
  real physical size and target DPI
  (`packages/shared/src/utils/print-zones.ts` — `checkArtworkDpi`), not a
  static canvas-pixel assumption.
- **Color switching** (`canvas/VariantSelector.tsx`) — color/size/quantity
  resolve to a real Shopify variant ID from live product data; selecting a
  color swaps only the canvas's background image, never touching design
  objects, so placement survives a color change untouched.
- **Pricing engine** (`features/pricing/pricing-engine.server.ts` +
  `POST /apps/studio/pricing`) — reads `PricingRule` rows and applies
  every rule matching the current design context (views used, technique,
  font tier, asset type), returning a full breakdown. No rules configured
  yet is a valid state — returns base price unchanged. CRUD UI for
  managing rules is deferred to Stage 8; the widget already calls this
  live and shows the computed price.
- **Modular supplier structure** (`features/suppliers/`) — a
  `SupplierProvider` interface (`getProductionSpec`,
  `submitProductionOrder`, `checkOrderStatus`) with `ManualSupplierProvider`
  (fully working — production is a human handling files, tracked as
  "manual") and a stubbed `ApliiqSupplierProvider` (real API calls are a
  Stage 7 concern). A `Supplier` Prisma row can optionally be attached to
  a print zone; secrets are never stored in `configJson` — providers read
  them from named env vars, same pattern as `STOREFRONT_API_TOKEN`.

## Stage 4 — Text + image tools + clipart library

Builds on Stage 3's canvas core. Every tool below adds to the canvas
through one shared path (`useFabricCanvas().addObject()` in
`apps/storefront-widget/src/canvas/use-fabric-canvas.ts`, extracted from
what used to be inline in `CanvasStage`) so text/upload/clipart never
duplicate canvas.add()/setActiveObject()/renderAll() wiring, and every new
object still flows through the existing per-view undo/redo history from
Stage 3 unchanged.

- **Text tool** (`apps/storefront-widget/src/text/text-renderer.ts` +
  `src/tools/TextToolPanel.tsx`) — standard Fabric IText editing: font
  family/size, bold/italic/underline, color, alignment, drop shadow,
  stroke outline. Curved text is **not** implemented as a custom engine;
  the `TextStyle.curved` flag and a disabled "Coming soon" toggle already
  exist so Stage 5 only has to implement the rendering path, not touch any
  call site.
- **Image upload tool** (`src/tools/ImageUploadTool.tsx` +
  `src/tools/image-trim.ts`) — uploads through the new
  `POST /apps/studio/uploads` app-proxy route
  (`apps/admin/app/routes/proxy.uploads.tsx`), which validates real file
  bytes (magic-byte sniffing, not just declared Content-Type), reads pixel
  dimensions with a dependency-free parser
  (`apps/admin/app/features/storage/image-dimensions.server.ts` — PNG/
  JPEG/WEBP/SVG, no native image library), stores via the existing
  `AssetStorageProvider` (works unchanged against S3 later), and persists
  an `UploadedAsset` row. Auto-trim scans transparent/near-white edges
  client-side; crop is an axis-aligned interactive overlay using Fabric's
  native `cropX/cropY/width/height` (rotate-then-crop is a documented
  follow-up, not yet supported). **SVG uploads are sanitized**
  (`apps/admin/app/features/uploads/sanitize-svg.server.ts` — strips
  `<script>`, `on*` event handler attributes, `javascript:`/
  `data:text/html` URIs, `<foreignObject>`, and comments) immediately
  after MIME sniffing and before the file ever touches storage or gets
  rendered anywhere. The same sanitizer runs on merchant-uploaded clipart
  SVGs in `clipart.server.ts`.
- **Clipart library** (`src/tools/ClipartLibrary.tsx`) — served from
  `GET /apps/studio/clipart` (`apps/admin/app/routes/proxy.clipart.tsx`),
  backed by the `ClipartCategory`/`ClipartAsset` Prisma models that were
  already in the Stage 1 schema. `apps/admin/app/features/clipart/clipart.server.ts`
  is the only file that touches those models directly — the widget only
  ever sees the proxy route's JSON. `prisma/seed.ts` seeds the 9 categories
  (Animals, Nature, Sports, Gaming, Music, Abstract, Minimal, Streetwear,
  Icons) with one curated original SVG each from `app/features/clipart/seed-assets/`;
  run it with `npx prisma db seed` (or automatically after
  `prisma migrate dev`).

## Stage 3 — Monorepo restructure + core canvas editor

As of Stage 3 this is an npm-workspaces monorepo:

```
apps/
  admin/                 ← Remix embedded app (was the whole repo through Stage 2)
  storefront-widget/     ← React + Vite app — the customer-facing canvas editor
packages/
  shared/                ← Types, API client, geometry/print-zone utils — no build step
extensions/
  theme-extension/       ← Theme App Extension (was extensions/customizer-block)
    assets/              ← BUILD OUTPUT from apps/storefront-widget — don't hand-edit
```

- **packages/shared** exports its TypeScript source directly via
  package.json `exports` + each consumer's tsconfig `paths`/Vite
  `resolve.alias` — no separate build/watch step. `apps/admin`'s local
  `app/lib/types/{product,design}.ts` are now thin re-exports of this
  package, so nothing else in the admin app's imports had to change.
- **apps/storefront-widget** is a standalone React app, independent from
  the embedded admin app, sharing only `packages/shared`. It builds
  straight into `extensions/theme-extension/assets/customizer.js` (+
  `.css`) — the exact files `customizer.liquid` loads via a
  `<script type="module">` tag. Fabric.js is lazy-loaded via a dynamic
  `import()` (see `src/canvas/load-fabric.ts`) so it's a separate chunk
  that only downloads once a customer opens the editor.
- **Canvas editor core**: Fabric.js per-view canvas + a Zustand store
  (`src/store/design-store.ts`) that gives every print view (front, back,
  left-sleeve, right-sleeve, hood, neck-label) its **own independent
  undo/redo history**. Switching views never touches another view's stack.
- **View availability**: which print views exist for a given product isn't
  wired to real per-product config until Stage 5. Until then, a
  `FallbackViewConfigurationProvider` (explicitly marked dev-only in its
  own file) returns the full hardcoded view list for every product. The
  editor only ever depends on the `ViewConfigurationProvider` interface —
  swapping in the real, product-aware implementation in Stage 5 is a
  one-line change in `apps/storefront-widget/src/main.tsx`.

### Building the widget

```bash
npm install
npm run widget:build   # writes extensions/theme-extension/assets/customizer.{js,css}
npm run admin:build    # or: npm run build (does both, widget first)
```

Local widget dev server (Fabric.js editor only, without the Liquid host page):

```bash
npm run widget:dev
```

## Stage 2 — Storage & Product Data Layer

- `AssetStorageProvider` interface (`apps/admin/app/features/storage/types.ts`)
  with a working `LocalStorageProvider` and a stubbed `S3StorageProvider`.
  Switching providers is `STORAGE_PROVIDER=local|s3` in `.env`.
- Product data layer: `getProductAdmin()` / `getProductStorefront()`,
  normalized into one shared `ShopifyProduct` type (now living in
  `packages/shared`).
- App proxy route so the theme extension never talks to the Storefront
  API directly.

## Stage 1 — Foundation

Remix + TypeScript scaffold, Shopify OAuth with Prisma-backed session
storage, the full Prisma schema, embedded app shell, and the feature-module
folder structure. See `apps/admin/README.md` for the original Stage 1/2
details specific to the admin app.

## Setup

```bash
npm install
cp apps/admin/.env.example apps/admin/.env
# Fill in SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL,
# STOREFRONT_API_TOKEN, and DATABASE_URL (SQLite works out of the box).

cd apps/admin && npx prisma migrate dev --name init && npx prisma db seed && cd ../..
npm run admin:dev   # Shopify CLI: tunnel + embedded app
npm run widget:dev  # separate terminal, for widget-only iteration
```
