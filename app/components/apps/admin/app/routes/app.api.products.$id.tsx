// Authenticated admin-side product fetch, used by embedded-app UI (e.g.
// the print-zone/pricing-rule product picker built in Stage 5). Kept as
// its own thin route rather than exporting a loader other routes import,
// since Remix resource routes are the standard pattern for this.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getProductAdmin } from "~/features/product-loader/product-loader.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const productId = params.id;

  if (!productId) {
    throw json({ error: "Missing product id" }, { status: 400 });
  }

  // Route params can't contain "/", so callers pass just the numeric ID
  // and we reconstruct the GID here.
  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  const product = await getProductAdmin(admin, gid);

  if (!product) {
    throw json({ error: "Product not found" }, { status: 404 });
  }

  return json(product);
};
