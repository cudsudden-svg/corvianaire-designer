import type { PrintZoneConfig } from "@corvianaire/shared/types";

export const DEFAULT_CANVAS_WIDTH = 500;
export const DEFAULT_CANVAS_HEIGHT = 500;

/**
 * Design-space pixel size a view's canvas is sized to — the zone's full
 * bleed-area bounds, with a floor so an unusually small/missing zone
 * still gets a workable canvas. Shared between the live editor
 * (use-fabric-canvas.ts's applyZoneCanvasSize) and the Stage 7
 * preview/production-file renderer (render-view-image.ts) so the two can
 * never disagree about a view's coordinate space — a saved canvasJson
 * has no width/height of its own, only object positions, so whatever
 * renders it has to reconstruct the same canvas size the editor used.
 */
export function canvasDimensionsForZone(zone: PrintZoneConfig | null): {
  width: number;
  height: number;
} {
  if (!zone) return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
  return {
    width: Math.max(zone.bleedArea.x + zone.bleedArea.width, DEFAULT_CANVAS_WIDTH),
    height: Math.max(zone.bleedArea.y + zone.bleedArea.height, DEFAULT_CANVAS_HEIGHT),
  };
}
