// Shared product/variant types.
//
// These describe data that is ALWAYS fetched live from Shopify's Admin or
// Storefront GraphQL API (see app/features/product-loader in Stage 2) —
// nothing matching this shape is ever persisted to our own database.

export interface ShopifyProductVariant {
  id: string; // gid://shopify/ProductVariant/...
  title: string;
  price: string; // decimal string, e.g. "34.99" — matches Shopify's format
  availableForSale: boolean;
  inventoryQuantity: number | null;
  selectedOptions: ShopifyVariantOption[];
  image: ShopifyProductImage | null;
}

export interface ShopifyVariantOption {
  name: string; // e.g. "Color", "Size"
  value: string; // e.g. "Black", "Large"
}

export interface ShopifyProductImage {
  id: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  descriptionHtml: string;
  handle: string;
  images: ShopifyProductImage[];
  variants: ShopifyProductVariant[];
  // Derived, not stored: unique option values across all variants —
  // computed at fetch time so "available colors"/"available sizes"
  // (Phase 3 requirement) never drift from the live variant list.
  availableColors: string[];
  availableSizes: string[];
}
