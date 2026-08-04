// Shared across the dashboard home, designs list, and design detail
// pages (Stage 8) so "needs attention" (ORDERED with no supplierOrderId
// — see order.server.ts's doc comment) reads identically everywhere
// rather than three slightly-different badge implementations.
import { Badge } from "@shopify/polaris";

export function StatusBadge({
  status,
  supplierOrderId,
}: {
  status: "DRAFT" | "SAVED" | "ORDERED";
  supplierOrderId?: string | null;
}) {
  if (status === "ORDERED" && !supplierOrderId) {
    return <Badge tone="critical">Needs attention</Badge>;
  }
  if (status === "ORDERED") return <Badge tone="success">Ordered</Badge>;
  if (status === "SAVED") return <Badge tone="info">Saved</Badge>;
  return <Badge>Draft</Badge>;
}
