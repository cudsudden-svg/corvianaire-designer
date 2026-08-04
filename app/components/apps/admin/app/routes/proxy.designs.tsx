// App proxy route: POST /apps/studio/designs
// The storefront widget calls this right before add-to-cart (and
// whenever else it wants to durably save progress) via the shared proxy
// client's saveDesign(). Body shape is SaveDesignInput — see
// packages/shared/src/types/design.ts.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getCustomerIdFromSession } from "~/lib/shopify/app-proxy.server";
import { saveDesign, DesignNotFoundError, DesignOwnershipError } from "~/features/designs/design.server";
import type { SaveDesignInput } from "@corvianaire/shared/types";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const body = (await request.json()) as SaveDesignInput;
  if (!body.shopifyProductId || !body.shopifyVariantId || !Array.isArray(body.views)) {
    return json({ error: "Missing shopifyProductId, shopifyVariantId, or views" }, { status: 400 });
  }

  try {
    const saved = await saveDesign(body, {
      shopDomain: session.shop,
      customerId: getCustomerIdFromSession(request),
    });
    return json(saved);
  } catch (error) {
    if (error instanceof DesignNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof DesignOwnershipError) {
      return json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
};
