// Thin re-export — the real definitions now live in packages/shared so
// both the admin app and the storefront widget share one source of truth.
// Kept here so existing imports (e.g. ~/lib/types/product) don't need to
// change throughout the admin app's feature modules.
export * from "@corvianaire/shared/types/product";
