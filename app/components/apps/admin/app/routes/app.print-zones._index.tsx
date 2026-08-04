// Print zone management — product picker. Merchant searches for a
// product, sees how many views already have zones configured, and jumps
// into the numeric editor for that product. Product data itself is
// fetched live (Admin API) per the project's core rule — only the zone
// COUNT per product is app-owned data, read from Prisma.
import { useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Link } from "@remix-run/react";
import {
  Page,
  Card,
  TextField,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  Badge,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { listProductsAdmin } from "~/features/product-loader/product-loader.server";
import prisma from "~/lib/db/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";

  const products = await listProductsAdmin(admin, { query: query || undefined, first: 25 });

  const productIds = (products?.nodes ?? []).map((p: { id: string }) => p.id);
  const zoneCounts = await prisma.printZone.groupBy({
    by: ["shopifyProductId"],
    where: { shopDomain: session.shop, shopifyProductId: { in: productIds } },
    _count: { _all: true },
  });
  const countByProductId = new Map(zoneCounts.map((z) => [z.shopifyProductId, z._count._all]));

  return json({
    query,
    products: (products?.nodes ?? []).map((p: { id: string; title: string; handle: string; images: { nodes: { url: string; altText: string | null }[] } }) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      imageUrl: p.images.nodes[0]?.url ?? null,
      configuredZoneCount: countByProductId.get(p.id) ?? 0,
    })),
  });
};

export default function PrintZonesIndex() {
  const { query, products } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState(query);
  const submit = useSubmit();

  function handleSearchSubmit(value: string) {
    setSearch(value);
    submit({ q: value }, { method: "get" });
  }

  return (
    <Page title="Print Zones" subtitle="Configure customizable print areas per product">
      <Card>
        <TextField
          label="Search products"
          labelHidden
          placeholder="Search products…"
          value={search}
          onChange={handleSearchSubmit}
          autoComplete="off"
        />
      </Card>
      <Card>
        {products.length === 0 ? (
          <EmptyState
            heading="No products found"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Try a different search, or sync products from Apliiq first.</p>
          </EmptyState>
        ) : (
          <ResourceList
            resourceName={{ singular: "product", plural: "products" }}
            items={products}
            renderItem={(product) => (
              <ResourceItem
                id={product.id}
                url={`/app/print-zones/${encodeURIComponent(product.id.replace("gid://shopify/Product/", ""))}`}
                media={<Thumbnail source={product.imageUrl ?? ""} alt={product.title} />}
              >
                <Text as="span" variant="bodyMd" fontWeight="bold">
                  {product.title}
                </Text>
                <div>
                  {product.configuredZoneCount > 0 ? (
                    <Badge tone="success">{`${product.configuredZoneCount} view(s) configured`}</Badge>
                  ) : (
                    <Badge tone="attention">Not configured — not customizable yet</Badge>
                  )}
                </div>
              </ResourceItem>
            )}
          />
        )}
      </Card>
    </Page>
  );
}
