// Shared design/customization types, mirroring the Prisma models in
// prisma/schema.prisma. Kept as plain interfaces (rather than importing
// Prisma's generated types everywhere) so client-side code — which can't
// import @prisma/client — can still share the same shapes.

export type PrintViewName =
  | "front"
  | "back"
  | "left-sleeve"
  | "right-sleeve"
  | "hood"
  | "neck-label";

export interface PrintZoneConfig {
  viewName: PrintViewName;
  safeArea: Rect;
  bleedArea: Rect;
  /**
   * Real-world size of the safe area, in inches — the source of truth
   * for DPI math. Never derive physical size from canvas px; canvas px
   * is a design-space convenience for rendering the editor, not a
   * production measurement.
   */
  physicalWidthIn: number;
  physicalHeightIn: number;
  bleedMarginIn: number;
  targetDpi: number;
  allowedFileFormats: string[];
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesignViewState {
  viewName: PrintViewName;
  // Raw fabric.Canvas#toJSON() output — kept as `unknown` at this shared-type
  // layer since its exact shape is Fabric's, not ours; the canvas editor
  // feature module (Stage 3) narrows it further where it's actually used.
  canvasJson: unknown;
  previewImageUrl: string | null;
}

export type DesignStatus = "DRAFT" | "SAVED" | "ORDERED";

export interface DesignState {
  id: string | null; // null until first saved
  status: DesignStatus;
  /** Set only on an explicit "Save" checkpoint (Stage 6/9 restoration) — null for the one autosaved DRAFT per owner+product+variant. */
  name: string | null;
  shopifyProductId: string;
  shopifyVariantId: string;
  customerNotes: string;
  computedPriceCents: number | null;
  views: Record<PrintViewName, DesignViewState | undefined>;
}

/** One row in the "My Designs" checkpoint picker — lighter than DesignState (no canvasJson). */
export interface DesignCheckpointSummary {
  id: string;
  name: string | null;
  shopifyProductId: string;
  shopifyVariantId: string;
  updatedAt: string; // ISO
  previewImageUrl: string | null;
}

export interface DesignCheckpointPage {
  items: DesignCheckpointSummary[];
  nextCursor: string | null;
}

/**
 * Result of checking for a guest-draft/account-draft conflict at login.
 * Both drafts are left untouched in the DB either way — this is purely
 * "does the customer need to be asked?".
 */
export type LoginDraftConflict =
  | { kind: "none" }
  | { kind: "single"; design: DesignCheckpointSummary }
  | {
      kind: "conflict";
      guestDraft: DesignCheckpointSummary;
      accountDraft: DesignCheckpointSummary;
    };

// ─── Commerce (Stage 7) ───

/** One view's payload when saving a design — canvas state plus an optional freshly-rendered preview to upload. */
export interface SaveDesignViewInput {
  viewName: PrintViewName;
  canvasJson: unknown;
  /** Data URL (e.g. "data:image/png;base64,...") rendered client-side via a headless fabric.StaticCanvas — omitted for an empty view. */
  previewImageDataUrl?: string;
}

export interface SaveDesignInput {
  /** Omit to create a new Design; include to update one the customer already saved (e.g. re-saving after edits, still pre-checkout). */
  id?: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  customerNotes?: string;
  computedPriceCents?: number;
  views: SaveDesignViewInput[];
}

export interface SavedDesignView {
  viewName: PrintViewName;
  previewImageUrl: string | null;
}

export interface SavedDesign {
  id: string;
  status: DesignStatus;
  views: SavedDesignView[];
}

/** One view's high-resolution, print-ready render, generated client-side at the print zone's target DPI — see productionRenderMultiplier(). */
export interface ProductionFileInput {
  viewName: PrintViewName;
  fileDataUrl: string;
}

export interface ProductionFileResult {
  viewName: PrintViewName;
  productionFileUrl: string;
}
