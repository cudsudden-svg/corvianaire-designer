// Fresh-login detection + conflict check. "Fresh login" is inferred
// client-side: we persist the last customerId this browser saw
// (localStorage) and compare it to the one Liquid just rendered
// ({{ customer.id }}, threaded through from main.tsx). A transition from
// null -> a real id is treated as "just logged in" and triggers exactly
// one conflict check per product+variant per page load.
import { useEffect, useRef, useState } from "react";
import type { LoginDraftConflict } from "@corvianaire/shared/types";
import { designClient } from "../api/client";
import { getOrCreateGuestSessionId } from "./guest-session";

const LAST_SEEN_CUSTOMER_KEY = "corvianaire:lastSeenCustomerId";

export interface LoginConflictState {
  kind: "conflict";
  guestDraft: Extract<LoginDraftConflict, { kind: "conflict" }>["guestDraft"];
  accountDraft: Extract<LoginDraftConflict, { kind: "conflict" }>["accountDraft"];
  onResolved: () => void;
}

export function useLoginDraftConflict(
  shopifyProductId: string | null,
  shopifyVariantId: string | null,
  customerId: string | null,
): LoginConflictState | null {
  const [conflict, setConflict] = useState<LoginConflictState | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!shopifyProductId || !shopifyVariantId || !customerId || checkedRef.current) return;

    let lastSeen: string | null = null;
    try {
      lastSeen = window.localStorage.getItem(LAST_SEEN_CUSTOMER_KEY);
    } catch {
      // localStorage unavailable — treat every load as a fresh login
      // check; worst case is one extra harmless request.
    }

    if (lastSeen === customerId) return; // already handled this login on a prior page load
    checkedRef.current = true;

    const guestSessionId = getOrCreateGuestSessionId();

    designClient
      .checkLoginDraftConflict({ guestSessionId, shopifyProductId, shopifyVariantId })
      .then((result) => {
        try {
          window.localStorage.setItem(LAST_SEEN_CUSTOMER_KEY, customerId);
        } catch {
          // non-fatal — worst case this check runs again next page load
        }

        if (result.kind === "conflict") {
          setConflict({
            kind: "conflict",
            guestDraft: result.guestDraft,
            accountDraft: result.accountDraft,
            onResolved: () => setConflict(null),
          });
        }
      })
      .catch((err) => {
        console.error("Login draft conflict check failed", err);
      });
  }, [shopifyProductId, shopifyVariantId, customerId]);

  return conflict;
}
