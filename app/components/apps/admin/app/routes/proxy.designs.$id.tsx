// App proxy route: GET /apps/studio/designs/:id
// Loads a previously saved design — used e.g. from a cart edit link, or
// (with ?full=1) to rehydrate the live canvas when reopening a "My
// Designs" checkpoint or resolving a login draft conflict.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getCustomerIdFromSession } from "~/lib/shopify/app-proxy.server";
import {
  getDesignForCustomer,
  getDesignFullForCustomer,
  DesignNotFoundError,
  DesignOwnershipError,
} from "~/features/designs/design.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    throw json({ error: "Missing design id" }, { status: 400 });
  }

  const wantsFull = new URL(request.url).searchParams.get("full") === "1";
  const ctx = { shopDomain: session.shop, customerId: getCustomerIdFromSession(request) };

  try {
    const design = wantsFull
      ? await getDesignFullForCustomer(id, ctx)
      : await getDesignForCustomer(id, ctx);
    return json(design);
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
