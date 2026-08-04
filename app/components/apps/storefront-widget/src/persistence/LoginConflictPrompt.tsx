// Login-conflict picker. Rendered only when both a guest draft and an
// account draft exist for the same product+variant. Neither design is
// touched until the customer picks — see proxy.designs.resolve-login.tsx's
// POST handler.
import { useState } from "react";
import type { LoginConflictState } from "./use-login-draft-conflict";
import { designClient } from "../api/client";
import { useDesignStore } from "../store/design-store";

interface LoginConflictPromptProps {
  conflict: LoginConflictState;
  onResolved: () => void;
}

export function LoginConflictPrompt({ conflict, onResolved }: LoginConflictPromptProps) {
  const [submitting, setSubmitting] = useState<"guest" | "account" | null>(null);
  const pushSnapshot = useDesignStore((s) => s.pushSnapshot);

  async function choose(which: "guest" | "account") {
    setSubmitting(which);
    const chosen = which === "guest" ? conflict.guestDraft : conflict.accountDraft;
    try {
      await designClient.chooseLoginDraft(chosen.id);
      // Reload the chosen design's views into the in-memory history so
      // the canvas reflects the pick immediately, same hydration path
      // use-design-draft.ts uses on first mount.
      const full = await designClient.loadFullDesign(chosen.id);
      for (const view of Object.values(full.views)) {
        if (!view) continue;
        pushSnapshot(view.viewName, JSON.stringify(view.canvasJson));
      }
      onResolved();
    } catch (err) {
      console.error("Failed to resolve login draft conflict", err);
      setSubmitting(null);
    }
  }

  return (
    <div className="corvianaire-login-conflict-prompt" role="dialog" aria-modal="true">
      <p>
        You have two in-progress designs for this product — one saved while signed out, and one on
        your account. Which would you like to continue?
      </p>
      <div className="corvianaire-login-conflict-options">
        <button type="button" disabled={submitting !== null} onClick={() => void choose("guest")}>
          {submitting === "guest" ? "Loading…" : "Continue guest draft"}
        </button>
        <button type="button" disabled={submitting !== null} onClick={() => void choose("account")}>
          {submitting === "account" ? "Loading…" : "Continue account draft"}
        </button>
      </div>
    </div>
  );
}
