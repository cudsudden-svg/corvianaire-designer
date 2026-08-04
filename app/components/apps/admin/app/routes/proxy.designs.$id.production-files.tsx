// App proxy route: POST /apps/studio/designs/:id/production-files
// Receives client-rendered, print-ready PNG exports (one per used view,
// generated at the print zone's target DPI — see
// apps/storefront-widget/src/commerce/generate-production-files.ts) and
// stores them via the existing AssetStorageProvider, same as every other
// upload path in the app.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { saveProductionFiles } from "~/features/designs/production-file.server";
import type { ProductionFileInput } from "@corvianaire/shared/types";

interface ProductionFilesRequestBody {
  views: ProductionFileInput[];
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const id = params.id;
  if (!id) {
    throw json({ error: "Missing design id" }, { status: 400 });
  }

  const body = (await request.json()) as ProductionFilesRequestBody;
  if (!Array.isArray(body.views) || body.views.length === 0) {
    return json({ error: "Missing views" }, { status: 400 });
  }

  try {
    const views = await saveProductionFiles(id, session.shop, body.views);
    return json({ views });
  } catch {
    return json({ error: `Design "${id}" not found` }, { status: 404 });
  }
};
