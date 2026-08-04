// useFabricCanvas — the single owner of the fabric.Canvas instance.
// Lifecycle (create/dispose), per-view history persistence, view-
// switching, the full interaction set (duplicate/delete/flip/layer
// order/zoom/snap/keyboard/touch), the safe/bleed print-zone overlay,
// live DPI checking, and variant color-switching (background image swap)
// all live here — CanvasStage renders the <canvas> + toolbar; tools call
// addObject().
import { useEffect, useRef, useState, useCallback } from "react";
import type { RefObject } from "react";
import type { fabric as FabricNS } from "fabric";
import type { PrintViewName, PrintZoneConfig } from "@corvianaire/shared/types";
import { checkArtworkDpi } from "@corvianaire/shared/utils";
import { useDesignStore } from "../store/design-store";
import { loadFabric } from "./load-fabric";
import { computeSnapping, drawSnapGuides, clearSnapGuides } from "./snapping";
import { attachKeyboardShortcuts } from "./keyboard-shortcuts";
import { attachTouchGestures } from "./touch-gestures";
import { bringForward, sendBackward, bringToFront, sendToBack } from "./layer-order";
import { canvasDimensionsForZone, DEFAULT_CANVAS_WIDTH, DEFAULT_CANVAS_HEIGHT } from "./canvas-size";

const ZOOM_STEP = 1.2;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 4;

export interface DpiWarning {
  effectiveDpi: number;
  requiredDpi: number;
}

export interface UseFabricCanvasResult {
  canvasElRef: RefObject<HTMLCanvasElement>;
  ready: boolean;
  addObject: (object: FabricNS.Object) => void;
  getCanvas: () => FabricNS.Canvas | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  duplicate: () => void;
  deleteSelected: () => void;
  flipHorizontal: () => void;
  flipVertical: () => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  /** Set when the selected object's artwork falls below the active print zone's target DPI. Null = no warning (nothing selected, or resolution is fine). */
  dpiWarning: DpiWarning | null;
}

export function useFabricCanvas(
  activeView: PrintViewName,
  zone: PrintZoneConfig | null,
  backgroundImageUrl: string | null,
): UseFabricCanvasResult {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<FabricNS.Canvas | null>(null);
  const fabricNsRef = useRef<typeof FabricNS | null>(null);
  const activeViewRef = useRef(activeView);
  const zoneRef = useRef(zone);
  const overlayObjectsRef = useRef<FabricNS.Object[]>([]);
  const suppressPersistRef = useRef(false);
  const snapGuideLinesRef = useRef<FabricNS.Line[]>([]);
  const detachKeyboardRef = useRef<() => void>(() => {});
  const detachTouchRef = useRef<() => void>(() => {});

  const [ready, setReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hasSelection, setHasSelection] = useState(false);
  const [dpiWarning, setDpiWarning] = useState<DpiWarning | null>(null);

  const pushSnapshot = useDesignStore((s) => s.pushSnapshot);
  const getCurrentSnapshot = useDesignStore((s) => s.getCurrentSnapshot);
  const storeUndo = useDesignStore((s) => s.undo);
  const storeRedo = useDesignStore((s) => s.redo);
  const canUndo = useDesignStore((s) => s.canUndo(activeView));
  const canRedo = useDesignStore((s) => s.canRedo(activeView));

  useEffect(() => {
    activeViewRef.current = activeView;
  }, [activeView]);
  useEffect(() => {
    zoneRef.current = zone;
  }, [zone]);

  function applyHistorySnapshot(snapshot: string | null) {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    if (snapshot) {
      canvas.loadFromJSON(JSON.parse(snapshot), () => {
        canvas.renderAll();
        drawZoneOverlay(canvas);
      });
    } else {
      canvas.renderAll();
      drawZoneOverlay(canvas);
    }
  }

  /**
   * Draws (or redraws) the safe/bleed area guide rects for the current
   * zone — dashed, non-selectable, excluded from export/history. Called
   * after every load/clear since canvas.clear()/loadFromJSON wipe
   * everything, overlay included.
   */
  function drawZoneOverlay(canvas: FabricNS.Canvas) {
    const fabric = fabricNsRef.current;
    const currentZone = zoneRef.current;
    suppressPersistRef.current = true;
    for (const obj of overlayObjectsRef.current) canvas.remove(obj);
    overlayObjectsRef.current = [];
    if (!fabric || !currentZone) {
      suppressPersistRef.current = false;
      return;
    }

    const bleedRect = new fabric.Rect({
      left: currentZone.bleedArea.x,
      top: currentZone.bleedArea.y,
      width: currentZone.bleedArea.width,
      height: currentZone.bleedArea.height,
      fill: "transparent",
      stroke: "#ff9f43",
      strokeDashArray: [6, 4],
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    const safeRect = new fabric.Rect({
      left: currentZone.safeArea.x,
      top: currentZone.safeArea.y,
      width: currentZone.safeArea.width,
      height: currentZone.safeArea.height,
      fill: "transparent",
      stroke: "#2e7dd7",
      strokeDashArray: [4, 3],
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });

    canvas.add(bleedRect, safeRect);
    overlayObjectsRef.current = [bleedRect, safeRect];
    suppressPersistRef.current = false;
    canvas.requestRenderAll();
  }

  /** Resizes the canvas element to comfortably fit the zone's bleed area. */
  function applyZoneCanvasSize(canvas: FabricNS.Canvas) {
    canvas.setDimensions(canvasDimensionsForZone(zoneRef.current));
  }

  /**
   * Checks the given image object's native resolution against the active
   * zone's target DPI, given how large it's currently rendered relative
   * to the zone's safe area (Phase 15 — recalculated live, not just at
   * upload time, since scaling an object up on canvas lowers its
   * effective print DPI even though the source file never changed).
   */
  function evaluateDpi(object: FabricNS.Object | null) {
    const currentZone = zoneRef.current;
    if (!object || !currentZone || object.type !== "image") {
      setDpiWarning(null);
      return;
    }
    const imageObject = object as unknown as { width?: number; height?: number };
    const naturalWidth = imageObject.width ?? 0;
    const naturalHeight = imageObject.height ?? 0;
    if (!naturalWidth || !naturalHeight) {
      setDpiWarning(null);
      return;
    }

    const renderedWidth = object.getScaledWidth();
    const renderedHeight = object.getScaledHeight();
    const coverageFractionX = renderedWidth / currentZone.safeArea.width;
    const coverageFractionY = renderedHeight / currentZone.safeArea.height;

    const result = checkArtworkDpi(
      currentZone,
      naturalWidth,
      naturalHeight,
      coverageFractionX,
      coverageFractionY,
    );
    setDpiWarning(result.ok ? null : { effectiveDpi: result.effectiveDpi, requiredDpi: result.requiredDpi });
  }

  // One-time setup: create the fabric.Canvas instance (lazy-loaded chunk).
  useEffect(() => {
    let cancelled = false;

    loadFabric().then(({ fabric }) => {
      if (cancelled || !canvasElRef.current) return;
      fabricNsRef.current = fabric;

      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: DEFAULT_CANVAS_WIDTH,
        height: DEFAULT_CANVAS_HEIGHT,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      const persist = () => {
        if (suppressPersistRef.current) return;
        const view = activeViewRef.current;
        const raw = canvas.toJSON();
        // Belt-and-suspenders: even though overlay add/remove is wrapped
        // in suppressPersistRef, strip any excludeFromExport object from
        // what actually gets saved, so a stray overlay object can never
        // leak into a view's persisted history.
        raw.objects = (raw.objects as Array<{ excludeFromExport?: boolean }>).filter(
          (obj) => !obj.excludeFromExport,
        );
        pushSnapshot(view, JSON.stringify(raw));
      };

      canvas.on("object:modified", persist);
      canvas.on("object:added", persist);
      canvas.on("object:removed", persist);

      canvas.on("object:moving", (event) => {
        const target = event.target;
        if (!target) return;
        clearSnapGuides(canvas, snapGuideLinesRef.current);
        const guides = computeSnapping(fabric, canvas, target);
        snapGuideLinesRef.current = guides.length ? drawSnapGuides(fabric, canvas, guides) : [];
      });
      canvas.on("object:modified", () => {
        clearSnapGuides(canvas, snapGuideLinesRef.current);
        snapGuideLinesRef.current = [];
      });
      canvas.on("object:scaling", (event) => evaluateDpi(event.target ?? null));

      const updateSelection = () => {
        const active = canvas.getActiveObject();
        setHasSelection(!!active);
        evaluateDpi(active);
      };
      canvas.on("selection:created", updateSelection);
      canvas.on("selection:updated", updateSelection);
      canvas.on("selection:cleared", updateSelection);

      detachKeyboardRef.current = attachKeyboardShortcuts(canvas, {
        onUndo: () => undo(),
        onRedo: () => redo(),
        onDuplicate: () => duplicate(),
        onDelete: () => deleteSelected(),
      });
      detachTouchRef.current = attachTouchGestures(fabric, canvas);

      applyZoneCanvasSize(canvas);
      const existing = getCurrentSnapshot(activeViewRef.current);
      if (existing) {
        canvas.loadFromJSON(JSON.parse(existing), () => {
          canvas.renderAll();
          drawZoneOverlay(canvas);
        });
      } else {
        drawZoneOverlay(canvas);
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
      detachKeyboardRef.current();
      detachTouchRef.current();
      fabricCanvasRef.current?.dispose();
      fabricCanvasRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-time setup
  }, []);

  // On every view switch, swap contents to that view's saved snapshot,
  // resize for the new view's zone, redraw its overlay, and reset
  // zoom/selection. Nothing here touches another view's history.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !ready) return;

    const snapshot = getCurrentSnapshot(activeView);
    canvas.clear();
    canvas.backgroundColor = "#ffffff";
    applyZoneCanvasSize(canvas);
    if (snapshot) {
      canvas.loadFromJSON(JSON.parse(snapshot), () => {
        canvas.renderAll();
        drawZoneOverlay(canvas);
      });
    } else {
      canvas.renderAll();
      drawZoneOverlay(canvas);
    }
    canvas.setZoom(1);
    setZoomLevel(1);
    setHasSelection(false);
    setDpiWarning(null);
  }, [activeView, zone, ready, getCurrentSnapshot]);

  // Color switching (Phase 9): swap ONLY the background image when the
  // selected variant's image changes — design objects are untouched, so
  // placement is preserved exactly as it was.
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const fabric = fabricNsRef.current;
    if (!canvas || !fabric || !ready) return;

    if (!backgroundImageUrl) {
      canvas.backgroundImage = undefined;
      canvas.requestRenderAll();
      return;
    }

    fabric.Image.fromURL(
      backgroundImageUrl,
      (img) => {
        img.set({
          originX: "left",
          originY: "top",
          selectable: false,
          evented: false,
          excludeFromExport: true,
        });
        const scale = Math.min(
          (canvas.width ?? DEFAULT_CANVAS_WIDTH) / (img.width ?? 1),
          (canvas.height ?? DEFAULT_CANVAS_HEIGHT) / (img.height ?? 1),
        );
        img.scale(scale);
        canvas.setBackgroundImage(img, () => canvas.requestRenderAll());
      },
      { crossOrigin: "anonymous" },
    );
  }, [backgroundImageUrl, ready]);

  const addObject = useCallback((object: FabricNS.Object) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    canvas.add(object);
    canvas.setActiveObject(object);
    canvas.renderAll();
  }, []);

  const getCanvas = useCallback(() => fabricCanvasRef.current, []);

  const undo = useCallback(() => {
    applyHistorySnapshot(storeUndo(activeViewRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeUndo]);

  const redo = useCallback(() => {
    applyHistorySnapshot(storeRedo(activeViewRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeRedo]);

  const duplicate = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const target = canvas?.getActiveObject();
    if (!canvas || !target) return;
    target.clone((cloned: FabricNS.Object) => {
      cloned.set({ left: (target.left ?? 0) + 20, top: (target.top ?? 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    });
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const target = canvas?.getActiveObject();
    if (!canvas || !target) return;
    canvas.remove(target);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }, []);

  const flipHorizontal = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const target = canvas?.getActiveObject();
    if (!canvas || !target) return;
    target.set({ flipX: !target.flipX });
    canvas.requestRenderAll();
    canvas.fire("object:modified", { target });
  }, []);

  const flipVertical = useCallback(() => {
    const canvas = fabricCanvasRef.current;
    const target = canvas?.getActiveObject();
    if (!canvas || !target) return;
    target.set({ flipY: !target.flipY });
    canvas.requestRenderAll();
    canvas.fire("object:modified", { target });
  }, []);

  const applyZoom = useCallback((next: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    const clamped = Math.min(Math.max(next, MIN_ZOOM), MAX_ZOOM);
    canvas.setZoom(clamped);
    setZoomLevel(clamped);
  }, []);
  const zoomIn = useCallback(() => applyZoom(zoomLevel * ZOOM_STEP), [applyZoom, zoomLevel]);
  const zoomOut = useCallback(() => applyZoom(zoomLevel / ZOOM_STEP), [applyZoom, zoomLevel]);
  const zoomReset = useCallback(() => applyZoom(1), [applyZoom]);

  return {
    canvasElRef,
    ready,
    addObject,
    getCanvas,
    undo,
    redo,
    canUndo,
    canRedo,
    hasSelection,
    duplicate,
    deleteSelected,
    flipHorizontal,
    flipVertical,
    bringForward: () => fabricCanvasRef.current && bringForward(fabricCanvasRef.current),
    sendBackward: () => fabricCanvasRef.current && sendBackward(fabricCanvasRef.current),
    bringToFront: () => fabricCanvasRef.current && bringToFront(fabricCanvasRef.current),
    sendToBack: () => fabricCanvasRef.current && sendToBack(fabricCanvasRef.current),
    zoom: zoomLevel,
    zoomIn,
    zoomOut,
    zoomReset,
    dpiWarning,
  };
}
