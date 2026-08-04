import { useEffect, useState } from "react";
import { loadFabric } from "../canvas/load-fabric";
import type { UseFabricCanvasResult } from "../canvas/use-fabric-canvas";
import {
  AVAILABLE_FONTS,
  applyTextStyle,
  createTextObject,
  DEFAULT_TEXT_STYLE,
  type TextStyle,
} from "../text/text-renderer";

interface TextToolPanelProps {
  fabricCanvas: UseFabricCanvasResult;
}

export function TextToolPanel({ fabricCanvas }: TextToolPanelProps) {
  const [style, setStyle] = useState<TextStyle>(DEFAULT_TEXT_STYLE);
  const [selected, setSelected] = useState<import("fabric").fabric.IText | null>(null);

  // Track selection so the style controls edit whatever text object is
  // currently active, and reflect its current style when selected.
  useEffect(() => {
    const canvas = fabricCanvas.getCanvas();
    if (!canvas) return;

    const onSelection = () => {
      const active = canvas.getActiveObject();
      if (active && active.type === "i-text") {
        const textObj = active as import("fabric").fabric.IText;
        setSelected(textObj);
        setStyle(readStyleFromObject(textObj));
      } else {
        setSelected(null);
      }
    };

    canvas.on("selection:created", onSelection);
    canvas.on("selection:updated", onSelection);
    canvas.on("selection:cleared", onSelection);

    return () => {
      canvas.off("selection:created", onSelection);
      canvas.off("selection:updated", onSelection);
      canvas.off("selection:cleared", onSelection);
    };
  }, [fabricCanvas]);

  async function handleAddText() {
    const { fabric } = await loadFabric();
    const textObject = createTextObject(fabric, "Double-click to edit", DEFAULT_TEXT_STYLE, {
      left: 50,
      top: 50,
    });
    fabricCanvas.addObject(textObject);
    setSelected(textObject);
    setStyle(DEFAULT_TEXT_STYLE);
  }

  async function updateStyle(patch: Partial<TextStyle>) {
    const next = { ...style, ...patch };
    setStyle(next);
    if (!selected) return;

    const { fabric } = await loadFabric();
    applyTextStyle(fabric, selected, next);
    const canvas = fabricCanvas.getCanvas();
    canvas?.renderAll();
    // Style edits don't come from mouse interaction, so they don't fire
    // Fabric's object:modified on their own — fire it manually so the
    // shared history/persist listener (registered in useFabricCanvas)
    // still records this change.
    canvas?.fire("object:modified", { target: selected });
  }

  return (
    <div className="corvianaire-tool-panel corvianaire-text-tool">
      <button type="button" onClick={handleAddText} disabled={!fabricCanvas.ready}>
        Add text
      </button>

      {selected && (
        <div className="corvianaire-text-style-controls">
          <label>
            Font
            <select value={style.fontFamily} onChange={(e) => updateStyle({ fontFamily: e.target.value })}>
              {AVAILABLE_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>

          <label>
            Size
            <input
              type="number"
              min={8}
              max={200}
              value={style.fontSize}
              onChange={(e) => updateStyle({ fontSize: Number(e.target.value) })}
            />
          </label>

          <div className="corvianaire-text-style-row">
            <button
              type="button"
              className={style.fontWeight === "bold" ? "is-active" : ""}
              onClick={() => updateStyle({ fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })}
            >
              B
            </button>
            <button
              type="button"
              className={style.fontStyle === "italic" ? "is-active" : ""}
              onClick={() => updateStyle({ fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })}
            >
              I
            </button>
            <button
              type="button"
              className={style.underline ? "is-active" : ""}
              onClick={() => updateStyle({ underline: !style.underline })}
            >
              U
            </button>
          </div>

          <div className="corvianaire-text-style-row">
            {(["left", "center", "right"] as const).map((align) => (
              <button
                key={align}
                type="button"
                className={style.textAlign === align ? "is-active" : ""}
                onClick={() => updateStyle({ textAlign: align })}
              >
                {align}
              </button>
            ))}
          </div>

          <label>
            Color
            <input type="color" value={style.fill} onChange={(e) => updateStyle({ fill: e.target.value })} />
          </label>

          <label>
            <input
              type="checkbox"
              checked={style.shadow !== null}
              onChange={(e) =>
                updateStyle({
                  shadow: e.target.checked
                    ? { color: "#000000", blur: 6, offsetX: 3, offsetY: 3 }
                    : null,
                })
              }
            />
            Shadow
          </label>
          {style.shadow && (
            <input
              type="color"
              value={style.shadow.color}
              onChange={(e) => updateStyle({ shadow: { ...style.shadow!, color: e.target.value } })}
            />
          )}

          <label>
            <input
              type="checkbox"
              checked={style.outline !== null}
              onChange={(e) =>
                updateStyle({ outline: e.target.checked ? { color: "#000000", width: 2 } : null })
              }
            />
            Outline
          </label>
          {style.outline && (
            <input
              type="color"
              value={style.outline.color}
              onChange={(e) => updateStyle({ outline: { ...style.outline!, color: e.target.value } })}
            />
          )}

          <label className="corvianaire-curved-text-toggle" title="Coming in Stage 5">
            <input type="checkbox" checked={false} disabled />
            Curved text — Coming soon
          </label>
        </div>
      )}
    </div>
  );
}

function readStyleFromObject(obj: import("fabric").fabric.IText): TextStyle {
  return {
    fontFamily: (obj.fontFamily as string) ?? DEFAULT_TEXT_STYLE.fontFamily,
    fontSize: obj.fontSize ?? DEFAULT_TEXT_STYLE.fontSize,
    fontWeight: (obj.fontWeight as "normal" | "bold") ?? "normal",
    fontStyle: (obj.fontStyle as "normal" | "italic") ?? "normal",
    underline: obj.underline ?? false,
    fill: (obj.fill as string) ?? DEFAULT_TEXT_STYLE.fill,
    textAlign: (obj.textAlign as TextStyle["textAlign"]) ?? "left",
    shadow:
      obj.shadow && typeof obj.shadow === "object"
        ? {
            color: (obj.shadow as import("fabric").fabric.Shadow).color ?? "#000000",
            blur: (obj.shadow as import("fabric").fabric.Shadow).blur ?? 6,
            offsetX: (obj.shadow as import("fabric").fabric.Shadow).offsetX ?? 3,
            offsetY: (obj.shadow as import("fabric").fabric.Shadow).offsetY ?? 3,
          }
        : null,
    outline: obj.strokeWidth ? { color: (obj.stroke as string) ?? "#000000", width: obj.strokeWidth } : null,
    curved: false,
  };
}
