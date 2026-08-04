// Cart integration (Stage 7) — the widget is a Theme App Extension
// block embedded in the storefront's own product page, so "add to cart"
// means Shopify's own AJAX Cart API (/cart/add.js), not a custom
// endpoint. This keeps the customized product behaving like any other
// cart line item for every existing theme feature (cart drawer, upsells,
// discount codes, etc.) — nothing about checkout has to know Corvianaire
// Studio exists.
import type { PrintViewName } from "@corvianaire/shared/types";

export interface AddToCartParams {
  /** ShopifyProductVariant.id — a GID ("gid://shopify/ProductVariant/123"), same shape as everywhere else this app handles variant ids. */
  variantId: string;
  quantity: number;
  designId: string;
  usedViews: PrintViewName[];
}

export class CartApiError extends Error {}

/** The AJAX Cart API (/cart/add.js) wants the bare numeric id, not the GID form the rest of this app uses. */
function numericIdFromGid(gid: string): number {
  const match = /(\d+)$/.exec(gid);
  return match ? Number(match[1]) : Number(gid);
}

/**
 * `_design_id` is the ONLY property the order webhook actually depends
 * on (see apps/admin/app/features/orders/order.server.ts) — Shopify
 * excludes any line item property whose name starts with `_` from the
 * customer-facing cart/checkout/order UI automatically, so this stays an
 * internal reference. "Customization" is a plain, visible property so
 * the customer sees confirmation of what they customized in their own
 * cart, independent of that internal id.
 */
export function buildDesignCartProperties(
  designId: string,
  usedViews: PrintViewName[],
): Record<string, string> {
  return {
    _design_id: designId,
    Customization: usedViews.length > 0 ? usedViews.join(", ") : "None",
  };
}

export async function addDesignToCart(params: AddToCartParams): Promise<void> {
  const response = await fetch("/cart/add.js", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [
        {
          id: numericIdFromGid(params.variantId),
          quantity: params.quantity,
          properties: buildDesignCartProperties(params.designId, params.usedViews),
        },
      ],
    }),
  });

  if (!response.ok) {
    let message = "Couldn't add this design to your cart.";
    try {
      const body = (await response.json()) as { description?: string; message?: string };
      message = body.description ?? body.message ?? message;
    } catch {
      // response body wasn't JSON — keep the generic message
    }
    throw new CartApiError(message);
  }
}
