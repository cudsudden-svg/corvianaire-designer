# Admin dashboard (Stage 8)

No models of its own — this feature module is UI + a few read-oriented
queries (`design.server.ts`'s `listDesigns`/`getDesignStats`/
`getDesignAdminDetail`, `order.server.ts`'s `retryProductionSubmission`)
layered on top of models every earlier stage already owns. The actual
route files live in `app/routes/app.*` per Remix convention, not here;
this folder just documents the feature as a whole:

- **Dashboard home** (`app._index.tsx`) — status counts, a "needs
  attention" banner for orders that never reached a supplier (Stage 7's
  `ORDERED` + no `supplierOrderId` case), and quick links into every
  other management page.
- **Saved Designs** (`app.designs._index.tsx` + `app.designs.$id.tsx`) —
  the "My Designs" library deferred from Stage 6/7, plus order search
  (by Shopify order id or supplier order id — there's no separate Order
  model; `Design.shopifyOrderId`/`supplierOrderId` ARE the order-tracking
  data). The detail page has a "Retry supplier submission" action for
  the needs-attention case.
- **Pricing Rules** (`app.pricing._index.tsx` + `app.pricing.$id.tsx`) —
  CRUD deferred from Stage 5; the matching/apply logic in
  `pricing-engine.server.ts`'s `computePrice()` is unchanged.
- **Suppliers** (`app.suppliers._index.tsx` + `app.suppliers.$id.tsx`) —
  the missing piece of Stage 5's "modular supplier structure": print
  zones and pricing already referenced `Supplier` rows, but nothing
  could create one until now. Slug picker is constrained to
  `IMPLEMENTED_SUPPLIER_SLUGS` (`manual`, `apliiq` today) so the UI can
  never offer a slug with no `SupplierProvider` behind it.
- **Clipart Library** (`app.clipart._index.tsx`) — a merchant-facing UI
  over `clipart.server.ts`'s existing functions. Upload validation
  reuses the exact same magic-byte sniffing + SVG sanitization as the
  customer-facing upload endpoint.

`app/lib/format.ts` (`formatCents`) and
`app/components/shared/StatusBadge.tsx` are small shared pieces used
across several of these pages.
