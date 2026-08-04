// Saved Designs — Stage 8's "browse/search a library of past designs"
// piece (deferred from Stage 6/7 — see design.server.ts's doc comment)
// plus order search: searching by a Shopify order id or supplier order
// id surfaces here too, rather than a separate "Orders" page, since the
// app has no Order model of its own — shopifyOrderId/supplierOrderId on
// Design ARE the order-tracking data (see order.server.ts).
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  TextField,
  Select,
  InlineStack,
  BlockStack,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  EmptyState,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { listDesigns } from "~/features/designs/design.server";
import { formatCents } from "~/lib/format";
import { StatusBadge } from "~/components/shared/StatusBadge";

const PAGE_SIZE = 20;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "";
  const attention = url.searchParams.get("attention") === "1";
  const search = url.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const result = await listDesigns({
    shopDomain: session.shop,
    status: !attention && (status === "DRAFT" || status === "SAVED" || status === "ORDERED") ? status : undefined,
    needsAttention: attention || undefined,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return json({ ...result, status, attention, search, page });
};

export default function DesignsIndex() {
  const { items, total, status, attention, search, page } = useLoaderData<typeof loader>();
  const [searchValue, setSearchValue] = useState(search);
  const submit = useSubmit();

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function updateParams(next: Record<string, string>) {
    submit({ status, q: searchValue, ...next }, { method: "get" });
  }

  return (
    <Page title="Saved Designs" subtitle={`${total} design${total === 1 ? "" : "s"}`}>
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" wrap>
            <div style={{ minWidth: "260px", flex: 1 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search by design id, order id, or supplier order id…"
                value={searchValue}
                onChange={setSearchValue}
                onBlur={() => updateParams({ q: searchValue, page: "1" })}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => {
                  setSearchValue("");
                  updateParams({ q: "", page: "1" });
                }}
              />
            </div>
            <div style={{ minWidth: "200px" }}>
              <Select
                label="Status"
                labelHidden
                value={attention ? "ATTENTION" : status || "ALL"}
                onChange={(value) => {
                  if (value === "ATTENTION") {
                    updateParams({ attention: "1", status: "", page: "1" });
                  } else {
                    updateParams({ attention: "", status: value === "ALL" ? "" : value, page: "1" });
                  }
                }}
                options={[
                  { label: "All statuses", value: "ALL" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Saved", value: "SAVED" },
                  { label: "Ordered", value: "ORDERED" },
                  { label: "Needs attention", value: "ATTENTION" },
                ]}
              />
            </div>
          </InlineStack>
        </Card>

        <Card padding="0">
          {items.length === 0 ? (
            <EmptyState
              heading="No designs found"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Try a different search or status filter.</p>
            </EmptyState>
          ) : (
            <ResourceList
              resourceName={{ singular: "design", plural: "designs" }}
              items={items}
              renderItem={(design) => (
                <ResourceItem
                  id={design.id}
                  url={`/app/designs/${design.id}`}
                  media={<Thumbnail source={design.thumbnailUrl ?? ""} alt="" />}
                >
                  <InlineStack align="space-between" blockAlign="center" gap="400">
                    <BlockStack gap="100">
                      <Text as="span" variant="bodyMd" fontWeight="bold">
                        {design.id}
                      </Text>
                      <Text as="span" tone="subdued">
                        {design.viewCount} view{design.viewCount === 1 ? "" : "s"}
                        {design.computedPriceCents != null ? ` · ${formatCents(design.computedPriceCents)}` : ""}
                        {design.shopifyOrderId ? ` · Order ${design.shopifyOrderId}` : ""}
                      </Text>
                    </BlockStack>
                    <StatusBadge status={design.status} supplierOrderId={design.supplierOrderId} />
                  </InlineStack>
                </ResourceItem>
              )}
            />
          )}
        </Card>

        {totalPages > 1 && (
          <InlineStack align="center">
            <Pagination
              hasPrevious={page > 1}
              onPrevious={() => updateParams({ page: String(page - 1) })}
              hasNext={page < totalPages}
              onNext={() => updateParams({ page: String(page + 1) })}
              label={`Page ${page} of ${totalPages}`}
            />
          </InlineStack>
        )}
      </BlockStack>
    </Page>
  );
}
