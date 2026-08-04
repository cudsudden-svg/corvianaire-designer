// App proxy route: GET /apps/studio/print-zones/:productId
// This is what Stage 5's real ViewConfigurationProvider (in the shared
// package) calls, replacing Stage 3's FallbackViewConfigurationProvider.
// Returns real merchant-configured PrintZone rows for a product, mapped
// into the same ViewDefinition shape the editor already consumes — so
// swapping providers in main.tsx required zero editor changes, exactly
// as designed back in Stage 3.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getPrintZonesForProduct } from "~/features/print-zones/print-zone.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const productId = params.productId;
  if (!productId) {
    throw json({ error: "Missing product id" }, { status: 400 });
  }

  const gid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const zones = await getPrintZonesForProduct(session.shop, gid);

  // Shape matches ViewDefinition in packages/shared/src/view-config —
  // kept as a plain mapped array (not the raw Prisma rows) so the
  // widget never depends on internal field names like `bleedAreaX`
  // changing independently of this contract.
  const views = zones.map((zone) => ({
    viewName: zone.viewName,
    label: humanizeViewName(zone.viewName),
    safeArea: {
      x: zone.safeAreaX,
      y: zone.safeAreaY,
      width: zone.safeAreaWidth,
      height: zone.safeAreaHeight,
    },
    bleedArea: {
      x: zone.bleedAreaX,
      y: zone.bleedAreaY,
      width: zone.bleedAreaWidth,
      height: zone.bleedAreaHeight,
    },
    physicalWidthIn: zone.physicalWidthIn,
    physicalHeightIn: zone.physicalHeightIn,
    bleedMarginIn: zone.bleedMarginIn,
    targetDpi: zone.targetDpi,
    allowedFileFormats: zone.allowedFileFormats.split(","),
  }));

  return json({ views });
};

function humanizeViewName(viewName: string): string {
  return viewName
    .split("-")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}
