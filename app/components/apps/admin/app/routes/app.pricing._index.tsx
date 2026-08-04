// Pricing Rules — CRUD UI deferred from Stage 5 (see pricing-engine.server.ts's
// doc comment). Lists every rule for the shop; the actual matching logic
// this manages lives in computePrice(), unchanged by this stage.
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
import { listPricingRules } from "~/features/pricing/pricing-engine.server";
import { formatCents } from "~/lib/format";
import { printViewLabel } from "@corvianaire/shared/utils";
import type { PrintViewName } from "@corvianaire/shared/types";

const RULE_TYPE_LABEL: Record<string, string> = {
  PRINT_LOCATION: "Print location",
  TECHNIQUE: "Technique",
  FONT_TIER: "Font tier",
  ASSET_TYPE: "Asset type",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await listPricingRules(session.shop);
  return json({
    rules: rules.map((r) => ({
      id: r.id,
      label: r.label,
      ruleType: r.ruleType,
      shopifyProductId: r.shopifyProductId,
      viewName: r.viewName,
      priceDeltaCents: r.priceDeltaCents,
      isActive: r.isActive,
    })),
  });
};

export default function PricingIndex() {
  const { rules } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Pricing Rules"
      subtitle="Additive charges applied on top of the base variant price"
      primaryAction={{ content: "Create rule", url: "/app/pricing/new" }}
    >
      <Card padding="0">
        {rules.length === 0 ? (
          <EmptyState
            heading="No pricing rules yet"
            action={{ content: "Create rule", url: "/app/pricing/new" }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Without any rules, every design prices at the base variant price only.</p>
          </EmptyState>
        ) : (
          <ResourceList
            resourceName={{ singular: "rule", plural: "rules" }}
            items={rules}
            renderItem={(rule) => (
              <ResourceItem id={rule.id} url={`/app/pricing/${rule.id}`}>
                <InlineStack align="space-between" blockAlign="center" gap="400">
                  <BlockStack gap="100">
                    <Text as="span" variant="bodyMd" fontWeight="bold">
                      {rule.label}
                    </Text>
                    <Text as="span" tone="subdued">
                      {RULE_TYPE_LABEL[rule.ruleType] ?? rule.ruleType}
                      {" · "}
                      {rule.shopifyProductId ? "One product" : "All products"}
                      {" · "}
                      {rule.viewName ? printViewLabel(rule.viewName as PrintViewName) : "All views"}
                    </Text>
                  </BlockStack>
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="span" fontWeight="bold">
                      {rule.priceDeltaCents >= 0 ? "+" : ""}
                      {formatCents(rule.priceDeltaCents)}
                    </Text>
                    <Badge tone={rule.isActive ? "success" : undefined}>
                      {rule.isActive ? "Active" : "Inactive"}
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
