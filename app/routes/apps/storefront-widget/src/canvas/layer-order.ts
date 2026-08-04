// Layer ordering helpers. Thin wrappers over Fabric's built-in z-index
// methods, named to match the toolbar's vocabulary so CanvasStage.tsx
// doesn't call raw fabric APIs directly.
import type { fabric as FabricNS } from "fabric";

export function bringForward(canvas: FabricNS.Canvas): void {
  const target = canvas.getActiveObject();
  if (!target) return;
  canvas.bringForward(target);
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target });
}

export function sendBackward(canvas: FabricNS.Canvas): void {
  const target = canvas.getActiveObject();
  if (!target) return;
  canvas.sendBackwards(target);
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target });
}

export function bringToFront(canvas: FabricNS.Canvas): void {
  const target = canvas.getActiveObject();
  if (!target) return;
  canvas.bringToFront(target);
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target });
}

export function sendToBack(canvas: FabricNS.Canvas): void {
  const target = canvas.getActiveObject();
  if (!target) return;
  canvas.sendToBack(target);
  canvas.requestRenderAll();
  canvas.fire("object:modified", { target });
}
