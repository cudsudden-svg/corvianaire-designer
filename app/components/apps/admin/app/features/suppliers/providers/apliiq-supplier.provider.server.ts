// ApliiqSupplierProvider — the default/primary supplier, since this
// whole app's premise is customizing Apliiq-synced products. Stubbed for
// Stage 5 (real API calls are a Stage 7 "Commerce"/order-submission
// concern) but the shape is real: this is what Stage 7 fills in.
//
// Expected env vars when implemented: APLIIQ_API_KEY, APLIIQ_API_BASE_URL.
// Never read from configJson for secrets — configJson may hold
// non-secret routing info (e.g. an Apliiq account/store ID), but the API
// key itself comes from the environment, same pattern as
// STOREFRONT_API_TOKEN elsewhere in this app.
import type {
  ProductionOrderStatus,
  ProductionSpec,
  SubmitProductionOrderInput,
  SubmitProductionOrderResult,
  SupplierProvider,
} from "../types";

export class ApliiqSupplierProvider implements SupplierProvider {
  readonly slug = "apliiq";

  constructor(private readonly config: { accountId?: string }) {}

  async getProductionSpec(
    _shopifyProductId: string,
    _viewName: string,
  ): Promise<ProductionSpec | null> {
    // TODO(Stage 7): call Apliiq's product/blank spec endpoint using
    // APLIIQ_API_KEY, map their print-area response into ProductionSpec.
    // Returning null is a legitimate, handled outcome — callers fall
    // back to the PrintZone record's own stored physical dimensions.
    return null;
  }

  async submitProductionOrder(
    _input: SubmitProductionOrderInput,
  ): Promise<SubmitProductionOrderResult> {
    throw new Error(
      "ApliiqSupplierProvider.submitProductionOrder() is not yet implemented — " +
        "wired up in Stage 7 (Commerce / Order Integration).",
    );
  }

  async checkOrderStatus(_supplierOrderId: string): Promise<ProductionOrderStatus> {
    throw new Error(
      "ApliiqSupplierProvider.checkOrderStatus() is not yet implemented — " +
        "wired up in Stage 7.",
    );
  }
}
