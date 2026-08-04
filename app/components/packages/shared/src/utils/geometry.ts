import type { Rect } from "../types/design";

/** True if `inner` fits entirely within `outer` (e.g. safe area inside bleed area). */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/** True if two rects overlap at all. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/** Clamp a point to stay within a rect (used to keep dragged objects inside a print zone). */
export function clampPointToRect(
  point: { x: number; y: number },
  rect: Rect,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(point.x, rect.x), rect.x + rect.width),
    y: Math.min(Math.max(point.y, rect.y), rect.y + rect.height),
  };
}

/** Scale a rect by a uniform factor around its own origin (not its center). */
export function scaleRect(rect: Rect, scale: number): Rect {
  return {
    x: rect.x * scale,
    y: rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  };
}

/** Pixel dimensions -> effective DPI, given the physical print size in inches. */
export function calculateDpi(
  pixelWidth: number,
  pixelHeight: number,
  physicalWidthIn: number,
  physicalHeightIn: number,
): number {
  const dpiX = pixelWidth / physicalWidthIn;
  const dpiY = pixelHeight / physicalHeightIn;
  // Use the lower of the two axes — the more conservative (worse-case) DPI.
  return Math.min(dpiX, dpiY);
}
