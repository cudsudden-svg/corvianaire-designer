# Product-loader feature

The only feature folder allowed to fetch Shopify product/variant data.
Nothing it returns is ever persisted — see product-loader.server.ts.

- `queries/admin-product.query.ts` — Admin GraphQL documents (used inside
  the embedded app: admin dashboard, print-zone/pricing product pickers).
- `queries/storefront-product.query.ts` — Storefront GraphQL documents
  (used by the theme app extension via the app proxy).
- `normalize-product.ts` — turns either API's raw response into the one
  shared `ShopifyProduct` shape (app/lib/types/product.ts), deriving
  available colors/sizes live from variants every time.
- `product-loader.server.ts` — the public API: `getProductAdmin()`,
  `listProductsAdmin()`, `getProductStorefront()`. Import from here, not
  from the query files or normalizer directly.
