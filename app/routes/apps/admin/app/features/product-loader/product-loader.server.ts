// Public product-loader API. This is the ONLY module the rest of the app
// should import from to get product data — never call the raw GraphQL
// clients directly from a route or component. Two entry points:
//
//   getProductAdmin()      — for use inside the embedded app (merchant is
//                             authenticated; used by admin dashboard,
//                             print-zone/pricing-rule product pickers)
//   getProductStorefront()  — for the customer-facing theme app extension,
//                             via the app proxy route
//
// Both return the exact same `ShopifyProduct` shape, so any component
// built against it doesn't care which one supplied the data.
import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import type { ShopifyProduct } from "~/lib/types/product";
import { storefrontGraphQL } from "~/lib/shopify/storefront-graphql.server";
import { ADMIN_GET_PRODUCT_QUERY, ADMIN_LIST_PRODUCTS_QUERY } from "./queries/admin-product.query";
import { STOREFRONT_GET_PRODUCT_BY_HANDLE_QUERY } from "./queries/storefront-product.query";
import { normalizeAdminProduct, normalizeStorefrontProduct } from "./normalize-product";

/**
 * Fetch a single product by its GID, using the Admin API. Call from a
 * route that already has `admin` from `authenticate.admin(request)`.
 */
export async function getProductAdmin(
  admin: AdminApiContext,
  productId: string,
): Promise<ShopifyProduct | null> {
  const response = await admin.graphql(ADMIN_GET_PRODUCT_QUERY, {
    variables: { id: productId },
  });
  const json = await response.json();
  const raw = json.data?.product;
  return raw ? normalizeAdminProduct(raw) : null;
}

/**
 * Lightweight product search/list for admin-side pickers (e.g. "choose a
 * product to configure print zones for"). Intentionally returns a slim
 * shape (id/title/handle/thumbnail), not the full ShopifyProduct — the
 * picker doesn't need variants until a specific product is selected.
 */
export async function listProductsAdmin(
  admin: AdminApiContext,
  options: { query?: string; first?: number; after?: string } = {},
) {
  const response = await admin.graphql(ADMIN_LIST_PRODUCTS_QUERY, {
    variables: {
      query: options.query ?? null,
      first: options.first ?? 20,
      after: options.after ?? null,
    },
  });
  const json = await response.json();
  return json.data?.products;
}

/**
 * Fetch a single product by handle, using the Storefront API. This is
 * what the theme app extension's product page block resolves data
 * through (via the app proxy — see app/routes/proxy.products.$handle.tsx
 * — so the Storefront token never reaches the browser).
 */
export async function getProductStorefront(
  shopDomain: string,
  handle: string,
): Promise<ShopifyProduct | null> {
  const data = await storefrontGraphQL<{ product: unknown }>(
    shopDomain,
    STOREFRONT_GET_PRODUCT_BY_HANDLE_QUERY,
    { handle },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = data.product as any;
  return raw ? normalizeStorefrontProduct(raw) : null;
}
