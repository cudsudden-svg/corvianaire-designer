import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import prisma from "~/lib/db/db.server";

// Shopify requires every app to handle app/uninstalled so it can clean up
// its own data when a merchant removes the app. `authenticate.webhook`
// verifies the HMAC signature before we trust the payload.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (session) {
    // Sessions for this shop are removed; other shop-scoped app data
    // (Design, PricingRule, PrintZone, etc.) has a retention decision to
    // make in Stage 8 (Admin Dashboard) — e.g. soft-delete vs hard-delete
    // on uninstall — deliberately left as-is here rather than guessed at.
    await prisma.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
