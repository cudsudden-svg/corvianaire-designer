// Dashboard home (Stage 8). Replaces the Stage 1 placeholder stage-list
// page with a real at-a-glance view: design/order status counts (with a
// "needs attention" callout for the Stage 7 stuck-supplier-submission
// case), plus quick links into each management area.
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Text,
  Banner,
  Button,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Box,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getDesignStats, listDesigns } from "~/features/designs/design.server";
import { listPricingRules } from "~/features/pricing/pricing-engine.server";
import { listSuppliers } from "~/features/suppliers/supplier.server";
import prisma from "~/lib/db/db.server";
import { formatCents } from "~/lib/format";
import { StatusBadge } from "~/components/shared/StatusBadge";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const [stats, pricingRules, suppliers, printZoneCount, clipartAssetCount, recent] = await Promise.all([
    getDesignStats(shopDomain),
    listPricingRules(shopDomain),
    listSuppliers(shopDomain),
    prisma.printZone.count({ where: { shopDomain } }),
    prisma.clipartAsset.count(),
    listDesigns({ shopDomain, page: 1, pageSize: 5 }),
  ]);

  return json({
    stats,
    activePricingRuleCount: pricingRules.filter((r) => r.isActive).length,
    supplierCount: suppliers.length,
    hasDefaultSupplier: suppliers.some((s) => s.isDefault && s.isActive),
    printZoneCount,
    clipartAssetCount,
    recentDesigns: recent.items,
  });
};

export default function Dashboard() {
  const {
    stats,
    activePricingRuleCount,
    supplierCount,
    hasDefaultSupplier,
    printZoneCount,
    clipartAssetCount,
    recentDesigns,
  } = useLoaderData<typeof loader>();

  return (
    <Page title="Corvianaire Studio">
      <Layout>
        {stats.needsAttention > 0 && (
          <Layout.Section>
            <Banner tone="warning" title={`${stats.needsAttention} order${stats.needsAttention === 1 ? "" : "s"} need attention`}>
              <p>
                These designs were ordered but never made it to a supplier for production
                (a failed or skipped submission — see the design detail page to retry).
              </p>
              <Box paddingBlockStart="200">
                <Button url="/app/designs?attention=1">Review needs-attention orders</Button>
              </Box>
            </Banner>
          </Layout.Section>
        )}

        {!hasDefaultSupplier && (
          <Layout.Section>
            <Banner tone="info" title="No default supplier set">
              <p>
                Print zones without their own supplier assignment fall back to a shop
                default, then to manual fulfillment. Set a default supplier so nothing
                silently falls all the way back to manual.
              </p>
              <Box paddingBlockStart="200">
                <Button url="/app/suppliers">Manage suppliers</Button>
              </Box>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
            <StatCard label="Draft" value={stats.draft} />
            <StatCard label="Saved" value={stats.saved} />
            <StatCard label="Ordered" value={stats.ordered} />
            <StatCard
              label="Needs attention"
              value={stats.needsAttention}
              tone={stats.needsAttention > 0 ? "critical" : undefined}
            />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
            <QuickLinkCard
              title="Pricing Rules"
              description={`${activePricingRuleCount} active rule${activePricingRuleCount === 1 ? "" : "s"}`}
              url="/app/pricing"
            />
            <QuickLinkCard
              title="Print Zones"
              description={`${printZoneCount} zone${printZoneCount === 1 ? "" : "s"} configured`}
              url="/app/print-zones"
            />
            <QuickLinkCard
              title="Suppliers"
              description={`${supplierCount} supplier${supplierCount === 1 ? "" : "s"} configured`}
              url="/app/suppliers"
            />
            <QuickLinkCard
              title="Clipart Library"
              description={`${clipartAssetCount} asset${clipartAssetCount === 1 ? "" : "s"}`}
              url="/app/clipart"
            />
            <QuickLinkCard title="Saved Designs" description="Browse and search all designs" url="/app/designs" />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Recently updated designs
                </Text>
                <RemixLink to="/app/designs">View all</RemixLink>
              </InlineStack>
              {recentDesigns.length === 0 ? (
                <Text as="p" tone="subdued">
                  No designs saved yet.
                </Text>
              ) : (
                <ResourceList
                  resourceName={{ singular: "design", plural: "designs" }}
                  items={recentDesigns}
                  renderItem={(design) => (
                    <ResourceItem
                      id={design.id}
                      url={`/app/designs/${design.id}`}
                      media={<Thumbnail source={design.thumbnailUrl ?? ""} alt="" />}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text as="span" variant="bodyMd" fontWeight="bold">
                            {design.id}
                          </Text>
                          <Text as="span" tone="subdued">
                            {design.viewCount} view{design.viewCount === 1 ? "" : "s"}
                            {design.computedPriceCents != null ? ` · ${formatCents(design.computedPriceCents)}` : ""}
                          </Text>
                        </BlockStack>
                        <StatusBadge status={design.status} supplierOrderId={design.supplierOrderId} />
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "critical" }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="span" tone="subdued">
          {label}
        </Text>
        <Text as="span" variant="heading2xl" tone={tone}>
          {value}
        </Text>
      </BlockStack>
    </Card>
  );
}

function QuickLinkCard({ title, description, url }: { title: string; description: string; url: string }) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {title}
        </Text>
        <Text as="p" tone="subdued">
          {description}
        </Text>
        <Box>
          <Button url={url} variant="plain">
            Manage
          </Button>
        </Box>
      </BlockStack>
    </Card>
  );
}
