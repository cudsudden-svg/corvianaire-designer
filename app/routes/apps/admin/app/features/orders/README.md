# Orders feature

Order integration (Stage 7) — the bridge between a real Shopify order and
the `Design` rows the customer built it from.

- `order.server.ts` — `processOrderWebhook()`, called from
  `app/routes/webhooks.orders.create.tsx`. Reads each line item's hidden
  `_design_id` property (set by the storefront widget's
  `commerce/add-to-cart.ts` at add-to-cart time), marks the matching
  Design `ORDERED`, and — if it has at least one production file —
  resolves a `SupplierProvider` (via `features/suppliers`) from the
  print zone attached to the design's first used view and submits it for
  production. A design with no production files yet is still marked
  `ORDERED` (visible in Stage 8's dashboard as needing manual attention)
  but production submission is skipped rather than calling a supplier
  with nothing to send.

Idempotent by construction: Shopify retries failed webhook deliveries,
and reprocessing an already-`ORDERED` design (or resubmitting to a
supplier) is a no-op in effect even though it isn't explicitly
deduplicated — there was no evidence a stronger guarantee was needed yet,
so this doesn't invent one.
