// Order integration — the bridge between a real Shopify order and the
// Design rows the customer built it from. The cart line item carries the
// design's id as a hidden `_design_id` property (see
// apps/storefront-widget/src/commerce/add-to-cart.ts) — Shopify's
// underscore-prefixed line item properties are excluded from the
// customer-facing order confirmation/printouts automatically, so this
// stays an internal reference only.
import prisma from "~/lib/db/db.server";
import { getDesignById, markDesignOrdered } from "~/features/designs/design.server";
import { getSupplierProviderForZone } from "~/features/suppliers/supplier-provider.server";

const DESIGN_ID_PROPERTY = "_design_id";

interface OrderWebhookLineItemProperty {
  name: string;
  value: string;
}

interface OrderWebhookLineItem {
  properties?: OrderWebhookLineItemProperty[] | null;
}

export interface OrderWebhookPayload {
  id: number | string;
  line_items?: OrderWebhookLineItem[];
}

function extractDesignIds(payload: OrderWebhookPayload): string[] {
  const ids = new Set<string>();
  for (const lineItem of payload.line_items ?? []) {
    const match = lineItem.properties?.find((p) => p.name === DESIGN_ID_PROPERTY);
    if (match?.value) ids.add(match.value);
  }
  return [...ids];
}

/**
 * Process one orders/create webhook: for every design referenced by the
 * order's line items, mark it ORDERED and — if it has at least one
 * production file ready — hand it to the resolved SupplierProvider. A
 * design with no production files yet (client-side generation failed or
 * was skipped) is still marked ORDERED so it's visible in the admin
 * dashboard (Stage 8) as needing manual attention, but production
 * submission itself is skipped rather than calling a supplier with
 * nothing to send.
 */
export async function processOrderWebhook(shopDomain: string, payload: OrderWebhookPayload): Promise<void> {
  const shopifyOrderId = String(payload.id);
  const designIds = extractDesignIds(payload);

  for (const designId of designIds) {
    const design = await getDesignById(designId);
    if (!design || design.shopDomain !== shopDomain) continue; // never trust a cross-shop id

    // Idempotency guard: Shopify redelivers webhooks (retries on non-2xx,
    // and redelivery isn't strictly limited to failures either) — without
    // this check, a redelivered orders/create would call
    // submitToSupplier() again and could place a second real production
    // order with the supplier for the same physical item. A design only
    // ever gets ONE supplier submission attempt, ever; already-ORDERED is
    // treated as fully handled, whether or not that attempt succeeded.
    if (design.status === "ORDERED") continue;

    const productionFiles = design.views
      .filter((v) => v.productionFileUrl)
      .map((v) => ({ viewName: v.viewName, fileUrl: v.productionFileUrl! }));

    if (productionFiles.length === 0) {
      await markDesignOrdered(design.id, { shopifyOrderId });
      continue;
    }

    const supplierOrderId = await submitToSupplier(shopDomain, design, shopifyOrderId, productionFiles);
    await markDesignOrdered(design.id, { shopifyOrderId, supplierOrderId });
  }
}

export async function submitToSupplier(
  shopDomain: string,
  design: { id: string; shopifyProductId: string; views: { viewName: string }[] },
  shopifyOrderId: string,
  productionFiles: Array<{ viewName: string; fileUrl: string }>,
): Promise<string | undefined> {
  // One supplier per design submission (matches SubmitProductionOrderInput's
  // shape — a single call carrying every view's file). The zone attached
  // to the first used view decides which supplier that is; falls back to
  // the shop's default, then to ManualSupplierProvider — never a hard
  // failure over an unconfigured supplier.
  const firstView = design.views[0];
  const zone = firstView
    ? await prisma.printZone.findUnique({
        where: {
          shopDomain_shopifyProductId_viewName: {
            shopDomain,
            shopifyProductId: design.shopifyProductId,
            viewName: firstView.viewName,
          },
        },
      })
    : null;

  const provider = await getSupplierProviderForZone(shopDomain, zone?.supplierId ?? null);

  try {
    const result = await provider.submitProductionOrder({
      shopDomain,
      designId: design.id,
      shopifyOrderId,
      productionFiles,
    });
    return result.supplierOrderId;
  } catch (error) {
    // A supplier API failure shouldn't fail the webhook (Shopify retries
    // failed webhooks, which would just resubmit) — the design is still
    // marked ORDERED above with no supplierOrderId, visible in Stage 8's
    // dashboard as needing manual follow-up.
    console.error(`Supplier submission failed for design ${design.id}:`, error);
    return undefined;
  }
}

export type RetryProductionSubmissionResult =
  | { ok: true; supplierOrderId: string }
  | { ok: false; reason: string };

/**
 * Admin-triggered retry for a design that's ORDERED but never made it to
 * the supplier (a failed/skipped submission from processOrderWebhook —
 * see its doc comment). Same submission path, just invoked from the
 * dashboard instead of the webhook, and returns a result the UI can show
 * directly instead of only logging.
 */
export async function retryProductionSubmission(
  shopDomain: string,
  designId: string,
): Promise<RetryProductionSubmissionResult> {
  const design = await getDesignById(designId);
  if (!design || design.shopDomain !== shopDomain) {
    return { ok: false, reason: "Design not found." };
  }
  if (design.status !== "ORDERED" || !design.shopifyOrderId) {
    return { ok: false, reason: "This design hasn't been ordered yet." };
  }
  if (design.supplierOrderId) {
    return { ok: false, reason: "Already submitted to the supplier." };
  }

  const productionFiles = design.views
    .filter((v) => v.productionFileUrl)
    .map((v) => ({ viewName: v.viewName, fileUrl: v.productionFileUrl! }));

  if (productionFiles.length === 0) {
    return { ok: false, reason: "No production files are available for this design yet." };
  }

  const supplierOrderId = await submitToSupplier(
    shopDomain,
    design,
    design.shopifyOrderId,
    productionFiles,
  );
  if (!supplierOrderId) {
    return { ok: false, reason: "Supplier submission failed again — check server logs." };
  }

  await markDesignOrdered(design.id, { shopifyOrderId: design.shopifyOrderId, supplierOrderId });
  return { ok: true, supplierOrderId };
}
