// Guest session id. Generated once per browser on first canvas
// interaction, persisted in localStorage so the same visitor's DRAFT can
// be found again on a later visit before they have an account. Cleared
// once a design is adopted into a real customerId — see design.server.ts
// getOrCreateDraft/adoptGuestDraft, which null it out server-side.
const STORAGE_KEY = "corvianaire:guestSessionId";

export function getOrCreateGuestSessionId(): string {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;

    const fresh = crypto.randomUUID();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // localStorage unavailable (private browsing, embedded iframe
    // restrictions, etc.) — fall back to an in-memory id for this page
    // load only. The draft still autosaves; it just won't be
    // rediscoverable on a future visit until the customer logs in.
    return crypto.randomUUID();
  }
}
