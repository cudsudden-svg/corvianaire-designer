// App proxy upload endpoint. The storefront widget's image-upload tool
// posts here (via the shared proxy client's uploadAsset()) instead of
// talking to storage directly — same "never bypass the app proxy" rule as
// proxy.products.$handle.tsx.
//
// Fully functional against AssetStorageProvider today (LocalStorageProvider
// in dev) and will work unchanged against S3StorageProvider in prod — this
// route never imports a specific provider, only the interface.
import type { ActionFunctionArgs } from "@remix-run/node";
import { json, unstable_createMemoryUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getStorageProvider } from "~/features/storage/storage-provider.server";
import { getImageDimensions } from "~/features/storage/image-dimensions.server";
import { createUploadedAsset } from "~/features/uploads/uploaded-asset.server";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedMimeType,
  sniffMimeType,
} from "~/features/uploads/upload-validation.server";
import { sanitizeSvg } from "~/features/uploads/sanitize-svg.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    throw json({ error: "Method not allowed" }, { status: 405 });
  }

  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  // Read the file into memory (bounded by MAX_UPLOAD_SIZE_BYTES) rather
  // than streaming to disk mid-request — keeps the storage-provider
  // boundary clean, since only the provider itself should decide how/where
  // bytes ultimately land.
  let formData: FormData;
  try {
    formData = await unstable_parseMultipartFormData(
      request,
      unstable_createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE_BYTES }),
    );
  } catch {
    return json(
      { error: `File exceeds the ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB limit` },
      { status: 413 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return json({ error: "Empty file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return json(
      { error: `File exceeds the ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB limit` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Never trust the declared Content-Type — sniff the real bytes.
  const sniffed = sniffMimeType(buffer);
  if (!sniffed || (isAllowedMimeType(file.type) && file.type !== sniffed)) {
    return json(
      { error: "Unsupported or mismatched file type. Allowed: PNG, JPEG, SVG, WEBP." },
      { status: 415 },
    );
  }

  // SVG is XML with a scriptable subset — strip anything that could
  // execute (inline <script>, on* handlers, javascript: URIs, embedded
  // HTML via <foreignObject>, etc.) before this file is stored or ever
  // rendered anywhere, including inside the admin dashboard/canvas editor.
  let sanitizedBuffer = buffer;
  if (sniffed === "image/svg+xml") {
    const { sanitized } = sanitizeSvg(buffer.toString("utf-8"));
    sanitizedBuffer = Buffer.from(sanitized, "utf-8");
  }

  let dimensions;
  try {
    dimensions = getImageDimensions(sanitizedBuffer, sniffed);
  } catch {
    return json({ error: "Could not read image dimensions — file may be corrupt" }, { status: 422 });
  }

  const storage = getStorageProvider();
  const uploadResult = await storage.upload({
    buffer: sanitizedBuffer,
    fileName: file.name,
    mimeType: sniffed,
    folder: "uploads",
  });

  // Real resized thumbnails need a raster pipeline (sharp/Photon-style) —
  // documented as a Stage 5+ enhancement. Today thumbUrl reuses the
  // full-size URL, which the widget's clipart/recent-uploads grid downscales
  // via CSS; correctness doesn't depend on a separate thumbnail existing.
  const thumbUrl = uploadResult.url;

  const customerId = getCustomerIdFromSession(request);

  const asset = await createUploadedAsset({
    shopDomain: session.shop,
    customerId,
    fileUrl: uploadResult.url,
    thumbUrl,
    originalName: file.name,
    mimeType: sniffed,
    widthPx: dimensions.widthPx,
    heightPx: dimensions.heightPx,
    fileSizeKb: Math.ceil(uploadResult.sizeBytes / 1024),
  });

  return json({
    id: asset.id,
    fileUrl: asset.fileUrl,
    thumbUrl: asset.thumbUrl,
    originalName: asset.originalName,
    mimeType: asset.mimeType,
    widthPx: asset.widthPx,
    heightPx: asset.heightPx,
    fileSizeKb: asset.fileSizeKb,
  });
};

// Shopify's app-proxy request includes a logged-in customer id as a query
// param when the storefront visitor is signed in; absent for guests, which
// is fine — Design/UploadedAsset both allow a null customerId.
function getCustomerIdFromSession(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("logged_in_customer_id");
}
