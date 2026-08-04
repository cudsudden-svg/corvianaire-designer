import { useEffect, useState } from "react";
import type { PrintZoneConfig } from "@corvianaire/shared/types";
import { ProxyApiError } from "@corvianaire/shared/api";
import { saveCurrentDesign } from "./save-design";
import { generateAndUploadProductionFiles } from "./generate-production-files";
import { addDesignToCart, CartApiError } from "./add-to-cart";
import { useDesignStore } from "../store/design-store";

interface AddToCartPanelProps {
  shopifyProductId: string;
  shopifyVariantId: string | null;
  quantity: number;
  computedPriceCents: number | null;
  zones: PrintZoneConfig[];
  /**
   * The autosaving draft's id (from useDesignDraft in App.tsx), if one
   * exists yet. Passed through as the save's existingDesignId so Add to
   * Cart finalizes the SAME design the customer has been autosaving
   * into — not a second, disconnected Design row. Null only in the
   * unlikely case the draft hasn't been created server-side yet (e.g.
   * variant just changed); saveCurrentDesign still works with null, it
   * just creates a fresh row that first time.
   */
  designId: string | null;
}

type Phase = "idle" | "saving" | "adding" | "success" | "error";

/**
 * Save → generate production files → add to cart, as one customer-facing
 * action. Production files are only generated for views with content, and
 * a failure generating them doesn't block adding to cart (see
 * generate-production-files.ts) — a customer's purchase should never be
 * blocked by a rendering hiccup the merchant can follow up on instead.
 */
export function AddToCartPanel({
  shopifyProductId,
  shopifyVariantId,
  quantity,
  computedPriceCents,
  zones,
  designId,
}: AddToCartPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Seeded from the draft, but tracked locally too: saveCurrentDesign
  // can still return a freshly-created id (designId was null the first
  // time this ran), and subsequent clicks in the same session should
  // reuse THAT id rather than re-reading a possibly-stale prop.
  const [savedDesignId, setSavedDesignId] = useState<string | null>(designId);
  const getCurrentSnapshot = useDesignStore((s) => s.getCurrentSnapshot);

  useEffect(() => {
    if (designId) setSavedDesignId(designId);
  }, [designId]);

  const usedViews = zones
    .map((z) => z.viewName)
    .filter((view) => {
      const snapshot = getCurrentSnapshot(view);
      if (!snapshot) return false;
      try {
        return ((JSON.parse(snapshot) as { objects?: unknown[] }).objects?.length ?? 0) > 0;
      } catch {
        return false;
      }
    });

  async function handleAddToCart() {
    if (!shopifyVariantId) return;
    setPhase("saving");
    setErrorMessage(null);

    try {
      const saved = await saveCurrentDesign({
        existingDesignId: savedDesignId,
        shopifyProductId,
        shopifyVariantId,
        computedPriceCents,
        zones,
      });
      setSavedDesignId(saved.id);

      // Best-effort — see generate-production-files.ts's own doc comment
      // for why a failure here doesn't stop the add-to-cart flow.
      await generateAndUploadProductionFiles(saved.id, zones).catch((error) => {
        console.error("Production file generation failed:", error);
      });

      setPhase("adding");
      await addDesignToCart({
        variantId: shopifyVariantId,
        quantity,
        designId: saved.id,
        usedViews,
      });

      setPhase("success");
    } catch (error) {
      const message =
        error instanceof ProxyApiError || error instanceof CartApiError
          ? error.message
          : "Something went wrong adding this to your cart. Please try again.";
      setErrorMessage(message);
      setPhase("error");
    }
  }

  const isBusy = phase === "saving" || phase === "adding";

  return (
    <div className="corvianaire-add-to-cart">
      <button
        type="button"
        className="corvianaire-add-to-cart-button"
        onClick={handleAddToCart}
        disabled={!shopifyVariantId || isBusy}
      >
        {phase === "saving" && "Saving your design…"}
        {phase === "adding" && "Adding to cart…"}
        {(phase === "idle" || phase === "success" || phase === "error") &&
          (usedViews.length > 0 ? "Add custom design to cart" : "Add to cart")}
      </button>

      {phase === "success" && (
        <p className="corvianaire-add-to-cart-status corvianaire-add-to-cart-success">
          Added to your cart.
        </p>
      )}
      {phase === "error" && errorMessage && (
        <p className="corvianaire-add-to-cart-status corvianaire-error">{errorMessage}</p>
      )}
    </div>
  );
}
