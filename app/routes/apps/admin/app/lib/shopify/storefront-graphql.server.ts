// Thin Storefront API client. Unlike the Admin API, this doesn't go
// through an authenticated merchant session — it uses a public Storefront
// API access token (created once via Admin, see README Stage 2 notes) and
// is safe to call from the theme app extension's client-side JS or,
// preferably, proxied through our own app proxy route so the token never
// ships to the browser at all (see app/routes/proxy.products.$handle.tsx).
const STOREFRONT_API_VERSION = process.env.STOREFRONT_API_VERSION ?? "2024-10";

interface StorefrontGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function storefrontGraphQL<T>(
  shopDomain: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const token = process.env.STOREFRONT_API_TOKEN;
  if (!token) {
    throw new Error(
      "STOREFRONT_API_TOKEN is not set. Create a Storefront API access token " +
        "for this app (Admin API's storefrontAccessTokenCreate mutation, or " +
        "Partner Dashboard > App setup > Storefront API) and add it to .env.",
    );
  }

  const response = await fetch(
    `https://${shopDomain}/api/${STOREFRONT_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  if (!response.ok) {
    throw new Error(`Storefront API request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as StorefrontGraphQLResponse<T>;

  if (json.errors?.length) {
    throw new Error(`Storefront API error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Storefront API returned no data");
  }

  return json.data;
}
