// Normalizes raw GraphQL responses (Admin OR Storefront shape) into the
// single shared ShopifyProduct type from app/lib/types/product.ts.
//
// Having one normalizer for both APIs matters: it's the guarantee that
// "available colors"/"available sizes" (Phase 3) are always *derived*
// from whatever variants actually came back — never hardcoded, never
// stored, and never drifting between the admin-side and storefront-side
// views of the same product.
import type {
  ShopifyProduct,
  ShopifyProductImage,
  ShopifyProductVariant,
} from "~/lib/types/product";

// --- Raw shapes as returned by each API (only the fields we query) ---

interface RawImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

interface RawVariantCommon {
  id: string;
  title: string;
  availableForSale: boolean;
  selectedOptions: { name: string; value: string }[];
  image: RawImage | null;
}

interface RawAdminVariant extends RawVariantCommon {
  price: string;
  inventoryQuantity: number | null;
}

interface RawStorefrontVariant extends RawVariantCommon {
  price: { amount: string };
  quantityAvailable: number | null;
}

interface RawProduct<TVariant> {
  id: string;
  title: string;
  descriptionHtml: string;
  handle: string;
  images: { nodes: RawImage[] };
  variants: { nodes: TVariant[] };
}

function normalizeImage(image: RawImage): ShopifyProductImage {
  return {
    id: image.id,
    url: image.url,
    altText: image.altText,
    width: image.width,
    height: image.height,
  };
}

function deriveOptionValues(
  variants: ShopifyProductVariant[],
  optionName: string,
): string[] {
  const values = new Set<string>();
  for (const variant of variants) {
    const match = variant.selectedOptions.find(
      (option) => option.name.toLowerCase() === optionName,
    );
    if (match) values.add(match.value);
  }
  return Array.from(values);
}

function finalizeProduct(
  raw: { id: string; title: string; descriptionHtml: string; handle: string; images: RawImage[] },
  variants: ShopifyProductVariant[],
): ShopifyProduct {
  return {
    id: raw.id,
    title: raw.title,
    descriptionHtml: raw.descriptionHtml,
    handle: raw.handle,
    images: raw.images.map(normalizeImage),
    variants,
    // Derived at read time, every time — never cached separately, so
    // these can never go stale relative to the variants they came from.
    availableColors: deriveOptionValues(variants, "color"),
    availableSizes: deriveOptionValues(variants, "size"),
  };
}

export function normalizeAdminProduct(raw: RawProduct<RawAdminVariant>): ShopifyProduct {
  const variants: ShopifyProductVariant[] = raw.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    price: v.price,
    availableForSale: v.availableForSale,
    inventoryQuantity: v.inventoryQuantity,
    selectedOptions: v.selectedOptions,
    image: v.image ? normalizeImage(v.image) : null,
  }));

  return finalizeProduct({ ...raw, images: raw.images.nodes }, variants);
}

export function normalizeStorefrontProduct(
  raw: RawProduct<RawStorefrontVariant>,
): ShopifyProduct {
  const variants: ShopifyProductVariant[] = raw.variants.nodes.map((v) => ({
    id: v.id,
    title: v.title,
    price: v.price.amount,
    availableForSale: v.availableForSale,
    // Storefront API doesn't expose raw inventory counts (by design —
    // it's public-facing); quantityAvailable requires the shop to opt in
    // to exposing it. Falls back to null, same as an admin variant with
    // untracked inventory, so downstream code doesn't need to branch on
    // which API the data came from.
    inventoryQuantity: v.quantityAvailable ?? null,
    selectedOptions: v.selectedOptions,
    image: v.image ? normalizeImage(v.image) : null,
  }));

  return finalizeProduct({ ...raw, images: raw.images.nodes }, variants);
}
