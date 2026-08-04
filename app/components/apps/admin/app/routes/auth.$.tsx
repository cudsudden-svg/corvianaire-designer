import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";

// Handles /auth/login, /auth/callback, etc. — the full OAuth dance is
// delegated to the shopify-app-remix library; this route just needs to
// exist and call authenticate.admin so the library's internal router
// can intercept the request.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};
