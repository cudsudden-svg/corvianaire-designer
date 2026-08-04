// Print zone editor for a single product. Numeric form (not a visual
// drag/resize editor — that's the customer-facing Studio's job, per
// Stage 5 scope) covering everything a merchant needs to make a product
// genuinely production-ready: safe/bleed geometry, physical print size,
// target DPI, allowed file formats, and which supplier fulfills it.
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  Tabs,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Banner,
  BlockStack,
  InlineGrid,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import { getProductAdmin } from "~/features/product-loader/product-loader.server";
import {
  getPrintZonesForProduct,
  upsertPrintZone,
  deletePrintZone,
  PrintZoneValidationException,
} from "~/features/print-zones/print-zone.server";
import prisma from "~/lib/db/db.server";
import { ALL_PRINT_VIEWS, printViewLabel } from "@corvianaire/shared/utils";
import type { PrintViewName } from "@corvianaire/shared/types";

const FILE_FORMAT_OPTIONS = ["png", "jpg", "svg", "webp"] as const;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const numericId = params.productId!;
  const gid = numericId.startsWith("gid://") ? numericId : `gid://shopify/Product/${numericId}`;

  const [product, zones, suppliers] = await Promise.all([
    getProductAdmin(admin, gid),
    getPrintZonesForProduct(session.shop, gid),
    prisma.supplier.findMany({ where: { shopDomain: session.shop, isActive: true } }),
  ]);

  if (!product) {
    throw json({ error: "Product not found" }, { status: 404 });
  }

  return json({
    product: { id: product.id, title: product.title, imageUrl: product.images[0]?.url ?? null },
    zones,
    suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const numericId = params.productId!;
  const gid = numericId.startsWith("gid://") ? numericId : `gid://shopify/Product/${numericId}`;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    await deletePrintZone(String(formData.get("zoneId")));
    return json({ ok: true });
  }

  const allowedFileFormats = FILE_FORMAT_OPTIONS.filter(
    (format) => formData.get(`format_${format}`) === "on",
  );

  try {
    const zone = await upsertPrintZone({
      shopDomain: session.shop,
      shopifyProductId: gid,
      viewName: String(formData.get("viewName")),
      safeAreaX: Number(formData.get("safeAreaX")),
      safeAreaY: Number(formData.get("safeAreaY")),
      safeAreaWidth: Number(formData.get("safeAreaWidth")),
      safeAreaHeight: Number(formData.get("safeAreaHeight")),
      bleedAreaX: Number(formData.get("bleedAreaX")),
      bleedAreaY: Number(formData.get("bleedAreaY")),
      bleedAreaWidth: Number(formData.get("bleedAreaWidth")),
      bleedAreaHeight: Number(formData.get("bleedAreaHeight")),
      physicalWidthIn: Number(formData.get("physicalWidthIn")),
      physicalHeightIn: Number(formData.get("physicalHeightIn")),
      bleedMarginIn: Number(formData.get("bleedMarginIn")),
      targetDpi: Number(formData.get("targetDpi")),
      allowedFileFormats,
      supplierId: formData.get("supplierId") ? String(formData.get("supplierId")) : null,
    });
    return json({ ok: true, zone });
  } catch (error) {
    if (error instanceof PrintZoneValidationException) {
      return json({ ok: false, errors: error.errors }, { status: 422 });
    }
    throw error;
  }
};

export default function PrintZoneEditor() {
  const { product, zones, suppliers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [selectedTab, setSelectedTab] = useState(0);

  const activeView = ALL_PRINT_VIEWS[selectedTab] as PrintViewName;
  const existingZone = zones.find((z) => z.viewName === activeView);
  const isSaving = navigation.state === "submitting";

  const tabs = ALL_PRINT_VIEWS.map((view) => ({
    id: view,
    content: printViewLabel(view) + (zones.some((z) => z.viewName === view) ? " ✓" : ""),
  }));

  return (
    <Page
      title={`Print Zones — ${product.title}`}
      backAction={{ url: "/app/print-zones" }}
    >
      <BlockStack gap="400">
        <Card>
          <InlineGrid columns={["oneThird", "twoThirds"]} gap="400">
            <Thumbnail source={product.imageUrl ?? ""} alt={product.title} size="large" />
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">
                {product.title}
              </Text>
              <Text as="p" tone="subdued">
                {zones.length} of {ALL_PRINT_VIEWS.length} views configured. Only configured
                views are customizable in the storefront widget — an unconfigured product
                shows as unavailable to customers, rather than falling back to guessed
                geometry.
              </Text>
            </BlockStack>
          </InlineGrid>
        </Card>

        <Card>
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} />

          {actionData && "errors" in actionData && actionData.errors && (
            <Banner tone="critical" title="Couldn't save this print zone">
              <ul>
                {actionData.errors.map((err) => (
                  <li key={err.field}>{err.message}</li>
                ))}
              </ul>
            </Banner>
          )}
          {actionData && "ok" in actionData && actionData.ok && (
            <Banner tone="success">Saved.</Banner>
          )}

          <Form method="post" key={activeView}>
            <input type="hidden" name="viewName" value={activeView} />
            <FormLayout>
              <Text as="h3" variant="headingSm">
                Safe area (px, canvas coordinate space)
              </Text>
              <FormLayout.Group>
                <TextField label="X" name="safeAreaX" type="number" autoComplete="off" defaultValue={String(existingZone?.safeAreaX ?? 300)} />
                <TextField label="Y" name="safeAreaY" type="number" autoComplete="off" defaultValue={String(existingZone?.safeAreaY ?? 250)} />
                <TextField label="Width" name="safeAreaWidth" type="number" autoComplete="off" defaultValue={String(existingZone?.safeAreaWidth ?? 400)} />
                <TextField label="Height" name="safeAreaHeight" type="number" autoComplete="off" defaultValue={String(existingZone?.safeAreaHeight ?? 500)} />
              </FormLayout.Group>

              <Text as="h3" variant="headingSm">
                Bleed area (px — must fully contain the safe area)
              </Text>
              <FormLayout.Group>
                <TextField label="X" name="bleedAreaX" type="number" autoComplete="off" defaultValue={String(existingZone?.bleedAreaX ?? 280)} />
                <TextField label="Y" name="bleedAreaY" type="number" autoComplete="off" defaultValue={String(existingZone?.bleedAreaY ?? 230)} />
                <TextField label="Width" name="bleedAreaWidth" type="number" autoComplete="off" defaultValue={String(existingZone?.bleedAreaWidth ?? 440)} />
                <TextField label="Height" name="bleedAreaHeight" type="number" autoComplete="off" defaultValue={String(existingZone?.bleedAreaHeight ?? 540)} />
              </FormLayout.Group>

              <Text as="h3" variant="headingSm">
                Production specification
              </Text>
              <Text as="p" tone="subdued">
                Real-world size of the safe area — this, not canvas pixels, is what DPI
                warnings are calculated against.
              </Text>
              <FormLayout.Group>
                <TextField label="Physical width (in)" name="physicalWidthIn" type="number" step={0.1} autoComplete="off" defaultValue={String(existingZone?.physicalWidthIn ?? 12)} />
                <TextField label="Physical height (in)" name="physicalHeightIn" type="number" step={0.1} autoComplete="off" defaultValue={String(existingZone?.physicalHeightIn ?? 16)} />
                <TextField label="Bleed margin (in)" name="bleedMarginIn" type="number" step={0.01} autoComplete="off" defaultValue={String(existingZone?.bleedMarginIn ?? 0.125)} />
                <TextField label="Target DPI" name="targetDpi" type="number" autoComplete="off" defaultValue={String(existingZone?.targetDpi ?? 300)} />
              </FormLayout.Group>

              <Text as="h3" variant="headingSm">
                Allowed file formats
              </Text>
              <InlineGrid columns={4} gap="200">
                {FILE_FORMAT_OPTIONS.map((format) => (
                  <Checkbox
                    key={format}
                    label={format.toUpperCase()}
                    name={`format_${format}`}
                    defaultChecked={
                      existingZone?.allowedFileFormats.split(",").includes(format) ?? true
                    }
                  />
                ))}
              </InlineGrid>

              <Select
                label="Supplier (optional — falls back to shop default, then manual)"
                name="supplierId"
                options={[{ label: "— None —", value: "" }, ...suppliers.map((s) => ({ label: s.name, value: s.id }))]}
                defaultValue={existingZone?.supplierId ?? ""}
              />

              <Button submit variant="primary" loading={isSaving}>
                Save {printViewLabel(activeView)} zone
              </Button>
            </FormLayout>
          </Form>

          {existingZone && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="zoneId" value={existingZone.id} />
              <Button tone="critical" submit variant="plain">
                Remove {printViewLabel(activeView)} zone (product becomes unavailable for this view)
              </Button>
            </Form>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
