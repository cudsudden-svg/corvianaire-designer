// Pricing rule create/edit form. `params.id === "new"` is the create
// case — same "special id string" trick print-zones' product picker
// avoids needing (products already have real ids) but a bare rule
// doesn't have one until it exists.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Banner,
} from "@shopify/polaris";
import type { PricingRuleType } from "@prisma/client";
import { authenticate } from "~/lib/shopify/shopify.server";
import {
  getPricingRule,
  upsertPricingRule,
  deletePricingRule,
  PricingRuleValidationException,
} from "~/features/pricing/pricing-engine.server";
import { ALL_PRINT_VIEWS, printViewLabel } from "@corvianaire/shared/utils";

const RULE_TYPE_OPTIONS = [
  { label: "Print location (charged per view used)", value: "PRINT_LOCATION" },
  { label: "Technique (e.g. embroidery)", value: "TECHNIQUE" },
  { label: "Font tier (premium font surcharge)", value: "FONT_TIER" },
  { label: "Asset type (uploaded vs clipart)", value: "ASSET_TYPE" },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;

  if (id === "new") {
    return json({ rule: null });
  }

  const rule = await getPricingRule(id, session.shop);
  if (!rule) {
    throw json({ error: "Pricing rule not found" }, { status: 404 });
  }
  return json({ rule });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;
  const formData = await request.formData();

  if (formData.get("intent") === "delete") {
    if (id !== "new") await deletePricingRule(id, session.shop);
    return redirect("/app/pricing");
  }

  const dollars = Number(formData.get("priceDelta"));
  const viewName = String(formData.get("viewName") || "");
  const shopifyProductId = String(formData.get("shopifyProductId") || "").trim();

  try {
    const rule = await upsertPricingRule({
      id: id === "new" ? undefined : id,
      shopDomain: session.shop,
      label: String(formData.get("label") || ""),
      ruleType: String(formData.get("ruleType")) as PricingRuleType,
      shopifyProductId: shopifyProductId || null,
      viewName: viewName || null,
      priceDeltaCents: Math.round(dollars * 100),
      isActive: formData.get("isActive") === "on",
    });
    return redirect(`/app/pricing/${rule.id}`);
  } catch (error) {
    if (error instanceof PricingRuleValidationException) {
      return json({ ok: false, errors: error.errors }, { status: 422 });
    }
    throw error;
  }
};

export default function PricingRuleEditor() {
  const { rule } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <Page
      title={rule ? `Edit — ${rule.label}` : "Create pricing rule"}
      backAction={{ url: "/app/pricing" }}
    >
      <Card>
        {actionData && "errors" in actionData && actionData.errors && (
          <Banner tone="critical" title="Couldn't save this rule">
            <ul>
              {actionData.errors.map((err) => (
                <li key={err.field}>{err.message}</li>
              ))}
            </ul>
          </Banner>
        )}

        <Form method="post">
          <FormLayout>
            <TextField
              label="Label"
              name="label"
              autoComplete="off"
              defaultValue={rule?.label ?? ""}
              helpText='Shown to the merchant only — e.g. "Front print", "Embroidery".'
            />

            <Select
              label="Rule type"
              name="ruleType"
              options={RULE_TYPE_OPTIONS}
              defaultValue={rule?.ruleType ?? "PRINT_LOCATION"}
            />

            <FormLayout.Group>
              <TextField
                label="Scope to one product (optional)"
                name="shopifyProductId"
                autoComplete="off"
                defaultValue={rule?.shopifyProductId ?? ""}
                placeholder="gid://shopify/Product/…"
                helpText="Leave blank to apply to every product."
              />
              <Select
                label="Scope to one view (optional)"
                name="viewName"
                defaultValue={rule?.viewName ?? ""}
                options={[
                  { label: "All views", value: "" },
                  ...ALL_PRINT_VIEWS.map((v) => ({ label: printViewLabel(v), value: v })),
                ]}
              />
            </FormLayout.Group>

            <TextField
              label="Price adjustment (USD)"
              name="priceDelta"
              type="number"
              step={0.01}
              autoComplete="off"
              defaultValue={rule ? (rule.priceDeltaCents / 100).toFixed(2) : "0.00"}
              helpText="Added to the base variant price when this rule matches. Use a negative number for a discount."
            />

            <Checkbox label="Active" name="isActive" defaultChecked={rule?.isActive ?? true} />

            <Button submit variant="primary" loading={isSaving}>
              Save
            </Button>
          </FormLayout>
        </Form>

        {rule && (
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <Button
              tone="critical"
              variant="plain"
              submit
              onClick={(e) => {
                if (!confirm(`Delete "${rule.label}"?`)) e.preventDefault();
              }}
            >
              Delete rule
            </Button>
          </Form>
        )}
      </Card>
    </Page>
  );
}
