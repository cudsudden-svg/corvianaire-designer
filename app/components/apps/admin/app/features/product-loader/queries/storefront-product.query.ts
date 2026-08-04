// GraphQL query documents used against the Storefront API. This is what
// the theme app extension block (extensions/customizer-block) calls from
// the actual product page — public, unauthenticated, customer-facing
// context. Field selection is deliberately kept parallel to the Admin
// query so normalizeProduct() can treat both response shapes uniformly.
export const STOREFRONT_GET_PRODUCT_BY_HANDLE_QUERY = `#graphql
  query GetProductByHandle($handle: String!) {
    product(handle: $handle) {
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
          price {
            amount
          }
          availableForSale
          quantityAvailable
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
