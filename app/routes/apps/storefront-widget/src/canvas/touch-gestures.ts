// Mobile touch gestures. Fabric.js handles single-touch drag/tap out of
// the box (it maps touch events to its normal mouse event pipeline), but
// multi-touch pinch/rotate needs to be wired up manually — that's what
// this module does, attached to the canvas's own upper (interactive)
// element.
//
// Behavior:
//   - Two-finger pinch  -> zooms the canvas view (Fabric's setZoom),
//     centered on the pinch midpoint.
//   - Two-finger twist  -> if an object is selected, rotates THAT object
//     (design work is usually "rotate this sticker", not "rotate my
//     view of the whole canvas"). With nothing selected, twist is
//     ignored so it doesn't fight with the pinch-zoom gesture.
import type { fabric as FabricNS } from "fabric";

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function touchAngle(a: Touch, b: Touch): number {
  return (Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180) / Math.PI;
}

export function attachTouchGestures(fabric: typeof FabricNS, canvas: FabricNS.Canvas): () => void {
  const el = canvas.upperCanvasEl as HTMLCanvasElement | undefined;
  if (!el) return () => {};

  let lastDistance = 0;
  let lastAngle = 0;
  let gestureActive = false;

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 2) return;
    gestureActive = true;
    lastDistance = touchDistance(event.touches[0]!, event.touches[1]!);
    lastAngle = touchAngle(event.touches[0]!, event.touches[1]!);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!gestureActive || event.touches.length !== 2) return;
    event.preventDefault(); // stop the page from also scrolling/zooming

    const t0 = event.touches[0]!;
    const t1 = event.touches[1]!;
    const distance = touchDistance(t0, t1);
    const angle = touchAngle(t0, t1);

    // --- Pinch zoom ---
    if (lastDistance > 0) {
      const scaleDelta = distance / lastDistance;
      const currentZoom = canvas.getZoom();
      const nextZoom = Math.min(Math.max(currentZoom * scaleDelta, 0.2), 4);

      const midpoint = new fabric.Point(
        (t0.clientX + t1.clientX) / 2,
        (t0.clientY + t1.clientY) / 2,
      );
      canvas.zoomToPoint(midpoint, nextZoom);
    }

    // --- Two-finger rotate, only when something is selected ---
    const active = canvas.getActiveObject();
    if (active) {
      const angleDelta = angle - lastAngle;
      active.rotate((active.angle ?? 0) + angleDelta);
      active.setCoords();
    }

    canvas.requestRenderAll();
    lastDistance = distance;
    lastAngle = angle;
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) {
      if (gestureActive) {
        gestureActive = false;
        const active = canvas.getActiveObject();
        if (active) canvas.fire("object:modified", { target: active });
      }
      lastDistance = 0;
    }
  };

  el.addEventListener("touchstart", handleTouchStart, { passive: true });
  el.addEventListener("touchmove", handleTouchMove, { passive: false });
  el.addEventListener("touchend", handleTouchEnd, { passive: true });
  el.addEventListener("touchcancel", handleTouchEnd, { passive: true });

  return () => {
    el.removeEventListener("touchstart", handleTouchStart);
    el.removeEventListener("touchmove", handleTouchMove);
    el.removeEventListener("touchend", handleTouchEnd);
    el.removeEventListener("touchcancel", handleTouchEnd);
  };
}
