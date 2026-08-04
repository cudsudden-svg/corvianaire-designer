// Supplier create/edit form. `params.id === "new"` is the create case,
// same convention as app.pricing.$id.tsx.
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
  Text,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import {
  IMPLEMENTED_SUPPLIER_SLUGS,
  getSupplier,
  upsertSupplier,
  deleteSupplier,
  SupplierValidationException,
} from "~/features/suppliers/supplier.server";

const SLUG_LABEL: Record<string, string> = {
  manual: "Manual — a human handles production",
  apliiq: "Apliiq",
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;

  if (id === "new") {
    return json({ supplier: null });
  }

  const supplier = await getSupplier(id, session.shop);
  if (!supplier) {
    throw json({ error: "Supplier not found" }, { status: 404 });
  }
  return json({ supplier });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const id = params.id!;
  const formData = await request.formData();

  if (formData.get("intent") === "delete") {
    if (id !== "new") await deleteSupplier(id, session.shop);
    return redirect("/app/suppliers");
  }

  try {
    const supplier = await upsertSupplier({
      id: id === "new" ? undefined : id,
      shopDomain: session.shop,
      name: String(formData.get("name") || ""),
      slug: String(formData.get("slug") || ""),
      isActive: formData.get("isActive") === "on",
      isDefault: formData.get("isDefault") === "on",
      configJson: String(formData.get("configJson") || "{}"),
    });
    return redirect(`/app/suppliers/${supplier.id}`);
  } catch (error) {
    if (error instanceof SupplierValidationException) {
      return json({ ok: false, errors: error.errors }, { status: 422 });
    }
    throw error;
  }
};

export default function SupplierEditor() {
  const { supplier } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  return (
    <Page
      title={supplier ? `Edit — ${supplier.name}` : "Add supplier"}
      backAction={{ url: "/app/suppliers" }}
    >
      <Card>
        {actionData && "errors" in actionData && actionData.errors && (
          <Banner tone="critical" title="Couldn't save this supplier">
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
              label="Name"
              name="name"
              autoComplete="off"
              defaultValue={supplier?.name ?? ""}
              helpText='Merchant-facing label, e.g. "Apliiq — Primary".'
            />

            <Select
              label="Provider"
              name="slug"
              defaultValue={supplier?.slug ?? IMPLEMENTED_SUPPLIER_SLUGS[0]}
              options={IMPLEMENTED_SUPPLIER_SLUGS.map((slug) => ({
                label: SLUG_LABEL[slug] ?? slug,
                value: slug,
              }))}
              helpText="Printful/Printify/Gelato land in Stage 10's fulfillment abstraction work."
            />

            <TextField
              label="Config (JSON)"
              name="configJson"
              multiline={4}
              autoComplete="off"
              defaultValue={supplier?.configJson ?? "{}"}
              helpText={
                'Provider-specific, opaque config — e.g. {"accountId": "..."} for Apliiq. ' +
                "Never put raw API keys/secrets here; providers read those from named " +
                "environment variables instead (see suppliers/types.ts)."
              }
            />

            <Checkbox label="Active" name="isActive" defaultChecked={supplier?.isActive ?? true} />
            <Checkbox
              label="Default supplier for this shop"
              name="isDefault"
              defaultChecked={supplier?.isDefault ?? false}
              helpText="Used when a print zone doesn't specify its own supplier. Setting this unsets any other default."
            />

            <Button submit variant="primary" loading={isSaving}>
              Save
            </Button>
          </FormLayout>
        </Form>

        {supplier && (
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <Text as="p" tone="subdued">
              Print zones currently assigned to this supplier fall back to the shop default (or
              manual) once it's removed.
            </Text>
            <Button
              tone="critical"
              variant="plain"
              submit
              onClick={(e) => {
                if (!confirm(`Delete "${supplier.name}"?`)) e.preventDefault();
              }}
            >
              Delete supplier
            </Button>
          </Form>
        )}
      </Card>
    </Page>
  );
}
