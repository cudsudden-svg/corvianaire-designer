// Snap alignment. Wired into the canvas's "object:moving" event in
// CanvasStage.tsx. On every move tick, compares the moving object's
// center against the canvas's own center and every other object's
// center; within SNAP_THRESHOLD px, snaps position exactly and draws a
// temporary dashed guide line so the user can see why it snapped.
import type { fabric as FabricNS } from "fabric";

const SNAP_THRESHOLD = 8; // px

interface SnapGuide {
  orientation: "vertical" | "horizontal";
  position: number;
}

export function computeSnapping(
  fabric: typeof FabricNS,
  canvas: FabricNS.Canvas,
  target: FabricNS.Object,
): SnapGuide[] {
  const guides: SnapGuide[] = [];
  const targetBounds = target.getBoundingRect(true, true);
  const targetCenterX = targetBounds.left + targetBounds.width / 2;
  const targetCenterY = targetBounds.top + targetBounds.height / 2;

  const canvasCenterX = (canvas.width ?? 0) / 2;
  const canvasCenterY = (canvas.height ?? 0) / 2;

  if (Math.abs(targetCenterX - canvasCenterX) < SNAP_THRESHOLD) {
    target.set({ left: (target.left ?? 0) + (canvasCenterX - targetCenterX) });
    guides.push({ orientation: "vertical", position: canvasCenterX });
  }
  if (Math.abs(targetCenterY - canvasCenterY) < SNAP_THRESHOLD) {
    target.set({ top: (target.top ?? 0) + (canvasCenterY - targetCenterY) });
    guides.push({ orientation: "horizontal", position: canvasCenterY });
  }

  for (const obj of canvas.getObjects()) {
    // Skip self and any non-interactive overlay object (e.g. a future
    // safe/bleed-area guide rect from Stage 5, which is excluded from
    // export/selection and shouldn't act as a snap target).
    if (obj === target || obj.excludeFromExport) continue;

    const otherBounds = obj.getBoundingRect(true, true);
    const otherCenterX = otherBounds.left + otherBounds.width / 2;
    const otherCenterY = otherBounds.top + otherBounds.height / 2;

    if (Math.abs(targetCenterX - otherCenterX) < SNAP_THRESHOLD) {
      target.set({ left: (target.left ?? 0) + (otherCenterX - targetCenterX) });
      guides.push({ orientation: "vertical", position: otherCenterX });
    }
    if (Math.abs(targetCenterY - otherCenterY) < SNAP_THRESHOLD) {
      target.set({ top: (target.top ?? 0) + (otherCenterY - targetCenterY) });
      guides.push({ orientation: "horizontal", position: otherCenterY });
    }
  }

  return guides;
}

export function drawSnapGuides(
  fabric: typeof FabricNS,
  canvas: FabricNS.Canvas,
  guides: SnapGuide[],
): FabricNS.Line[] {
  const lines = guides.map((guide) => {
    const points: [number, number, number, number] =
      guide.orientation === "vertical"
        ? [guide.position, 0, guide.position, canvas.height ?? 0]
        : [0, guide.position, canvas.width ?? 0, guide.position];

    const line = new fabric.Line(points, {
      stroke: "#ff4d8f",
      strokeWidth: 1,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    canvas.add(line);
    return line;
  });
  canvas.requestRenderAll();
  return lines;
}

export function clearSnapGuides(canvas: FabricNS.Canvas, lines: FabricNS.Line[]): void {
  for (const line of lines) canvas.remove(line);
}
