import { useState } from "react";
import type { PrintViewName, PrintZoneConfig } from "@corvianaire/shared/types";
import { useFabricCanvas } from "./use-fabric-canvas";
import { TextToolPanel } from "../tools/TextToolPanel";
import { ImageUploadTool } from "../tools/ImageUploadTool";
import { ClipartLibrary } from "../tools/ClipartLibrary";
import { usePersistedDesignAutosave } from "../persistence/use-persisted-design-autosave";

interface CanvasStageProps {
  activeView: PrintViewName;
  zone: PrintZoneConfig | null;
  backgroundImageUrl: string | null;
  /** Null until the draft has been created server-side — autosave is a no-op until then. */
  designId: string | null;
}

type ToolTab = "text" | "upload" | "clipart";

const TOOL_TABS: { id: ToolTab; label: string }[] = [
  { id: "text", label: "Text" },
  { id: "upload", label: "Upload" },
  { id: "clipart", label: "Clipart" },
];

export function CanvasStage({ activeView, zone, backgroundImageUrl, designId }: CanvasStageProps) {
  const fabricCanvas = useFabricCanvas(activeView, zone, backgroundImageUrl);
  const [activeTool, setActiveTool] = useState<ToolTab>("text");
  const ready = fabricCanvas.ready;

  // Continuously autosaves as the customer edits — watches the design
  // store's history (which use-fabric-canvas.ts already updates on every
  // edit/undo/redo), debounced, independent of whatever tool is active.
  usePersistedDesignAutosave(designId, activeView, fabricCanvas.getCanvas);

  return (
    <div className="corvianaire-canvas-stage">
      <div className="corvianaire-canvas-toolbar">
        <button type="button" onClick={fabricCanvas.undo} disabled={!ready || !fabricCanvas.canUndo}>
          Undo
        </button>
        <button type="button" onClick={fabricCanvas.redo} disabled={!ready || !fabricCanvas.canRedo}>
          Redo
        </button>

        <span className="corvianaire-toolbar-divider" />

        <button type="button" onClick={fabricCanvas.duplicate} disabled={!ready || !fabricCanvas.hasSelection}>
          Duplicate
        </button>
        <button type="button" onClick={fabricCanvas.deleteSelected} disabled={!ready || !fabricCanvas.hasSelection}>
          Delete
        </button>
        <button type="button" onClick={fabricCanvas.flipHorizontal} disabled={!ready || !fabricCanvas.hasSelection} title="Flip horizontal">
          Flip ↔
        </button>
        <button type="button" onClick={fabricCanvas.flipVertical} disabled={!ready || !fabricCanvas.hasSelection} title="Flip vertical">
          Flip ↕
        </button>

        <span className="corvianaire-toolbar-divider" />

        <button type="button" onClick={fabricCanvas.bringForward} disabled={!ready || !fabricCanvas.hasSelection} title="Bring forward">
          ↑ Layer
        </button>
        <button type="button" onClick={fabricCanvas.sendBackward} disabled={!ready || !fabricCanvas.hasSelection} title="Send backward">
          ↓ Layer
        </button>
        <button type="button" onClick={fabricCanvas.bringToFront} disabled={!ready || !fabricCanvas.hasSelection} title="Bring to front">
          ⤒ Front
        </button>
        <button type="button" onClick={fabricCanvas.sendToBack} disabled={!ready || !fabricCanvas.hasSelection} title="Send to back">
          ⤓ Back
        </button>

        <span className="corvianaire-toolbar-divider" />

        <button type="button" onClick={fabricCanvas.zoomOut} disabled={!ready} title="Zoom out">
          −
        </button>
        <span className="corvianaire-zoom-readout">{Math.round(fabricCanvas.zoom * 100)}%</span>
        <button type="button" onClick={fabricCanvas.zoomIn} disabled={!ready} title="Zoom in">
          +
        </button>
        <button type="button" onClick={fabricCanvas.zoomReset} disabled={!ready} title="Reset zoom">
          Reset
        </button>
      </div>

      {fabricCanvas.dpiWarning && (
        <p className="corvianaire-dpi-warning">
          ⚠ Low resolution: this image will print at ~{Math.round(fabricCanvas.dpiWarning.effectiveDpi)} DPI,
          below the recommended {fabricCanvas.dpiWarning.requiredDpi} DPI for this print area. Consider using a
          higher-resolution file or making it smaller.
        </p>
      )}

      <canvas ref={fabricCanvas.canvasElRef} />
      {!ready && <p className="corvianaire-canvas-loading">Loading editor…</p>}

      <div className="corvianaire-tool-tabs">
        {TOOL_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={tab.id === activeTool ? "is-active" : ""}
            onClick={() => setActiveTool(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTool === "text" && <TextToolPanel fabricCanvas={fabricCanvas} />}
      {activeTool === "upload" && <ImageUploadTool fabricCanvas={fabricCanvas} />}
      {activeTool === "clipart" && <ClipartLibrary fabricCanvas={fabricCanvas} />}
    </div>
  );
}
