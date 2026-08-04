// App proxy: GET /apps/studio/designs/checkpoints — paginated "My
// Designs" checkpoint list. No hard cap on how many checkpoints a
// customer can have — cursor-paginated from day one so a future
// per-customer limit is a query-layer change, not a schema migration.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getCustomerIdFromSession } from "~/lib/shopify/app-proxy.server";
import { listCheckpoints, toCheckpointSummary } from "~/features/designs/design.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const url = new URL(request.url);
  const customerId = getCustomerIdFromSession(request);
  const guestSessionId = url.searchParams.get("guestSessionId");
  const shopifyProductId = url.searchParams.get("shopifyProductId") ?? undefined;
  const cursor = url.searchParams.get("cursor");
  const take = Number(url.searchParams.get("take") ?? "20");

  if (!customerId && !guestSessionId) {
    return json({ error: "Sign in, or provide guestSessionId" }, { status: 400 });
  }

  const { items, nextCursor } = await listCheckpoints({
    shopDomain: session.shop,
    customerId,
    guestSessionId,
    shopifyProductId,
    take,
    cursor,
  });

  return json({ items: items.map(toCheckpointSummary), nextCursor });
};
