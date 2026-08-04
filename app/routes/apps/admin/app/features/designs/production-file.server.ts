// Production file service — accepts the storefront widget's client-side
// high-resolution render of each used view (produced via fabric's
// `toDataURL({ multiplier })` at the print zone's target DPI — see
// packages/shared/src/utils/print-zones.ts's productionRenderMultiplier)
// and stores it as that DesignView's print-ready file.
//
// Deliberately client-rendered rather than re-rendered server-side: the
// admin app has no native image/canvas library in its dependency tree
// (see image-dimensions.server.ts's own dependency-free approach), and
// fabric.js's rendering is already proven correct in the browser via the
// live editor itself — re-implementing that server-side would be a
// second, divergent rendering path for no accuracy benefit.
import prisma from "~/lib/db/db.server";
import { getStorageProvider } from "~/features/storage/storage-provider.server";
import { decodeDataUrl, extensionForMimeType } from "~/features/storage/data-url.server";
import { getDesignById } from "./design.server";
import type { ProductionFileInput, ProductionFileResult } from "@corvianaire/shared/types";

export async function saveProductionFiles(
  designId: string,
  shopDomain: string,
  views: ProductionFileInput[],
): Promise<ProductionFileResult[]> {
  const design = await getDesignById(designId);
  if (!design || design.shopDomain !== shopDomain) {
    throw new Error(`Design "${designId}" not found`);
  }

  const storage = getStorageProvider();
  const results: ProductionFileResult[] = [];

  for (const view of views) {
    const decoded = decodeDataUrl(view.fileDataUrl);
    if (!decoded) continue; // skip silently — an unrenderable view isn't fatal to the rest of the submission

    const matchingView = design.views.find((v) => v.viewName === view.viewName);
    if (!matchingView) continue; // no saved canvas state for this view — nothing to attach a production file to

    const uploadResult = await storage.upload({
      buffer: decoded.buffer,
      fileName: `${view.viewName}-production.${extensionForMimeType(decoded.mimeType)}`,
      mimeType: decoded.mimeType,
      folder: "production-files",
    });

    await prisma.designView.update({
      where: { id: matchingView.id },
      data: { productionFileUrl: uploadResult.url, productionFileGeneratedAt: new Date() },
    });

    results.push({ viewName: view.viewName, productionFileUrl: uploadResult.url });
  }

  return results;
}
