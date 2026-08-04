# Corvianaire Studio

Embedded Shopify app for fully customizing Apliiq products before purchase,
built on the Shopify Remix template.

## Stage 2 — Storage & Product Data Layer (current)

- `AssetStorageProvider` interface (`app/features/storage/types.ts`) with
  a fully working `LocalStorageProvider` and a stubbed `S3StorageProvider`
  (structure + method signatures in place, upload/delete are documented
  TODOs). Switching providers is `STORAGE_PROVIDER=local|s3` in `.env` —
  no other code changes.
- Product data layer: `getProductAdmin()` (Admin GraphQL, used inside the
  embedded app) and `getProductStorefront()` (Storefront GraphQL, used by
  the storefront widget). Both normalize into one shared `ShopifyProduct`
  type — available colors/sizes are always derived live from variants,
  never stored.
- App proxy route (`/apps/studio/products/:handle`) so the theme app
  extension never talks to the Storefront API directly — the access token
  stays server-side.
- Theme App Extension scaffold (`extensions/customizer-block`) — the
  delivery mechanism for the customer-facing designer. Currently proves
  the data layer end-to-end (fetches and displays live product data); the
  real Fabric.js canvas mounts here in Stage 3.

### Additional setup for Stage 2

```bash
# Create a Storefront API access token (Admin > Settings > Apps and sales
# channels > Develop apps > your app > API credentials), add it to .env:
STOREFRONT_API_TOKEN=shpat_...
```

The extension needs to be registered with the CLI before it'll show up in
the theme editor:
```bash
npm run deploy   # or: shopify app deploy
```
Then in the Shopify admin theme editor, add the "Product Customizer"
block to a product page template.

## Stage 1 — Foundation

This stage sets up:
- Remix + TypeScript project scaffold (Vite-based, matching the current
  Shopify Remix app template)
- Shopify OAuth/session auth via `@shopify/shopify-app-remix`, with
  **Prisma-backed session storage** (not the in-memory default — survives
  restarts)
- Full Prisma schema covering every model the later stages need:
  `Session`, `Design`, `DesignView`, `UploadedAsset`, `PricingRule`,
  `PrintZone`, `ClipartCategory`, `ClipartAsset`
- Embedded app shell: Polaris `AppProvider`, App Bridge `NavMenu`, a
  placeholder home page showing build progress
- `app/uninstalled` webhook (required for App Store distribution)
- Shared TypeScript types for both live-fetched Shopify product data
  (`app/lib/types/product.ts`) and app-owned design data
  (`app/lib/types/design.ts`)
- Folder structure for every future feature module, each with a README
  noting which stage fills it in

**Nothing here stores Shopify product/variant catalog data.** That's a
hard rule carried through the whole project — product data is always
fetched live (Stage 2 builds the actual fetching layer).

## Setup

```bash
npm install
cp .env.example .env
# Fill in SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL from your
# Partner Dashboard app, and set DATABASE_URL (SQLite works out of the box).

npx prisma migrate dev --name init
npm run dev
```

`npm run dev` uses the Shopify CLI, which will prompt you to select your
existing app/dev store on first run, then open a tunnel and the embedded
app inside Shopify admin automatically.

## Switching to PostgreSQL for production

In `prisma/schema.prisma`, change:
```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```
Set `DATABASE_URL` to your Postgres connection string, then run
`npx prisma migrate deploy`. No model in the schema uses SQLite-only
types, so this is a one-line swap.

## Project structure

```
app/
  routes/              Remix routes (admin pages, auth, webhooks, API)
  lib/
    shopify/            Shopify app instance, auth
    db/                 Prisma client singleton
    types/               Shared TypeScript interfaces
  features/            One folder per feature domain (canvas-editor,
                        product-loader, pricing, clipart, admin, storage)
  components/shared/   Reusable cross-feature UI components
prisma/
  schema.prisma        Full data model
extensions/
  customizer-block/    Theme App Extension (storefront designer mount point)
```

## Build stages

1. **Foundation** ✅
2. **Storage & product data layer** ✅ — this stage
3. Core canvas editor
4. Text + image tools
5. Product-aware features (color switching, variants, pricing, print zones)
6. Persistence + live preview
7. Commerce (cart + order integration)
8. Admin dashboard
9. Performance, security, accessibility, mobile polish
10. Fulfillment provider abstraction (Printful/Printify/Apliiq/Gelato)
11. Docs
