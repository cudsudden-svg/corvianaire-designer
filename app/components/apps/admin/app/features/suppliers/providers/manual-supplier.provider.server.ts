// ManualSupplierProvider — for shops whose supplier isn't (yet) API-
// integrated. getProductionSpec always defers to the PrintZone's own
// stored physical dimensions (returns null); order submission/status
// just record state for a human to action manually rather than calling
// out to any external API. This is what makes "no supplier configured
// yet" a supported, non-broken state rather than a special case the rest
// of the app has to check for.
import type {
  ProductionOrderStatus,
  ProductionSpec,
  SubmitProductionOrderInput,
  SubmitProductionOrderResult,
  SupplierProvider,
} from "../types";

export class ManualSupplierProvider implements SupplierProvider {
  readonly slug = "manual";

  async getProductionSpec(): Promise<ProductionSpec | null> {
    return null; // always defer to the PrintZone's own stored dimensions
  }

  async submitProductionOrder(
    input: SubmitProductionOrderInput,
  ): Promise<SubmitProductionOrderResult> {
    // No external system to call — the "submission" IS the production
    // files existing and being visible in the admin dashboard (Stage 8)
    // for a human to download and hand off manually.
    return { supplierOrderId: `manual-${input.designId}` };
  }

  async checkOrderStatus(): Promise<ProductionOrderStatus> {
    return "unknown"; // nothing to poll — status is tracked manually
  }
}
