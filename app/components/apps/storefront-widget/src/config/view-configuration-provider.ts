import { ALL_PRINT_VIEWS } from "@corvianaire/shared/utils";
import type { PrintViewName, PrintZoneConfig } from "@corvianaire/shared/types";
import type { ProxyClient } from "@corvianaire/shared/api";

/**
 * Source of truth for "which print views exist for this product, and
 * what's their real geometry/DPI spec" — e.g. a tote bag might only have
 * "front", while a hoodie has all six, each with its own safe/bleed area
 * and physical print size. The editor (App.tsx / ViewTabs / CanvasStage)
 * consumes this interface ONLY; it never reads a hardcoded view list or
 * talks to Prisma/the admin API directly, so swapping the implementation
 * is a one-line change at the composition root (main.tsx).
 *
 * Stage 3 shipped with a hardcoded fallback (still available below, dev-
 * only). Stage 5 adds the real implementation — LivePrintZoneProvider —
 * which is now what main.tsx wires up by default.
 */
export interface ViewConfigurationProvider {
  getPrintZones(shopifyProductId: string): Promise<PrintZoneConfig[]>;
}

/**
 * LivePrintZoneProvider — real per-product print zone configuration,
 * fetched from the merchant's own PrintZone records via the app proxy
 * (GET /apps/studio/print-zones/:productId, see
 * apps/admin/app/routes/proxy.print-zones.$productId.tsx). An empty
 * result (no zones configured for this product yet) is a valid,
 * non-error state — the widget shows a "customizer not available for
 * this product" message rather than falling back to fabricated geometry,
 * since fabricated safe/bleed areas could silently mislead a customer
 * about what will actually print correctly.
 */
export class LivePrintZoneProvider implements ViewConfigurationProvider {
  constructor(private readonly proxyClient: ProxyClient) {}

  async getPrintZones(shopifyProductId: string): Promise<PrintZoneConfig[]> {
    return this.proxyClient.getPrintZones(shopifyProductId);
  }
}

/**
 * ⚠️ DEVELOPMENT-ONLY. Kept from Stage 3 for local widget development
 * (`npm run dev` in apps/storefront-widget, see index.html) when there's
 * no admin app running alongside it to serve real PrintZone data. NEVER
 * wired up as the default in main.tsx — see LivePrintZoneProvider above.
 */
const FALLBACK_ALLOWED_FORMATS = ["png", "jpg", "svg"];

export class FallbackViewConfigurationProvider implements ViewConfigurationProvider {
  async getPrintZones(_shopifyProductId: string): Promise<PrintZoneConfig[]> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "[Corvianaire Studio] Using FallbackViewConfigurationProvider — " +
          "hardcoded geometry, not real per-product config. Dev-only; " +
          "LivePrintZoneProvider is what main.tsx uses by default.",
      );
    }
    return ALL_PRINT_VIEWS.map((viewName) => buildFallbackZone(viewName));
  }
}

function buildFallbackZone(viewName: PrintViewName): PrintZoneConfig {
  // Roughly plausible placeholder geometry/production spec per view —
  // good enough to exercise the DPI-warning and safe/bleed-overlay UI
  // locally without a running admin app.
  const isSmall = viewName === "neck-label";
  return {
    viewName,
    safeArea: { x: 300, y: 250, width: 400, height: 500 },
    bleedArea: { x: 280, y: 230, width: 440, height: 540 },
    physicalWidthIn: isSmall ? 3 : 12,
    physicalHeightIn: isSmall ? 1.5 : 16,
    bleedMarginIn: 0.125,
    targetDpi: isSmall ? 300 : 150,
    allowedFileFormats: FALLBACK_ALLOWED_FORMATS,
  };
}
