import { create } from "zustand";
import type { PrintViewName } from "@corvianaire/shared/types";

/** Serialized fabric.Canvas#toJSON() output, kept as a string for cheap diffing/storage. */
type CanvasSnapshot = string;

interface ViewHistory {
  past: CanvasSnapshot[];
  present: CanvasSnapshot | null;
  future: CanvasSnapshot[];
}

function emptyHistory(): ViewHistory {
  return { past: [], present: null, future: [] };
}

// Cap history depth per view so a long editing session doesn't grow memory
// unbounded — oldest snapshots just fall off.
const MAX_HISTORY_PER_VIEW = 50;

interface DesignStoreState {
  activeView: PrintViewName;
  /** Independent history per print view — switching views never touches another view's stack. */
  histories: Partial<Record<PrintViewName, ViewHistory>>;

  setActiveView: (view: PrintViewName) => void;

  /** Record a new canvas state for a view (called after every user edit). Clears that view's redo stack. */
  pushSnapshot: (view: PrintViewName, snapshot: CanvasSnapshot) => void;

  /** Step a single view's history backward. Returns the snapshot to load into that view's canvas, or null if nothing to undo. */
  undo: (view: PrintViewName) => CanvasSnapshot | null;

  /** Step a single view's history forward. Returns the snapshot to load, or null if nothing to redo. */
  redo: (view: PrintViewName) => CanvasSnapshot | null;

  canUndo: (view: PrintViewName) => boolean;
  canRedo: (view: PrintViewName) => boolean;

  getCurrentSnapshot: (view: PrintViewName) => CanvasSnapshot | null;
}

export const useDesignStore = create<DesignStoreState>((set, get) => ({
  activeView: "front",
  histories: {},

  setActiveView: (view) => set({ activeView: view }),

  pushSnapshot: (view, snapshot) =>
    set((state) => {
      const current = state.histories[view] ?? emptyHistory();
      const nextPast =
        current.present === null ? current.past : [...current.past, current.present];

      return {
        histories: {
          ...state.histories,
          [view]: {
            past: nextPast.slice(-MAX_HISTORY_PER_VIEW),
            present: snapshot,
            future: [], // any new edit invalidates the redo stack for THIS view only
          },
        },
      };
    }),

  undo: (view) => {
    const current = get().histories[view];
    if (!current || current.past.length === 0) return null;

    const previous = current.past[current.past.length - 1]!;
    const remainingPast = current.past.slice(0, -1);
    const future =
      current.present !== null ? [current.present, ...current.future] : current.future;

    set((state) => ({
      histories: {
        ...state.histories,
        [view]: { past: remainingPast, present: previous, future },
      },
    }));

    return previous;
  },

  redo: (view) => {
    const current = get().histories[view];
    if (!current || current.future.length === 0) return null;

    const next = current.future[0]!;
    const remainingFuture = current.future.slice(1);
    const past = current.present !== null ? [...current.past, current.present] : current.past;

    set((state) => ({
      histories: {
        ...state.histories,
        [view]: { past, present: next, future: remainingFuture },
      },
    }));

    return next;
  },

  canUndo: (view) => (get().histories[view]?.past.length ?? 0) > 0,
  canRedo: (view) => (get().histories[view]?.future.length ?? 0) > 0,

  getCurrentSnapshot: (view) => get().histories[view]?.present ?? null,
}));
