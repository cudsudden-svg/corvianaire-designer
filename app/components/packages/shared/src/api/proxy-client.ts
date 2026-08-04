import type { ShopifyProduct } from "../types/product";
import type { ClipartCategory, UploadedAssetMeta } from "../types/assets";
import type {
  PrintZoneConfig,
  SaveDesignInput,
  SavedDesign,
  ProductionFileInput,
  ProductionFileResult,
  DesignState,
  DesignCheckpointSummary,
  DesignCheckpointPage,
  LoginDraftConflict,
  PrintViewName,
} from "../types/design";

/**
 * Client for our app proxy (`/apps/studio/...`, see
 * apps/admin/app/routes/proxy.products.$handle.tsx). This is the ONLY way
 * the storefront widget talks to product data — it never hits the
 * Storefront API directly, so no access token ships to the browser.
 *
 * The proxy path prefix ("apps/studio") is configured in shopify.app.toml
 * and must match what's passed here.
 */
export interface ProxyClientOptions {
  /** e.g. "/apps/studio" — no trailing slash. */
  proxyBasePath: string;
}

export class ProxyApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ProxyApiError";
  }
}

export function createProxyClient(options: ProxyClientOptions) {
  const base = options.proxyBasePath.replace(/\/$/, "");

  async function getProductByHandle(handle: string): Promise<ShopifyProduct> {
    const response = await fetch(`${base}/products/${encodeURIComponent(handle)}`);

    if (!response.ok) {
      let message = `Request failed: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // response body wasn't JSON — keep the generic message
      }
      throw new ProxyApiError(message, response.status);
    }

    return (await response.json()) as ShopifyProduct;
  }

  /**
   * Upload a customer image via the /apps/studio/uploads app-proxy route.
   * The server validates type/size and computes real pixel dimensions —
   * this client just streams the file and surfaces the result/error.
   */
  async function uploadAsset(file: File): Promise<UploadedAssetMeta> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${base}/uploads`, { method: "POST", body: formData });

    if (!response.ok) {
      let message = `Upload failed: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // response body wasn't JSON — keep the generic message
      }
      throw new ProxyApiError(message, response.status);
    }

    return (await response.json()) as UploadedAssetMeta;
  }

  /** Fetch the admin-managed clipart library (categories + assets). */
  async function getClipartLibrary(): Promise<ClipartCategory[]> {
    const response = await fetch(`${base}/clipart`);

    if (!response.ok) {
      throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    }

    return (await response.json()) as ClipartCategory[];
  }

  /**
   * Fetch merchant-configured print zones for a product (Stage 5) — the
   * real, per-product replacement for Stage 3's hardcoded fallback view
   * list. Returns an empty array for a product with no configured zones
   * yet (a valid state, not an error — the widget shows "customizer not
   * available for this product" rather than crashing).
   */
  async function getPrintZones(shopifyProductId: string): Promise<PrintZoneConfig[]> {
    const encodedId = encodeURIComponent(shopifyProductId.replace("gid://shopify/Product/", ""));
    const response = await fetch(`${base}/print-zones/${encodedId}`);

    if (!response.ok) {
      throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    }

    const body = (await response.json()) as { views: PrintZoneConfig[] };
    return body.views;
  }

  /** Live price calculation (Stage 5) — call whenever the design's price-relevant state changes. */
  async function getPricing(input: PricingRequest): Promise<PricingResponse> {
    const response = await fetch(`${base}/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new ProxyApiError(`Pricing request failed: ${response.status}`, response.status);
    }

    return (await response.json()) as PricingResponse;
  }

  /**
   * Save (create or update) a design — all views' canvas JSON plus any
   * freshly-rendered preview images (Stage 7). Called right before
   * add-to-cart, and safe to call repeatedly as the customer keeps
   * editing pre-checkout; passing `input.id` updates that design in place
   * rather than creating a new row.
   */
  async function saveDesign(input: SaveDesignInput): Promise<SavedDesign> {
    const response = await fetch(`${base}/designs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      let message = `Save failed: ${response.status}`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        // response body wasn't JSON — keep the generic message
      }
      throw new ProxyApiError(message, response.status);
    }

    return (await response.json()) as SavedDesign;
  }

  /** Load a previously saved design by id (e.g. reopening from a cart edit link — full re-hydration UI is a Stage 8 concern). */
  async function getDesign(id: string): Promise<SavedDesign> {
    const response = await fetch(`${base}/designs/${encodeURIComponent(id)}`);

    if (!response.ok) {
      throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    }

    return (await response.json()) as SavedDesign;
  }

  /**
   * Upload client-rendered, print-ready production files for a saved
   * design's views (Stage 7) — separate from saveDesign() since
   * production files are only worth generating for views the customer
   * actually used, and are larger payloads than the preview thumbnails
   * saveDesign() already handles.
   */
  async function uploadProductionFiles(
    designId: string,
    views: ProductionFileInput[],
  ): Promise<ProductionFileResult[]> {
    const response = await fetch(`${base}/designs/${encodeURIComponent(designId)}/production-files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ views }),
    });

    if (!response.ok) {
      throw new ProxyApiError(`Production file upload failed: ${response.status}`, response.status);
    }

    const body = (await response.json()) as { views: ProductionFileResult[] };
    return body.views;
  }

  // ─────────────────────────────────────────────────────────────
  // Draft / autosave / checkpoints / login handoff (Stage 6/9 restoration)
  // ─────────────────────────────────────────────────────────────

  /** Get-or-create the continuously-autosaved DRAFT for a product+variant — called once on widget mount. */
  async function getOrCreateDraft(input: {
    shopifyProductId: string;
    shopifyVariantId: string;
    guestSessionId: string;
  }): Promise<DesignState> {
    const response = await fetch(`${base}/designs/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    return (await response.json()) as DesignState;
  }

  /** Upsert one view's canvas state + fast preview into the draft. Debounced by the caller, not here. */
  async function autosaveView(
    designId: string,
    input: { viewName: PrintViewName; canvasJson: unknown; previewImageUrl: string },
  ): Promise<DesignState> {
    const response = await fetch(`${base}/designs/${encodeURIComponent(designId)}/autosave`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new ProxyApiError(`Autosave failed: ${response.status}`, response.status);
    return (await response.json()) as DesignState;
  }

  /** Upload a fast client-rendered preview PNG (data URL), returning its stored URL for use with autosaveView. */
  async function uploadPreviewSnapshot(dataUrl: string, viewName: PrintViewName): Promise<string> {
    const response = await fetch(`${base}/designs/preview-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, viewName }),
    });
    if (!response.ok) throw new ProxyApiError(`Preview upload failed: ${response.status}`, response.status);
    const body = (await response.json()) as { url: string };
    return body.url;
  }

  /** Explicit "Save" — clone the current draft into a new named, independently-reopenable checkpoint. */
  async function saveCheckpoint(designId: string, name: string): Promise<DesignCheckpointSummary> {
    const response = await fetch(`${base}/designs/${encodeURIComponent(designId)}/checkpoint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      let message = `Save failed: ${response.status}`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody?.error) message = errBody.error;
      } catch {
        // keep generic message
      }
      throw new ProxyApiError(message, response.status);
    }
    return (await response.json()) as DesignCheckpointSummary;
  }

  /** Paginated "My Designs" checkpoint list. */
  async function listCheckpoints(input: {
    guestSessionId?: string;
    shopifyProductId?: string;
    cursor?: string | null;
  }): Promise<DesignCheckpointPage> {
    const params = new URLSearchParams();
    if (input.guestSessionId) params.set("guestSessionId", input.guestSessionId);
    if (input.shopifyProductId) params.set("shopifyProductId", input.shopifyProductId);
    if (input.cursor) params.set("cursor", input.cursor);

    const response = await fetch(`${base}/designs/checkpoints?${params.toString()}`);
    if (!response.ok) throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    return (await response.json()) as DesignCheckpointPage;
  }

  /** Full design state (with canvasJson per view) — for reopening a checkpoint or hydrating after a login-conflict resolution. */
  async function loadFullDesign(id: string): Promise<DesignState> {
    const response = await fetch(`${base}/designs/${encodeURIComponent(id)}?full=1`);
    if (!response.ok) throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    return (await response.json()) as DesignState;
  }

  /** Check whether this just-logged-in visitor has a guest/account draft conflict for a product+variant. */
  async function checkLoginDraftConflict(input: {
    guestSessionId: string;
    shopifyProductId: string;
    shopifyVariantId: string;
  }): Promise<LoginDraftConflict> {
    const params = new URLSearchParams(input);
    const response = await fetch(`${base}/designs/resolve-login?${params.toString()}`);
    if (!response.ok) throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    return (await response.json()) as LoginDraftConflict;
  }

  /** Apply the customer's choice from a login-conflict prompt. */
  async function chooseLoginDraft(chosenDesignId: string): Promise<DesignCheckpointSummary> {
    const response = await fetch(`${base}/designs/resolve-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chosenDesignId }),
    });
    if (!response.ok) throw new ProxyApiError(`Request failed: ${response.status}`, response.status);
    return (await response.json()) as DesignCheckpointSummary;
  }

  return {
    getProductByHandle,
    uploadAsset,
    getClipartLibrary,
    getPrintZones,
    getPricing,
    saveDesign,
    getDesign,
    uploadProductionFiles,
    getOrCreateDraft,
    autosaveView,
    uploadPreviewSnapshot,
    saveCheckpoint,
    listCheckpoints,
    loadFullDesign,
    checkLoginDraftConflict,
    chooseLoginDraft,
  };
}

export interface PricingRequest {
  shopifyProductHandle: string;
  shopifyVariantId: string;
  usedViews: string[];
  techniqueByView?: Record<string, string>;
  usedPremiumFont?: boolean;
  assetTypeByView?: Record<string, "uploaded" | "clipart">;
}

export interface PricingResponse {
  baseVariantPriceCents: number;
  appliedRules: Array<{
    ruleId: string;
    label: string;
    ruleType: string;
    viewName: string | null;
    priceDeltaCents: number;
  }>;
  totalDeltaCents: number;
  totalPriceCents: number;
}

export type ProxyClient = ReturnType<typeof createProxyClient>;
