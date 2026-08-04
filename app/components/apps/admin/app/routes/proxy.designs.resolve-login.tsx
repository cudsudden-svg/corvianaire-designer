// App proxy: GET/POST /apps/studio/designs/resolve-login — guest-draft
// vs account-draft conflict handling at login.
//
// GET  — call right after the storefront widget detects the visitor just
//        logged in (Shopify sets logged_in_customer_id on the proxy
//        request). Returns whether there's nothing to do, one draft to
//        silently adopt, or two drafts the customer must choose between.
//        Never merges/overwrites/deletes anything by itself.
// POST — apply the customer's choice from a "conflict" response. The
//        design NOT chosen is left exactly as it was.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getCustomerIdFromSession } from "~/lib/shopify/app-proxy.server";
import {
  findLoginDraftConflict,
  adoptGuestDraft,
  resolveLoginChoice,
  toCheckpointSummary,
} from "~/features/designs/design.server";
import type { LoginDraftConflict } from "@corvianaire/shared/types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) throw json({ error: "Unable to verify shop" }, { status: 401 });

  const url = new URL(request.url);
  const customerId = getCustomerIdFromSession(request);
  const guestSessionId = url.searchParams.get("guestSessionId");
  const shopifyProductId = url.searchParams.get("shopifyProductId");
  const shopifyVariantId = url.searchParams.get("shopifyVariantId");

  if (!customerId || !guestSessionId || !shopifyProductId || !shopifyVariantId) {
    return json(
      { error: "Sign in, and provide guestSessionId, shopifyProductId, shopifyVariantId" },
      { status: 400 },
    );
  }

  const result = await findLoginDraftConflict(
    session.shop,
    guestSessionId,
    customerId,
    shopifyProductId,
    shopifyVariantId,
  );

  let response: LoginDraftConflict;
  switch (result.kind) {
    case "none":
      response = { kind: "none" };
      break;
    case "conflict":
      // Leave both untouched here — resolution only happens via the
      // customer's explicit choice, POSTed below.
      response = {
        kind: "conflict",
        guestDraft: toCheckpointSummary(result.guestDraft),
        accountDraft: toCheckpointSummary(result.accountDraft),
      };
      break;
    case "guest-only":
      // Only one draft exists — safe to adopt silently, nothing to ask.
      await adoptGuestDraft(result.design.id, customerId);
      response = { kind: "single", design: toCheckpointSummary(result.design) };
      break;
    case "account-only":
      response = { kind: "single", design: toCheckpointSummary(result.design) };
      break;
  }

  return json(response);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) throw json({ error: "Unable to verify shop" }, { status: 401 });

  const customerId = getCustomerIdFromSession(request);
  if (!customerId) {
    return json({ error: "Sign in required" }, { status: 400 });
  }

  const body = (await request.json()) as { chosenDesignId?: string };
  if (!body.chosenDesignId) {
    return json({ error: "chosenDesignId is required" }, { status: 400 });
  }

  const resolved = await resolveLoginChoice(body.chosenDesignId, customerId);
  if (resolved.shopDomain !== session.shop) {
    throw json({ error: "Design not found" }, { status: 404 });
  }

  return json(toCheckpointSummary(resolved));
};
