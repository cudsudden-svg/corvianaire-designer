// Renders a saved view's canvasJson to a PNG data URL using a headless
// fabric.StaticCanvas — never attached to the DOM, so this can run for
// every view a customer has customized (not just the currently-active
// one CanvasStage happens to have mounted) without disturbing the live
// editing canvas at all.
//
// Used for two different outputs from the same rendering path:
//   - preview thumbnails (save-design.ts): small, multiplier ~1
//   - production files (generate-production-files.ts): full-resolution,
//     multiplier from productionRenderMultiplier(zone)
import type { PrintZoneConfig } from "@corvianaire/shared/types";
import { loadFabric } from "../canvas/load-fabric";
import { canvasDimensionsForZone } from "../canvas/canvas-size";

export interface RenderViewImageOptions {
  /** Export scale — 1 for a screen-res preview, productionRenderMultiplier(zone) for a print-ready file. */
  multiplier: number;
}

/**
 * Returns a PNG data URL for the given view's saved canvas state, or
 * null if the snapshot has no visible objects (an empty view has nothing
 * worth rendering — callers skip it rather than uploading a blank image).
 */
export async function renderViewToDataUrl(
  canvasJsonString: string,
  zone: PrintZoneConfig | null,
  options: RenderViewImageOptions,
): Promise<string | null> {
  let parsed: { objects?: unknown[] };
  try {
    parsed = JSON.parse(canvasJsonString) as { objects?: unknown[] };
  } catch {
    return null;
  }
  if (!parsed.objects || parsed.objects.length === 0) return null;

  const { fabric } = await loadFabric();
  const { width, height } = canvasDimensionsForZone(zone);

  const staticCanvas = new fabric.StaticCanvas(document.createElement("canvas"), {
    width,
    height,
    backgroundColor: "#ffffff",
  });

  try {
    await new Promise<void>((resolve) => {
      staticCanvas.loadFromJSON(parsed, () => resolve());
    });
    staticCanvas.renderAll();
    // Crop to the zone's bleed area before scaling — without this, the
    // export includes the full canvas element, which (per
    // canvasDimensionsForZone) extends beyond the bleed area to
    // accommodate the zone's absolute x/y offset. Left uncropped, that
    // offset margin gets scaled up right along with the real content,
    // so the output is oversized, wrong-aspect-ratio, and the actual
    // artwork sits shifted away from filling the frame instead of
    // matching requiredPixelDimensions(zone) as intended.
    const cropRect = zone
      ? { left: zone.bleedArea.x, top: zone.bleedArea.y, width: zone.bleedArea.width, height: zone.bleedArea.height }
      : {};

    return staticCanvas.toDataURL({ format: "png", multiplier: options.multiplier, ...cropRect });
  } finally {
    staticCanvas.dispose();
  }
}
