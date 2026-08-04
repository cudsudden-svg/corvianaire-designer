// Small shared helper for app-proxy routes that need the storefront
// visitor's customer id. Shopify's app proxy forwards a logged-in
// customer as a `logged_in_customer_id` query param on every proxied
// request (GET or POST); it's simply absent for guests, which is a valid,
// supported state everywhere this is used — Design/UploadedAsset both
// allow a null customerId.
export function getCustomerIdFromSession(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("logged_in_customer_id");
}
