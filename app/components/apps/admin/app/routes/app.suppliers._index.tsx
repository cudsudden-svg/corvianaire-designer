// Suppliers — Stage 8's missing piece for the "Modular supplier
// structure" from Stage 5: PrintZone/PricingRule editors already
// reference Supplier rows via a picker, but nothing in the app could
// create one until now.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  InlineStack,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { listSuppliers } from "~/features/suppliers/supplier.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const suppliers = await listSuppliers(session.shop);
  return json({ suppliers });
};

export default function SuppliersIndex() {
  const { suppliers } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Suppliers"
      subtitle="Fulfillment partners a print zone (or the shop default) can submit production orders to"
      primaryAction={{ content: "Add supplier", url: "/app/suppliers/new" }}
    >
      <Card padding="0">
        {suppliers.length === 0 ? (
          <EmptyState
            heading="No suppliers configured"
            action={{ content: "Add supplier", url: "/app/suppliers/new" }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Without one, every order falls back to manual fulfillment (ManualSupplierProvider) —
              a fully supported default, not an error state.
            </p>
          </EmptyState>
        ) : (
          <ResourceList
            resourceName={{ singular: "supplier", plural: "suppliers" }}
            items={suppliers}
            renderItem={(supplier) => (
              <ResourceItem id={supplier.id} url={`/app/suppliers/${supplier.id}`}>
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodyMd" fontWeight="bold">
                      {supplier.name}
                    </Text>
                    <Text as="span" tone="subdued">
                      Provider: {supplier.slug}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200">
                    {supplier.isDefault && <Badge tone="attention">Default</Badge>}
                    <Badge tone={supplier.isActive ? "success" : undefined}>
                      {supplier.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </InlineStack>
                </InlineStack>
              </ResourceItem>
            )}
          />
        )}
      </Card>
    </Page>
  );
}
