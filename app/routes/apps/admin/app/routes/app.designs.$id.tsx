// Design detail — the reopen/inspect side of Stage 8's "My Designs"
// library (see design.server.ts's doc comment), plus the Stage 7
// "needs manual follow-up" retry action for orders that never made it
// to a supplier.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  InlineGrid,
  InlineStack,
  Text,
  Banner,
  Button,
  TextField,
  Thumbnail,
  Box,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getDesignAdminDetail, deleteDesignAdmin, reassignDesignCustomer } from "~/features/designs/design.server";
import { retryProductionSubmission } from "~/features/orders/order.server";
import { getProductAdmin } from "~/features/product-loader/product-loader.server";
import { formatCents } from "~/lib/format";
import { StatusBadge } from "~/components/shared/StatusBadge";
import { printViewLabel } from "@corvianaire/shared/utils";
import type { PrintViewName } from "@corvianaire/shared/types";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const id = params.id!;

  const design = await getDesignAdminDetail(id, session.shop);
  if (!design) {
    throw json({ error: "Design not found" }, { status: 404 });
  }

  // Best-effort — a deleted/inaccessible product shouldn't block viewing
  // the design's own saved data, which is what this page is really for.
  let productTitle: string | null = null;
  try {
    const product = await getProductAdmin(admin, design.shopifyProductId);
    productTitle = product?.title ?? null;
  } catch {
    productTitle = null;
  }

  return json({
    design: {
      id: design.id,
      status: design.status,
      customerId: design.customerId,
      customerNotes: design.customerNotes,
      shopifyProductId: design.shopifyProductId,
      shopifyVariantId: design.shopifyVariantId,
      computedPriceCents: design.computedPriceCents,
      shopifyOrderId: design.shopifyOrderId,
      supplierOrderId: design.supplierOrderId,
      productionSubmittedAt: design.productionSubmittedAt,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
      views: design.views.map((v) => ({
        viewName: v.viewName,
        previewImageUrl: v.previewImageUrl,
        productionFileUrl: v.productionFileUrl,
        productionFileGeneratedAt: v.productionFileGeneratedAt,
      })),
    },
    productTitle,
    shopDomain: session.shop,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "retry") {
    const result = await retryProductionSubmission(session.shop, id);
    return json(result);
  }

  if (intent === "delete") {
    await deleteDesignAdmin(id, session.shop);
    // The design (and this page) no longer exists — back to the list.
    return redirect("/app/designs");
  }

  if (intent === "reassign") {
    const rawCustomerId = String(formData.get("customerId") ?? "").trim();
    await reassignDesignCustomer(id, session.shop, rawCustomerId ? rawCustomerId : null);
    return json({ ok: true, reassigned: true });
  }

  return json({ ok: false, reason: "Unknown action." });
};

export default function DesignDetail() {
  const { design, productTitle, shopDomain } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submittingIntent =
    navigation.state === "submitting" ? navigation.formData?.get("intent") : null;
  const isRetrying = submittingIntent === "retry";
  const isReassigning = submittingIntent === "reassign";

  const needsAttention = design.status === "ORDERED" && !design.supplierOrderId;

  return (
    <Page
      title={productTitle ?? design.shopifyProductId}
      subtitle={`Design ${design.id}`}
      backAction={{ url: "/app/designs" }}
    >
      <BlockStack gap="400">
        {actionData && "supplierOrderId" in actionData && actionData.ok && (
          <Banner tone="success" title="Submitted to supplier">
            <p>Supplier order id: {actionData.supplierOrderId}</p>
          </Banner>
        )}
        {actionData && "reason" in actionData && !actionData.ok && (
          <Banner tone="critical" title="Couldn't submit to supplier">
            <p>{actionData.reason}</p>
          </Banner>
        )}

        {needsAttention && (
          <Banner tone="warning" title="This order never reached the supplier">
            <p>
              The order came in but production submission failed or was skipped (see
              order.server.ts's processOrderWebhook). Retry once the underlying issue —
              missing production files, supplier config, etc — is fixed.
            </p>
            <Box paddingBlockStart="200">
              <Form method="post">
                <input type="hidden" name="intent" value="retry" />
                <Button submit loading={isRetrying}>
                  Retry supplier submission
                </Button>
              </Form>
            </Box>
          </Banner>
        )}

        <Card>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  {productTitle ?? "Product"}
                </Text>
                <StatusBadge status={design.status} supplierOrderId={design.supplierOrderId} />
              </InlineStack>
              <Text as="p" tone="subdued">
                Variant: {design.shopifyVariantId}
              </Text>
              {design.computedPriceCents != null && (
                <Text as="p">Price at last save: {formatCents(design.computedPriceCents)}</Text>
              )}
              {design.customerNotes && (
                <Text as="p">Customer notes: {design.customerNotes}</Text>
              )}
              <Text as="p" tone="subdued">
                Created {new Date(design.createdAt).toLocaleString()} · Updated{" "}
                {new Date(design.updatedAt).toLocaleString()}
              </Text>
            </BlockStack>

            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Order tracking
              </Text>
              {design.shopifyOrderId ? (
                <Text as="p">
                  Shopify order:{" "}
                  <a
                    href={`https://${shopDomain}/admin/orders/${design.shopifyOrderId}`}
                    target="_top"
                  >
                    {design.shopifyOrderId}
                  </a>
                </Text>
              ) : (
                <Text as="p" tone="subdued">
                  Not yet attached to an order.
                </Text>
              )}
              <Text as="p" tone={design.supplierOrderId ? undefined : "subdued"}>
                Supplier order: {design.supplierOrderId ?? "Not submitted"}
              </Text>
              {design.productionSubmittedAt && (
                <Text as="p" tone="subdued">
                  Submitted {new Date(design.productionSubmittedAt).toLocaleString()}
                </Text>
              )}
            </BlockStack>
          </InlineGrid>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">
              Views ({design.views.length})
            </Text>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              {design.views.map((view) => (
                <Card key={view.viewName}>
                  <BlockStack gap="200">
                    <Thumbnail
                      source={view.previewImageUrl ?? ""}
                      alt={printViewLabel(view.viewName as PrintViewName)}
                      size="large"
                    />
                    <Text as="span" fontWeight="bold">
                      {printViewLabel(view.viewName as PrintViewName)}
                    </Text>
                    {view.productionFileUrl ? (
                      <a href={view.productionFileUrl} target="_top">
                        Production file
                      </a>
                    ) : (
                      <Text as="span" tone="subdued">
                        No production file yet
                      </Text>
                    )}
                  </BlockStack>
                </Card>
              ))}
            </InlineGrid>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="400">
            <Text as="h3" variant="headingSm">
              Reassign
            </Text>
            <Text as="p" tone="subdued">
              Move this design to a different Shopify customer — for correcting a wrong
              attribution, or attaching a guest-created design to an account. Leave blank
              to make it guest-owned again.
            </Text>
            <Form method="post">
              <input type="hidden" name="intent" value="reassign" />
              <InlineStack gap="200" blockAlign="end">
                <div style={{ minWidth: "260px" }}>
                  <TextField
                    label="Customer ID"
                    name="customerId"
                    autoComplete="off"
                    defaultValue={design.customerId ?? ""}
                    placeholder="gid://shopify/Customer/…"
                  />
                </div>
                <Button submit loading={isReassigning}>
                  Save
                </Button>
              </InlineStack>
            </Form>
            {actionData && "reassigned" in actionData && actionData.reassigned && (
              <Banner tone="success">Reassigned.</Banner>
            )}
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text as="h3" variant="headingSm" tone="critical">
              Delete design
            </Text>
            <Text as="p" tone="subdued">
              Permanently deletes this design, its views, and their stored preview/production
              files. This can't be undone — the customer would need to redesign from scratch.
            </Text>
            <Form
              method="post"
              onSubmit={(event) => {
                if (!window.confirm("Delete this design permanently? This can't be undone.")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="intent" value="delete" />
              <Button submit tone="critical" variant="primary">
                Delete design
              </Button>
            </Form>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
