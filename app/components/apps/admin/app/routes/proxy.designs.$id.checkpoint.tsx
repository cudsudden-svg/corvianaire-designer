// App proxy: POST /apps/studio/designs/:id/checkpoint — explicit "Save"
// action. Clones the current DRAFT into a new named checkpoint (status
// SAVED); the draft itself is untouched and keeps autosaving
// independently afterward. No version history beyond this — each save
// is an independent snapshot (see design.server.ts's saveCheckpoint()).
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { saveCheckpoint, DesignNotFoundError } from "~/features/designs/design.server";
import { toCheckpointSummary } from "~/features/designs/design.server";
import prisma from "~/lib/db/db.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const id = params.id;
  if (!id) throw json({ error: "Missing design id" }, { status: 400 });

  const draft = await prisma.design.findUnique({ where: { id } });
  if (!draft || draft.shopDomain !== session.shop) {
    throw json({ error: "Design not found" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) {
    return json({ error: "A name is required to save a checkpoint" }, { status: 400 });
  }

  try {
    const checkpoint = await saveCheckpoint(id, name);
    return json(toCheckpointSummary(checkpoint));
  } catch (error) {
    if (error instanceof DesignNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Could not save checkpoint";
    return json({ error: message }, { status: 400 });
  }
};
