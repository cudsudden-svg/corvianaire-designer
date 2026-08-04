// GraphQL query documents used against the Admin API (via the
// authenticated session's admin.graphql client). Used inside the
// embedded app itself — e.g. the product picker when a merchant sets up
// print zones or pricing rules (Stage 5), and the admin dashboard's
// order/design views (Stage 8).
export const ADMIN_GET_PRODUCT_QUERY = `#graphql
  query GetProductAdmin($id: ID!) {
    product(id: $id) {
      id
      title
      descriptionHtml
      handle
      images(first: 20) {
        nodes {
          id
          url
          altText
          width
          height
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          price
          availableForSale
          inventoryQuantity
          selectedOptions {
            name
            value
          }
          image {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`;

export const ADMIN_LIST_PRODUCTS_QUERY = `#graphql
  query ListProductsAdmin($query: String, $first: Int!, $after: String) {
    products(first: $first, after: $after, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        images(first: 1) {
          nodes {
            url
            altText
          }
        }
      }
    }
  }
`;
