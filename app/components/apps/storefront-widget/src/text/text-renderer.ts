// TextRenderer — the one place text objects get created/restyled on the
// canvas. Per the Stage 4 planning decision: Fabric.js has no built-in
// curved text, and we're NOT building a custom curved-text engine here.
// Standard Fabric IText editing is fully implemented now; `curved` is
// modeled in the style type and always rejected by applyTextStyle today,
// so the UI can show a disabled "Curved text — coming soon" toggle whose
// wiring already exists, and Stage 5 only has to implement the rendering
// path (e.g. swap IText for a Path-based renderer when curved is true) —
// no call site elsewhere in the app needs to change.
type FabricNS = typeof import("fabric").fabric;

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";

export interface ShadowStyle {
  color: string;
  blur: number;
  offsetX: number;
  offsetY: number;
}

export interface OutlineStyle {
  color: string;
  width: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: FontWeight;
  fontStyle: FontStyle;
  underline: boolean;
  fill: string;
  textAlign: TextAlign;
  shadow: ShadowStyle | null;
  outline: OutlineStyle | null;
  /** Always false until Stage 5 — see file header. */
  curved: boolean;
}

// Curated web-safe-ish set — no font loading pipeline exists yet (that's a
// documented Stage 5+ enhancement alongside curved text), so this list is
// intentionally limited to fonts that render consistently without one.
export const AVAILABLE_FONTS = [
  "Arial",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Comic Sans MS",
] as const;

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Arial",
  fontSize: 32,
  fontWeight: "normal",
  fontStyle: "normal",
  underline: false,
  fill: "#111111",
  textAlign: "left",
  shadow: null,
  outline: null,
  curved: false,
};

export interface CreateTextOptions {
  left: number;
  top: number;
}

export function createTextObject(
  fabricModule: FabricNS,
  text: string,
  style: TextStyle,
  position: CreateTextOptions,
): import("fabric").fabric.IText {
  if (style.curved) {
    // Guard rail, not a real feature path — the UI never actually lets
    // curved get set to true yet (its toggle is disabled), so reaching
    // this is a bug elsewhere, not a user-facing case.
    throw new Error("Curved text is not implemented until Stage 5");
  }

  const textObject = new fabricModule.IText(text, {
    left: position.left,
    top: position.top,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    underline: style.underline,
    fill: style.fill,
    textAlign: style.textAlign,
  });

  applyEffects(fabricModule, textObject, style);
  return textObject;
}

export function applyTextStyle(
  fabricModule: FabricNS,
  target: import("fabric").fabric.IText,
  style: TextStyle,
): void {
  if (style.curved) {
    throw new Error("Curved text is not implemented until Stage 5");
  }

  target.set({
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    underline: style.underline,
    fill: style.fill,
    textAlign: style.textAlign,
  });

  applyEffects(fabricModule, target, style);
}

function applyEffects(fabricModule: FabricNS, target: import("fabric").fabric.IText, style: TextStyle): void {
  target.set({
    shadow: style.shadow
      ? new fabricModule.Shadow({
          color: style.shadow.color,
          blur: style.shadow.blur,
          offsetX: style.shadow.offsetX,
          offsetY: style.shadow.offsetY,
        })
      : undefined,
    stroke: style.outline?.color,
    strokeWidth: style.outline ? style.outline.width : 0,
    paintFirst: style.outline ? "stroke" : "fill",
  });
}
