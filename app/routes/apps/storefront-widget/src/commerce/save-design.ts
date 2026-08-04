import type { PrintZoneConfig, SaveDesignViewInput, SavedDesign } from "@corvianaire/shared/types";
import { designClient } from "../api/client";
import { renderViewToDataUrl } from "./render-view-image";
import { useDesignStore } from "../store/design-store";

export interface SaveDesignParams {
  /** Pass the id of a design already saved earlier this session to update it in place rather than creating a new row. */
  existingDesignId: string | null;
  shopifyProductId: string;
  shopifyVariantId: string;
  computedPriceCents: number | null;
  zones: PrintZoneConfig[];
}

/**
 * Gathers every view that currently has content from the design store,
 * renders a screen-resolution preview for each (multiplier 1 — full
 * production-resolution renders are a separate, on-demand step; see
 * generate-production-files.ts), and saves the whole design in one call.
 */
export async function saveCurrentDesign(params: SaveDesignParams): Promise<SavedDesign> {
  const { getCurrentSnapshot } = useDesignStore.getState();

  const views: SaveDesignViewInput[] = [];
  for (const zone of params.zones) {
    const snapshot = getCurrentSnapshot(zone.viewName);
    if (!snapshot) continue;

    let canvasJson: unknown;
    try {
      canvasJson = JSON.parse(snapshot);
    } catch {
      continue; // corrupt snapshot — skip rather than send unparseable data
    }

    const previewImageDataUrl = await renderViewToDataUrl(snapshot, zone, { multiplier: 1 });
    views.push({
      viewName: zone.viewName,
      canvasJson,
      ...(previewImageDataUrl ? { previewImageDataUrl } : {}),
    });
  }

  return designClient.saveDesign({
    id: params.existingDesignId ?? undefined,
    shopifyProductId: params.shopifyProductId,
    shopifyVariantId: params.shopifyVariantId,
    computedPriceCents: params.computedPriceCents ?? undefined,
    views,
  });
}
