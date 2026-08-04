// SupplierProvider — the ONE contract every fulfillment/production
// partner implements (Apliiq, Printful, Printify, Gelato, custom APIs —
// Phase 24, brought forward because PrintZone production specs need a
// real source). Adding a new supplier is: a new Supplier DB row (see
// prisma/schema.prisma) + a new class implementing this interface + one
// line in supplier-provider.server.ts's factory switch. Nothing else in
// the app should ever import a specific supplier's SDK/API client
// directly.
//
// Secret handling contract: a provider receives its config via
// `configJson` (opaque per-provider shape) PLUS resolved secrets from
// environment variables it names itself — raw API keys/tokens are never
// stored in the database. A provider's constructor documents exactly
// which env vars it expects (see ApliiqSupplierProvider for the pattern).

export interface ProductionSpec {
  /** Physical safe-area size, inches — mirrors PrintZone's own fields, but this is the SUPPLIER's source of truth when available. */
  physicalWidthIn: number;
  physicalHeightIn: number;
  bleedMarginIn: number;
  targetDpi: number;
  allowedFileFormats: string[];
}

export interface SubmitProductionOrderInput {
  shopDomain: string;
  designId: string;
  shopifyOrderId: string;
  /** One production-ready file per print view actually used. */
  productionFiles: Array<{ viewName: string; fileUrl: string }>;
}

export interface SubmitProductionOrderResult {
  /** Supplier's own order/job identifier, for status polling later. */
  supplierOrderId: string;
}

export type ProductionOrderStatus =
  | "received"
  | "in_production"
  | "shipped"
  | "failed"
  | "unknown";

export interface SupplierProvider {
  /** Matches Supplier.slug in the database — used for logging/debugging which provider is active. */
  readonly slug: string;

  /**
   * Fetch the supplier's real production specs for a given product, if
   * they expose that (e.g. Apliiq's synced blank catalog knows real
   * print-area dimensions per garment). Returns null if the supplier
   * doesn't provide per-product specs — callers fall back to whatever
   * physical dimensions are already stored on the PrintZone record.
   */
  getProductionSpec(shopifyProductId: string, viewName: string): Promise<ProductionSpec | null>;

  /** Submit a completed, paid design for production. */
  submitProductionOrder(
    input: SubmitProductionOrderInput,
  ): Promise<SubmitProductionOrderResult>;

  /** Poll fulfillment status for a previously submitted order. */
  checkOrderStatus(supplierOrderId: string): Promise<ProductionOrderStatus>;
}
