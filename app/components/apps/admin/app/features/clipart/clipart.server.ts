// Clipart service — the only place that touches ClipartCategory/ClipartAsset
// directly. Both the admin dashboard (merchant uploads, Stage 8) and the
// public proxy.clipart.tsx route go through here.
import prisma from "~/lib/db/db.server";
import { getStorageProvider } from "~/features/storage/storage-provider.server";
import { sanitizeSvg } from "~/features/uploads/sanitize-svg.server";
import type { ClipartCategory as PrismaClipartCategory } from "@prisma/client";

export interface ClipartCategoryWithAssets {
  id: string;
  name: string;
  slug: string;
  assets: {
    id: string;
    name: string;
    tags: string[];
    fileUrl: string;
    thumbUrl: string;
    categoryId: string;
  }[];
}

/** Full library, grouped by category, in category creation order. */
export async function getClipartLibrary(): Promise<ClipartCategoryWithAssets[]> {
  const categories = await prisma.clipartCategory.findMany({
    include: { assets: { orderBy: { createdAt: "desc" } } },
  });

  return categories.map(serializeCategory);
}

export async function getClipartCategories(): Promise<PrismaClipartCategory[]> {
  return prisma.clipartCategory.findMany({ orderBy: { name: "asc" } });
}

export async function findOrCreateCategory(name: string, slug: string) {
  return prisma.clipartCategory.upsert({
    where: { slug },
    update: {},
    create: { name, slug },
  });
}

export interface AddClipartAssetInput {
  name: string;
  tags: string[];
  categorySlug: string;
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

/**
 * Store a clipart asset's bytes through the active AssetStorageProvider
 * (folder "clipart", same abstraction uploads.$.tsx and proxy.uploads.tsx
 * use) and record it. Used by the admin-managed clipart upload UI
 * (Stage 8) and by the local dev seed script below.
 */
export async function addClipartAsset(input: AddClipartAssetInput) {
  const category = await prisma.clipartCategory.findUnique({ where: { slug: input.categorySlug } });
  if (!category) {
    throw new Error(`Unknown clipart category slug "${input.categorySlug}"`);
  }

  const storage = getStorageProvider();
  // Same rationale as the customer upload path (proxy.uploads.tsx) — a
  // merchant-supplied SVG is still rendered directly in the browser
  // (admin dashboard preview + customer-facing clipart grid), so it goes
  // through the same sanitizer before it's ever written to storage.
  const buffer =
    input.mimeType === "image/svg+xml"
      ? Buffer.from(sanitizeSvg(input.buffer.toString("utf-8")).sanitized, "utf-8")
      : input.buffer;

  const result = await storage.upload({
    buffer,
    fileName: input.fileName,
    mimeType: input.mimeType,
    folder: "clipart",
  });

  return prisma.clipartAsset.create({
    data: {
      name: input.name,
      tags: input.tags.join(","),
      fileUrl: result.url,
      thumbUrl: result.url,
      categoryId: category.id,
    },
  });
}

export async function deleteClipartAsset(id: string): Promise<void> {
  const asset = await prisma.clipartAsset.findUnique({ where: { id } });
  if (!asset) return;
  await prisma.clipartAsset.delete({ where: { id } });
}

function serializeCategory(
  category: PrismaClipartCategory & {
    assets: { id: string; name: string; tags: string; fileUrl: string; thumbUrl: string; categoryId: string }[];
  },
): ClipartCategoryWithAssets {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    assets: category.assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      tags: asset.tags ? asset.tags.split(",") : [],
      fileUrl: asset.fileUrl,
      thumbUrl: asset.thumbUrl,
      categoryId: asset.categoryId,
    })),
  };
}
