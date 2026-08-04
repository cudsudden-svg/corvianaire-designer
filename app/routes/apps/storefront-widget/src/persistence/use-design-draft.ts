// Get-or-create the autosave DRAFT for the active product+variant, once,
// on mount. Also hydrates each view's history in useDesignStore from
// whatever the draft already had saved, so reopening the customizer
// resumes exactly where the customer left off.
import { useEffect, useRef, useState } from "react";
import type { DesignState } from "@corvianaire/shared/types";
import { designClient } from "../api/client";
import { getOrCreateGuestSessionId } from "./guest-session";
import { useDesignStore } from "../store/design-store";

export interface UseDesignDraftResult {
  designId: string | null;
  design: DesignState | null;
  loading: boolean;
  error: string | null;
}

export function useDesignDraft(
  shopifyProductId: string | null,
  shopifyVariantId: string | null,
): UseDesignDraftResult {
  const [design, setDesign] = useState<DesignState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!shopifyProductId || !shopifyVariantId) return;
    hydratedRef.current = false;
    setLoading(true);
    setError(null);

    designClient
      .getOrCreateDraft({
        shopifyProductId,
        shopifyVariantId,
        guestSessionId: getOrCreateGuestSessionId(),
      })
      .then((draft) => {
        setDesign(draft);
        if (!hydratedRef.current) {
          hydrateHistoryFromDraft(draft);
          hydratedRef.current = true;
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load your design");
      })
      .finally(() => setLoading(false));
  }, [shopifyProductId, shopifyVariantId]);

  return { designId: design?.id ?? null, design, loading, error };
}

function hydrateHistoryFromDraft(draft: DesignState): void {
  const pushSnapshot = useDesignStore.getState().pushSnapshot;
  for (const view of Object.values(draft.views)) {
    if (!view) continue;
    pushSnapshot(view.viewName, JSON.stringify(view.canvasJson));
  }
}
