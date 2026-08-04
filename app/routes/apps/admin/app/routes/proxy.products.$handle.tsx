// App proxy route. Shopify forwards requests made to
// https://{shop}/apps/studio/products/:handle (see the [app_proxy] block
// in shopify.app.toml) to this route, with a signature we verify via
// `authenticate.public.appProxy`. This is what the theme app extension's
// client-side JS calls — it never talks to the Storefront API directly,
// so STOREFRONT_API_TOKEN never has to ship to the browser.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getProductStorefront } from "~/features/product-loader/product-loader.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const handle = params.handle;

  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }
  if (!handle) {
    throw json({ error: "Missing product handle" }, { status: 400 });
  }

  const product = await getProductStorefront(session.shop, handle);

  if (!product) {
    throw json({ error: "Product not found" }, { status: 404 });
  }

  return json(product);
};
