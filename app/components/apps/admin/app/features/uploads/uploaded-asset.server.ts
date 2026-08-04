// UploadedAsset service — the only place that touches the UploadedAsset
// Prisma model directly. Route handlers (proxy.uploads.tsx) call through
// here rather than importing `prisma` themselves, same pattern as
// features/clipart/clipart.server.ts.
import prisma from "~/lib/db/db.server";
import type { UploadedAsset } from "@prisma/client";

export interface CreateUploadedAssetInput {
  shopDomain: string;
  customerId: string | null;
  fileUrl: string;
  thumbUrl: string;
  originalName: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
  fileSizeKb: number;
}

export async function createUploadedAsset(
  input: CreateUploadedAssetInput,
): Promise<UploadedAsset> {
  return prisma.uploadedAsset.create({ data: input });
}

/**
 * A customer/guest's own recent uploads, for a "recently used" panel in the
 * widget's upload tool. Guests (customerId null) don't get history across
 * sessions — there's nothing to key it on — so this only returns results
 * for known customers.
 */
export async function getRecentUploadsForCustomer(
  shopDomain: string,
  customerId: string,
  limit = 20,
): Promise<UploadedAsset[]> {
  return prisma.uploadedAsset.findMany({
    where: { shopDomain, customerId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUploadedAssetById(id: string): Promise<UploadedAsset | null> {
  return prisma.uploadedAsset.findUnique({ where: { id } });
}
