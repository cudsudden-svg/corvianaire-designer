// App proxy: POST /apps/studio/designs/draft — get-or-create the
// continuously-autosaved DRAFT for a product+variant. Called once when
// the customizer widget mounts (see persistence/use-design-draft.ts).
// Separate from POST /apps/studio/designs (saveDesign, Stage 7's direct
// one-shot save used by add-to-cart) — both are legitimate, independent
// entry points into the same Design model; see design.server.ts's
// top-of-file comment for why they coexist.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getCustomerIdFromSession } from "~/lib/shopify/app-proxy.server";
import { getOrCreateDraft } from "~/features/designs/design.server";
import { serializeDesignState } from "~/features/designs/design.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const body = (await request.json()) as {
    shopifyProductId?: string;
    shopifyVariantId?: string;
    guestSessionId?: string;
  };

  if (!body.shopifyProductId || !body.shopifyVariantId) {
    return json({ error: "shopifyProductId and shopifyVariantId are required" }, { status: 400 });
  }

  const customerId = getCustomerIdFromSession(request);
  if (!customerId && !body.guestSessionId) {
    return json({ error: "guestSessionId is required for a signed-out visitor" }, { status: 400 });
  }

  const draft = await getOrCreateDraft({
    shopDomain: session.shop,
    shopifyProductId: body.shopifyProductId,
    shopifyVariantId: body.shopifyVariantId,
    customerId,
    guestSessionId: body.guestSessionId ?? null,
  });

  return json(serializeDesignState(draft));
};
