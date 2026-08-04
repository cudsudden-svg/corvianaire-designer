// App proxy route for the clipart library. Same pattern as
// proxy.products.$handle.tsx — the widget's clipart panel calls this
// through the shared proxy client (getClipartLibrary()) instead of ever
// touching Prisma or the storage provider directly.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getClipartLibrary } from "~/features/clipart/clipart.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    throw json({ error: "Unable to verify shop" }, { status: 401 });
  }

  const library = await getClipartLibrary();
  return json(library, {
    headers: {
      // Clipart changes rarely (merchant-managed, Stage 8) — short public
      // cache takes load off the DB without ever going stale for long.
      "Cache-Control": "public, max-age=60",
    },
  });
};
