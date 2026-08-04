// App proxy route: POST /apps/studio/pricing
// The storefront widget calls this every time the customer's design
// changes in a price-relevant way (views used, technique, font tier,
// asset type). Base price is resolved LIVE from the Storefront API by
// variant ID — never hardcoded, never cached here — then the pricing
// engine applies whatever PricingRules the merchant has configured.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getProductStorefront } from "~/features/product-loader/product-loader.server";
import { computePrice } from "~/features/pricing/pricing-engine.server";

interface PricingRequestBody {
  shopifyProductHandle: string;
  shopifyVariantId: string;
  usedViews: string[];
  techniqueByView?: Record<string, string>;
  usedPremiumFont?: boolean;
  assetTypeByView?: Record<string, "uploaded" | "clipart">;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const body = (await request.json()) as PricingRequestBody;
  if (!body.shopifyProductHandle || !body.shopifyVariantId) {
    return json({ error: "Missing shopifyProductHandle or shopifyVariantId" }, { status: 400 });
  }

  const product = await getProductStorefront(session.shop, body.shopifyProductHandle);
  if (!product) {
    return json({ error: "Product not found" }, { status: 404 });
  }

  const variant = product.variants.find((v) => v.id === body.shopifyVariantId);
  if (!variant) {
    return json({ error: "Variant not found on this product" }, { status: 404 });
  }

  // Shopify prices are decimal strings, e.g. "34.99" — convert to cents
  // for the pricing engine's integer arithmetic (avoids floating-point
  // drift when summing many small rule deltas).
  const baseVariantPriceCents = Math.round(Number.parseFloat(variant.price) * 100);

  const result = await computePrice({
    shopDomain: session.shop,
    shopifyProductId: product.id,
    baseVariantPriceCents,
    usedViews: body.usedViews ?? [],
    techniqueByView: body.techniqueByView,
    usedPremiumFont: body.usedPremiumFont,
    assetTypeByView: body.assetTypeByView,
  });

  return json(result);
};
