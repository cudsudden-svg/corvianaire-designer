// Debounced autosave. Deliberately decoupled from use-fabric-canvas.ts
// (which stays the single owner of the fabric.Canvas instance) — this
// hook only watches useDesignStore's per-view history, which already
// updates on every object:modified/added/removed AND on undo/redo, so
// autosave naturally covers both without duplicating any canvas event
// wiring.
import { useEffect, useRef } from "react";
import type { fabric as FabricNS } from "fabric";
import type { PrintViewName } from "@corvianaire/shared/types";
import { useDesignStore } from "../store/design-store";
import { designClient } from "../api/client";

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * @param designId   Null until the draft has been created server-side
 *                    (see use-design-draft.ts) — autosave is a no-op
 *                    until then.
 * @param activeView Only the currently-visible view has a live canvas to
 *                    capture a preview from; a background view's history
 *                    change still autosaves its canvasJson, just without
 *                    a fresh preview snapshot that turn.
 * @param getCanvas  From useFabricCanvas — the same instance the editor renders.
 */
export function usePersistedDesignAutosave(
  designId: string | null,
  activeView: PrintViewName,
  getCanvas: () => FabricNS.Canvas | null,
): void {
  const timersRef = useRef<Partial<Record<PrintViewName, ReturnType<typeof setTimeout>>>>({});
  const lastQueuedRef = useRef<Partial<Record<PrintViewName, string>>>({});
  const activeViewRef = useRef(activeView);
  const getCanvasRef = useRef(getCanvas);

  useEffect(() => {
    activeViewRef.current = activeView;
    getCanvasRef.current = getCanvas;
  }, [activeView, getCanvas]);

  useEffect(() => {
    if (!designId) return;

    const timers = timersRef.current;

    const unsubscribe = useDesignStore.subscribe((state, prevState) => {
      for (const view of Object.keys(state.histories) as PrintViewName[]) {
        const snapshot = state.histories[view]?.present;
        const previous = prevState.histories[view]?.present;
        if (!snapshot || snapshot === previous || snapshot === lastQueuedRef.current[view]) continue;

        lastQueuedRef.current[view] = snapshot;

        const existingTimer = timers[view];
        if (existingTimer) clearTimeout(existingTimer);

        timers[view] = setTimeout(() => {
          void autosaveViewNow(designId, view, snapshot, activeViewRef.current, getCanvasRef.current);
        }, AUTOSAVE_DEBOUNCE_MS);
      }
    });

    return () => {
      unsubscribe();
      for (const timer of Object.values(timers)) if (timer) clearTimeout(timer);
    };
  }, [designId]);
}

async function autosaveViewNow(
  designId: string,
  view: PrintViewName,
  canvasJsonString: string,
  currentActiveView: PrintViewName,
  getCanvas: () => FabricNS.Canvas | null,
): Promise<void> {
  const canvas = view === currentActiveView ? getCanvas() : null;

  let previewImageUrl: string | null = null;
  if (canvas) {
    try {
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 0.5 });
      previewImageUrl = await designClient.uploadPreviewSnapshot(dataUrl, view);
    } catch (err) {
      console.error(`Autosave: preview snapshot failed for view ${view}`, err);
    }
  }

  // The autosave route requires a previewImageUrl — without one, skip
  // this cycle rather than send a request we know the server will
  // reject. The canvasJson isn't lost: it stays queued in the store, and
  // the next history change (or a manual retry) will trigger another
  // attempt.
  if (!previewImageUrl) return;

  try {
    await designClient.autosaveView(designId, {
      viewName: view,
      canvasJson: JSON.parse(canvasJsonString),
      previewImageUrl,
    });
  } catch (err) {
    console.error(`Autosave failed for view ${view}`, err);
  }
}
