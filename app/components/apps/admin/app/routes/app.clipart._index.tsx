// Clipart Library management (Stage 8) — a merchant-facing UI over the
// clipart.server.ts functions that already existed for this purpose
// (see its "used by the admin-managed clipart upload UI (Stage 8)" doc
// comment) and the public proxy.clipart.tsx route the storefront widget
// reads from. Upload validation reuses the exact same magic-byte
// sniffing + SVG sanitization path as the customer upload endpoint
// (proxy.uploads.tsx) — a merchant-supplied SVG gets rendered in this
// very page's grid, so it's no less deserving of sanitization.
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import {
  json,
  unstable_createMemoryUploadHandler,
  unstable_parseMultipartFormData,
} from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  InlineGrid,
  InlineStack,
  Text,
  Thumbnail,
} from "@shopify/polaris";
import { authenticate } from "~/lib/shopify/shopify.server";
import {
  getClipartLibrary,
  getClipartCategories,
  findOrCreateCategory,
  addClipartAsset,
  deleteClipartAsset,
} from "~/features/clipart/clipart.server";
import {
  MAX_UPLOAD_SIZE_BYTES,
  isAllowedMimeType,
  sniffMimeType,
} from "~/features/uploads/upload-validation.server";

const NEW_CATEGORY_VALUE = "__new__";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  const [library, categories] = await Promise.all([getClipartLibrary(), getClipartCategories()]);
  return json({ library, categories });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await unstable_parseMultipartFormData(
        request,
        unstable_createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE_BYTES }),
      );
    } catch {
      return json(
        { ok: false, error: `File exceeds the ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB limit` },
        { status: 413 },
      );
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return json({ ok: false, error: "Choose a file to upload." }, { status: 422 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = sniffMimeType(buffer);
    if (!mimeType || !isAllowedMimeType(mimeType)) {
      return json({ ok: false, error: "Unsupported file type — use PNG, JPEG, WEBP, or SVG." }, { status: 422 });
    }

    const name = String(formData.get("name") || "").trim();
    if (!name) {
      return json({ ok: false, error: "Asset name is required." }, { status: 422 });
    }

    const tags = String(formData.get("tags") || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    let categorySlug = String(formData.get("categorySlug") || "");
    if (categorySlug === NEW_CATEGORY_VALUE) {
      const newCategoryName = String(formData.get("newCategoryName") || "").trim();
      if (!newCategoryName) {
        return json({ ok: false, error: "New category name is required." }, { status: 422 });
      }
      const category = await findOrCreateCategory(newCategoryName, slugify(newCategoryName));
      categorySlug = category.slug;
    }
    if (!categorySlug) {
      return json({ ok: false, error: "Choose a category." }, { status: 422 });
    }

    try {
      await addClipartAsset({
        name,
        tags,
        categorySlug,
        buffer,
        fileName: file.name,
        mimeType,
      });
      return json({ ok: true });
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : "Upload failed." }, { status: 500 });
    }
  }

  const formData = await request.formData();
  if (formData.get("intent") === "delete") {
    await deleteClipartAsset(String(formData.get("assetId")));
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown action." }, { status: 400 });
};

export default function ClipartIndex() {
  const { library, categories } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isUploading = navigation.state === "submitting";
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug ?? NEW_CATEGORY_VALUE);

  return (
    <Page title="Clipart Library" subtitle="Assets available to every customer in the storefront widget">
      <BlockStack gap="400">
        {actionData && "error" in actionData && actionData.error && (
          <Banner tone="critical" title="Couldn't complete that action">
            <p>{actionData.error}</p>
          </Banner>
        )}
        {actionData && "ok" in actionData && actionData.ok && (
          <Banner tone="success">Done.</Banner>
        )}

        <Card>
          <Form method="post" encType="multipart/form-data">
            <FormLayout>
              <Text as="h2" variant="headingMd">
                Upload asset
              </Text>
              <FormLayout.Group>
                <TextField label="Name" name="name" autoComplete="off" />
                <TextField label="Tags" name="tags" autoComplete="off" placeholder="comma, separated, tags" />
              </FormLayout.Group>

              <Select
                label="Category"
                name="categorySlug"
                value={categorySlug}
                onChange={setCategorySlug}
                options={[
                  ...categories.map((c) => ({ label: c.name, value: c.slug })),
                  { label: "+ New category…", value: NEW_CATEGORY_VALUE },
                ]}
              />
              {categorySlug === NEW_CATEGORY_VALUE && (
                <TextField label="New category name" name="newCategoryName" autoComplete="off" />
              )}

              <input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required />

              <Button submit variant="primary" loading={isUploading}>
                Upload
              </Button>
            </FormLayout>
          </Form>
        </Card>

        {library.map((category) => (
          <Card key={category.id}>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                {category.name} ({category.assets.length})
              </Text>
              {category.assets.length === 0 ? (
                <Text as="p" tone="subdued">
                  No assets in this category yet.
                </Text>
              ) : (
                <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="300">
                  {category.assets.map((asset) => (
                    <BlockStack key={asset.id} gap="150">
                      <Thumbnail source={asset.thumbUrl} alt={asset.name} size="large" />
                      <Text as="span" variant="bodySm" truncate>
                        {asset.name}
                      </Text>
                      <Form method="post">
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="assetId" value={asset.id} />
                        <Button
                          tone="critical"
                          variant="plain"
                          size="slim"
                          submit
                          onClick={(e) => {
                            if (!confirm(`Delete "${asset.name}"?`)) e.preventDefault();
                          }}
                        >
                          Delete
                        </Button>
                      </Form>
                    </BlockStack>
                  ))}
                </InlineGrid>
              )}
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Page>
  );
}
