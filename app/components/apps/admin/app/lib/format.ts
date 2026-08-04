// Small formatting helpers shared by the admin dashboard (Stage 8). Not
// currency-conversion-aware (single-currency assumption, matching how
// pricing-engine.server.ts already stores everything as plain USD cents)
// — multi-currency display is a follow-up, not a Stage 8 concern.
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
