// App proxy: PUT /apps/studio/designs/:id/autosave — upsert one view's
// canvas state + fast client-rendered preview into a DRAFT. The client
// debounces calls to this route (~1.5s idle, see
// persistence/use-persisted-design-autosave.ts); this route itself does
// no debouncing, it just writes whatever it's given.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getDesignById, autosaveView } from "~/features/designs/design.server";
import { serializeDesignState } from "~/features/designs/design.server";
import type { PrintViewName } from "@corvianaire/shared/types";

const VALID_VIEW_NAMES: PrintViewName[] = [
  "front",
  "back",
  "left-sleeve",
  "right-sleeve",
  "hood",
  "neck-label",
];

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "PUT") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const id = params.id;
  if (!id) throw json({ error: "Missing design id" }, { status: 400 });

  const design = await getDesignById(id);
  if (!design || design.shopDomain !== session.shop) {
    throw json({ error: "Design not found" }, { status: 404 });
  }
  if (design.status !== "DRAFT") {
    return json({ error: "Only a DRAFT design can be autosaved" }, { status: 409 });
  }

  const body = (await request.json()) as {
    viewName?: string;
    canvasJson?: unknown;
    previewImageUrl?: string;
  };

  if (!body.viewName || !VALID_VIEW_NAMES.includes(body.viewName as PrintViewName)) {
    return json({ error: "Invalid or missing viewName" }, { status: 400 });
  }
  if (body.canvasJson === undefined) {
    return json({ error: "Missing canvasJson" }, { status: 400 });
  }
  if (!body.previewImageUrl) {
    return json({ error: "Missing previewImageUrl — upload the client preview first" }, { status: 400 });
  }

  await autosaveView({
    designId: id,
    viewName: body.viewName as PrintViewName,
    canvasJson: JSON.stringify(body.canvasJson),
    previewImageUrl: body.previewImageUrl,
  });

  const updated = await getDesignById(id);
  return json(serializeDesignState(updated!));
};
