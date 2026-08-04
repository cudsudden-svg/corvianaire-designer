import type { HeadersFunction, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "~/lib/shopify/shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// Every route nested under /app requires a valid, embedded Shopify
// session. `authenticate.admin` throws a redirect Response automatically
// if the merchant isn't authenticated yet — no manual redirect logic needed.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "" });
};

export default function AppLayout() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      {/* NavMenu renders in Shopify admin's own nav chrome, not inline —
          links here become the app's left-hand nav inside Shopify admin. */}
      <NavMenu>
        <Link to="/app" rel="home">
          Home
        </Link>
        <Link to="/app/designs">Saved Designs</Link>
        <Link to="/app/pricing">Pricing Rules</Link>
        <Link to="/app/print-zones">Print Zones</Link>
        <Link to="/app/suppliers">Suppliers</Link>
        <Link to="/app/clipart">Clipart Library</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

// Required so Shopify's embedded-app error boundary correctly re-triggers
// auth if the session expires mid-use, instead of showing a raw crash.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
