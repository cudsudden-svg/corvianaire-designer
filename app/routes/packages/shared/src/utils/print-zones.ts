import type { PrintViewName, PrintZoneConfig, Rect } from "../types/design";
import { calculateDpi, rectContains } from "./geometry";

/** Every print view name the app currently understands, in display order. */
export const ALL_PRINT_VIEWS: PrintViewName[] = [
  "front",
  "back",
  "left-sleeve",
  "right-sleeve",
  "hood",
  "neck-label",
];

/** Human-readable label for a view name, for UI tabs/menus. */
export function printViewLabel(view: PrintViewName): string {
  return view
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Warns if a print zone's bleed area doesn't fully contain its safe area — a config error. */
export function validatePrintZoneConfig(zone: PrintZoneConfig): string | null {
  if (!rectContains(zone.bleedArea, zone.safeArea)) {
    return `Print zone "${zone.viewName}": safe area extends outside bleed area.`;
  }
  if (zone.targetDpi <= 0) {
    return `Print zone "${zone.viewName}": targetDpi must be positive.`;
  }
  if (zone.physicalWidthIn <= 0 || zone.physicalHeightIn <= 0) {
    return `Print zone "${zone.viewName}": physical width/height must be positive.`;
  }
  return null;
}

/**
 * Required source-art pixel dimensions to hit a zone's target DPI —
 * required_px = physical_inches × target_dpi. This is the number shown
 * to customers as "recommended minimum resolution" (Phase 15).
 */
export function requiredPixelDimensions(zone: PrintZoneConfig): {
  widthPx: number;
  heightPx: number;
} {
  return {
    widthPx: Math.round(zone.physicalWidthIn * zone.targetDpi),
    heightPx: Math.round(zone.physicalHeightIn * zone.targetDpi),
  };
}

/**
 * Given an artwork's natural pixel size and how large it's actually been
 * placed within the print zone (as a fraction of the zone's full safe
 * area, 0-1 on each axis — 1.0 means the artwork covers the entire safe
 * area), compute the EFFECTIVE DPI it will print at and whether that
 * meets the zone's target. Scaling an image up on canvas covers more of
 * the physical area with the same pixel data, which lowers effective
 * DPI — this is why the check has to be live, not just at upload time.
 */
export function checkArtworkDpi(
  zone: PrintZoneConfig,
  artworkPixelWidth: number,
  artworkPixelHeight: number,
  coverageFractionX: number,
  coverageFractionY: number,
): { ok: boolean; effectiveDpi: number; requiredDpi: number } {
  const coveredWidthIn = zone.physicalWidthIn * coverageFractionX;
  const coveredHeightIn = zone.physicalHeightIn * coverageFractionY;

  // Guard against division by zero for a not-yet-sized object.
  if (coveredWidthIn <= 0 || coveredHeightIn <= 0) {
    return { ok: true, effectiveDpi: Infinity, requiredDpi: zone.targetDpi };
  }

  const effectiveDpi = calculateDpi(artworkPixelWidth, artworkPixelHeight, coveredWidthIn, coveredHeightIn);
  return { ok: effectiveDpi >= zone.targetDpi, effectiveDpi, requiredDpi: zone.targetDpi };
}

/** Convenience: safe-area Rect only, for code that doesn't need bleed/DPI. */
export function safeAreaOf(zone: PrintZoneConfig): Rect {
  return zone.safeArea;
}

/**
 * Scale factor to pass as fabric's `toDataURL({ multiplier })` when
 * exporting a view's production file (Stage 7), so the rendered image's
 * safe area comes out at exactly requiredPixelDimensions(zone) — i.e. the
 * zone's real-world safe-area size at its target DPI. Scaling the WHOLE
 * canvas (bleed area included) by this same factor keeps everything
 * proportional to that one anchor measurement, consistent with how
 * checkArtworkDpi already reasons about coverage vs. targetDpi.
 */
export function productionRenderMultiplier(zone: PrintZoneConfig): number {
  const required = requiredPixelDimensions(zone);
  if (zone.safeArea.width <= 0) return 1;
  return required.widthPx / zone.safeArea.width;
}
