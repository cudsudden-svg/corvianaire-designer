/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}