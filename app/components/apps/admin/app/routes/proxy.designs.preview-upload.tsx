// App proxy: POST /apps/studio/designs/preview-upload — upload a fast
// client-side canvas.toDataURL() preview snapshot. Distinct from
// proxy.uploads.tsx (creates an UploadedAsset row for images a customer
// places on their design) and from production-file uploads (print-ready,
// full resolution) — this just stores an ephemeral preview PNG and
// returns its URL, since a preview snapshot isn't a design asset itself.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getStorageProvider } from "~/features/storage/storage-provider.server";

const MAX_PREVIEW_BYTES = 5 * 1024 * 1024; // fast preview only, never production-res

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const body = (await request.json()) as { dataUrl?: string; viewName?: string };
  if (!body.dataUrl?.startsWith("data:image/png;base64,")) {
    return json({ error: "dataUrl must be a PNG data URL" }, { status: 400 });
  }

  const buffer = Buffer.from(body.dataUrl.slice("data:image/png;base64,".length), "base64");
  if (buffer.length === 0) {
    return json({ error: "Empty preview image" }, { status: 400 });
  }
  if (buffer.length > MAX_PREVIEW_BYTES) {
    return json({ error: "Preview image too large" }, { status: 413 });
  }

  const storage = getStorageProvider();
  const uploadResult = await storage.upload({
    buffer,
    fileName: `preview-${body.viewName ?? "view"}-${Date.now()}.png`,
    mimeType: "image/png",
    folder: "previews",
  });

  return json({ url: uploadResult.url });
};
