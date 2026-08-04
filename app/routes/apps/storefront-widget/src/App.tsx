import { useEffect, useMemo, useState } from "react";
import type { PrintViewName, PrintZoneConfig, ShopifyProduct } from "@corvianaire/shared/types";
import { ProxyApiError } from "@corvianaire/shared/api";
import type { PricingResponse } from "@corvianaire/shared/api";
import { productClient } from "./api/client";
import { CanvasStage } from "./canvas/CanvasStage";
import { ViewTabs } from "./canvas/ViewTabs";
import { VariantSelector, resolveVariant } from "./canvas/VariantSelector";
import type { ViewConfigurationProvider } from "./config/view-configuration-provider";
import { useDesignStore } from "./store/design-store";
import { AddToCartPanel } from "./commerce/AddToCartPanel";
import { useDesignDraft } from "./persistence/use-design-draft";
import { useLoginDraftConflict } from "./persistence/use-login-draft-conflict";
import { LoginConflictPrompt } from "./persistence/LoginConflictPrompt";
import { SaveCheckpointControl } from "./persistence/SaveCheckpointControl";

interface AppProps {
  productHandle: string;
  viewConfigurationProvider: ViewConfigurationProvider;
  /** Shopify customer id if signed in, from Liquid's {{ customer.id }} — null for a guest visitor. */
  customerId: string | null;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "unavailable" }
  | { status: "ready"; product: ShopifyProduct; zones: PrintZoneConfig[] };

export function App({ productHandle, viewConfigurationProvider, customerId }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);

  const activeView = useDesignStore((s) => s.activeView);
  const setActiveView = useDesignStore((s) => s.setActiveView);
  const getCurrentSnapshot = useDesignStore((s) => s.getCurrentSnapshot);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const product = await productClient.getProductByHandle(productHandle);
        const zones = await viewConfigurationProvider.getPrintZones(product.id);
        if (cancelled) return;

        if (zones.length === 0) {
          // A product with no merchant-configured print zones is a valid
          // state, not an error — it just isn't customizable yet. Never
          // fall back to guessed geometry here; that could silently
          // mislead a customer about what will actually print correctly.
          setState({ status: "unavailable" });
          return;
        }

        if (zones[0]) setActiveView(zones[0].viewName);

        const firstVariant = product.variants[0];
        if (firstVariant) {
          const color = firstVariant.selectedOptions.find((o) => o.name.toLowerCase() === "color")?.value;
          const size = firstVariant.selectedOptions.find((o) => o.name.toLowerCase() === "size")?.value;
          setSelectedColor(color ?? null);
          setSelectedSize(size ?? null);
        }

        setState({ status: "ready", product, zones });
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ProxyApiError
            ? error.message
            : "Unable to load the customizer right now.";
        setState({ status: "error", message });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [productHandle, viewConfigurationProvider, setActiveView]);

  const product = state.status === "ready" ? state.product : null;
  const zones = state.status === "ready" ? state.zones : [];
  const views = useMemo<PrintViewName[]>(() => zones.map((z) => z.viewName), [zones]);
  const activeZone = zones.find((z) => z.viewName === activeView) ?? null;

  const selectedVariant = product ? resolveVariant(product, selectedColor, selectedSize) : null;

  // Get-or-create the autosaving DRAFT for this product+variant — this
  // IS the design that autosave writes into, that "Save" clones into a
  // named checkpoint, and that Add to Cart ultimately attaches to the
  // cart line item. One draft, one source of truth, rather than a
  // separate ad-hoc save happening only at add-to-cart time.
  const { designId } = useDesignDraft(product?.id ?? null, selectedVariant?.id ?? null);

  // Fresh-login check: does this visitor have both a guest draft and an
  // account draft for this same product+variant? Only ever non-null
  // right after a sign-in transition — see the hook's own doc comment.
  const loginConflict = useLoginDraftConflict(
    product?.id ?? null,
    selectedVariant?.id ?? null,
    customerId,
  );

  // Color switching (Phase 9): the mockup background image tracks the
  // selected variant's own image — falls back to the product's default
  // image if this variant has none. Design placement is untouched (see
  // useFabricCanvas's color-switching effect — it only ever swaps the
  // background, never the objects array).
  const backgroundImageUrl = selectedVariant?.image?.url ?? product?.images[0]?.url ?? null;

  // Live pricing (Phase 11): recompute whenever the priced-relevant
  // state changes — which views actually have content, and which
  // variant is selected. "Has content" is read straight from each
  // view's persisted snapshot (never includes the safe/bleed overlay —
  // see use-fabric-canvas.ts's persist(), which strips it).
  useEffect(() => {
    if (!product || !selectedVariant) {
      setPricing(null);
      return;
    }

    const usedViews = views.filter((view) => {
      const snapshot = getCurrentSnapshot(view);
      if (!snapshot) return false;
      try {
        const parsed = JSON.parse(snapshot) as { objects?: unknown[] };
        return (parsed.objects?.length ?? 0) > 0;
      } catch {
        return false;
      }
    });

    let cancelled = false;
    productClient
      .getPricing({
        shopifyProductHandle: productHandle,
        shopifyVariantId: selectedVariant.id,
        usedViews,
      })
      .then((result) => {
        if (!cancelled) setPricing(result);
      })
      .catch(() => {
        if (!cancelled) setPricing(null);
      });
    return () => {
      cancelled = true;
    };
    // Re-runs on every view switch too (cheap request) so it stays correct
    // as the customer edits different print locations.
  }, [product, selectedVariant, views, activeView, productHandle, getCurrentSnapshot]);

  if (state.status === "loading") {
    return <p className="corvianaire-studio-loading">Loading product customizer…</p>;
  }
  if (state.status === "error") {
    return <p className="corvianaire-studio-error">{state.message}</p>;
  }
  if (state.status === "unavailable") {
    return (
      <p className="corvianaire-studio-error">
        This product isn't available for customization yet.
      </p>
    );
  }

  return (
    <div className="corvianaire-studio-app">
      {loginConflict && (
        <LoginConflictPrompt conflict={loginConflict} onResolved={loginConflict.onResolved} />
      )}

      <p className="corvianaire-studio-product-title">{state.product.title}</p>

      <VariantSelector
        product={state.product}
        selectedColor={selectedColor}
        selectedSize={selectedSize}
        quantity={quantity}
        onColorChange={setSelectedColor}
        onSizeChange={setSelectedSize}
        onQuantityChange={setQuantity}
      />

      {pricing && (
        <p className="corvianaire-price-display">
          ${(pricing.totalPriceCents / 100).toFixed(2)}
          {pricing.totalDeltaCents > 0 && (
            <small> (base ${(pricing.baseVariantPriceCents / 100).toFixed(2)} + customization)</small>
          )}
        </p>
      )}

      <ViewTabs views={views} activeView={activeView} onSelect={setActiveView} />
      <CanvasStage
        activeView={activeView}
        zone={activeZone}
        backgroundImageUrl={backgroundImageUrl}
        designId={designId}
      />

      <SaveCheckpointControl designId={designId} />

      <AddToCartPanel
        shopifyProductId={state.product.id}
        shopifyVariantId={selectedVariant?.id ?? null}
        quantity={quantity}
        computedPriceCents={pricing?.totalPriceCents ?? null}
        zones={zones}
        designId={designId}
      />
    </div>
  );
}
