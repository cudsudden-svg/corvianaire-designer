import type { PrintZoneConfig, ProductionFileInput, ProductionFileResult } from "@corvianaire/shared/types";
import { productionRenderMultiplier } from "@corvianaire/shared/utils";
import { designClient } from "../api/client";
import { renderViewToDataUrl } from "./render-view-image";
import { useDesignStore } from "../store/design-store";

/**
 * Renders a print-ready file for every zone that currently has content,
 * at that zone's own target DPI (productionRenderMultiplier), and
 * uploads them all in one call. Run this after saveCurrentDesign() has
 * given you a designId — production files attach to DesignView rows
 * that must already exist.
 *
 * A per-view render failure doesn't abort the rest: it's better for a
 * customer's order to go through with some production files missing
 * (visible to the merchant in Stage 8's dashboard as needing attention)
 * than to block checkout entirely over one view's export.
 */
export async function generateAndUploadProductionFiles(
  designId: string,
  zones: PrintZoneConfig[],
): Promise<ProductionFileResult[]> {
  const { getCurrentSnapshot } = useDesignStore.getState();

  const inputs: ProductionFileInput[] = [];
  for (const zone of zones) {
    const snapshot = getCurrentSnapshot(zone.viewName);
    if (!snapshot) continue;

    try {
      const fileDataUrl = await renderViewToDataUrl(snapshot, zone, {
        multiplier: productionRenderMultiplier(zone),
      });
      if (fileDataUrl) inputs.push({ viewName: zone.viewName, fileDataUrl });
    } catch (error) {
      console.error(`Failed to render production file for view "${zone.viewName}":`, error);
    }
  }

  if (inputs.length === 0) return [];
  return designClient.uploadProductionFiles(designId, inputs);
}
