// Order integration (Stage 7). Subscription already registered in
// shopify.app.toml (topics = ["orders/create"]) since Stage 1 as a
// placeholder — this is that route's real implementation.
//
// `authenticate.webhook` verifies the HMAC signature before we trust the
// payload, same as webhooks.app.uninstalled.tsx. All the actual logic —
// finding which line items reference a Design, marking it ORDERED,
// resolving a supplier and submitting production files — lives in
// features/orders/order.server.ts so this route stays a thin adapter
// between "Shopify sent us a webhook" and "here's the shop + payload."
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { processOrderWebhook } from "~/features/orders/order.server";
import type { OrderWebhookPayload } from "~/features/orders/order.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Always return 200 once the webhook is authenticated — Shopify retries
  // on non-2xx, and a retried delivery would just reprocess the same
  // order (processOrderWebhook is naturally idempotent: re-marking an
  // already-ORDERED design as ORDERED, or resubmitting to a supplier, is
  // a no-op in effect even if it isn't literally skipped).
  try {
    await processOrderWebhook(shop, payload as OrderWebhookPayload);
  } catch (error) {
    console.error(`Failed processing orders/create webhook for ${shop}:`, error);
  }

  return new Response();
};
