// Keyboard shortcuts for the active canvas. Attached on mount, removed on
// unmount, so shortcuts only apply while the editor is actually on
// screen — never globally on the storefront page.
import type { fabric as FabricNS } from "fabric";

const NUDGE_AMOUNT = 1; // px
const NUDGE_AMOUNT_SHIFT = 10; // px, held with Shift for coarse movement

export interface KeyboardShortcutHandlers {
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function attachKeyboardShortcuts(
  canvas: FabricNS.Canvas,
  handlers: KeyboardShortcutHandlers,
): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    // Don't hijack typing in other page inputs, or while Fabric is
    // already handling text-editing keystrokes for an active IText.
    const activeObject = canvas.getActiveObject();
    const isEditingText =
      activeObject &&
      "isEditing" in activeObject &&
      (activeObject as unknown as { isEditing?: boolean }).isEditing;
    const target = event.target as HTMLElement | null;
    const isTypingElsewhere =
      target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

    if (isEditingText || isTypingElsewhere) return;

    const isMeta = event.metaKey || event.ctrlKey;

    if (isMeta && event.key.toLowerCase() === "z" && !event.shiftKey) {
      event.preventDefault();
      handlers.onUndo();
      return;
    }
    if (
      isMeta &&
      (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey))
    ) {
      event.preventDefault();
      handlers.onRedo();
      return;
    }
    if (isMeta && event.key.toLowerCase() === "d") {
      event.preventDefault();
      handlers.onDuplicate();
      return;
    }
    if ((event.key === "Delete" || event.key === "Backspace") && canvas.getActiveObject()) {
      event.preventDefault();
      handlers.onDelete();
      return;
    }

    if (event.key.startsWith("Arrow") && canvas.getActiveObject()) {
      const amount = event.shiftKey ? NUDGE_AMOUNT_SHIFT : NUDGE_AMOUNT;
      const obj = canvas.getActiveObject();
      if (!obj) return;
      event.preventDefault();

      switch (event.key) {
        case "ArrowUp":
          obj.set({ top: (obj.top ?? 0) - amount });
          break;
        case "ArrowDown":
          obj.set({ top: (obj.top ?? 0) + amount });
          break;
        case "ArrowLeft":
          obj.set({ left: (obj.left ?? 0) - amount });
          break;
        case "ArrowRight":
          obj.set({ left: (obj.left ?? 0) + amount });
          break;
      }
      obj.setCoords();
      canvas.requestRenderAll();
      canvas.fire("object:modified", { target: obj });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}
