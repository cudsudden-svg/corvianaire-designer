import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import { loginErrorMessage } from "./error.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));

  return {
    errors,
  };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");

  const { errors } = actionData || loaderData;

  return (
    <AppProvider embedded={false}>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          background:
            "linear-gradient(135deg,#0f172a 0%,#111827 40%,#1e1b4b 100%)",
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Left Side */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px",
          }}
        >
          <h1
            style={{
              fontSize: "4rem",
              marginBottom: "1rem",
              fontWeight: 800,
            }}
          >
            Corvianaire
          </h1>

          <p
            style={{
              fontSize: "1.3rem",
              color: "#cbd5e1",
              maxWidth: "500px",
              lineHeight: 1.8,
            }}
          >
            Create premium custom apparel with a powerful design studio built
            directly into Shopify.
          </p>
        </div>

        {/* Right Side */}
        <div
          style={{
            width: "500px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "40px",
          }}
        >
          <div
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,.1)",
              borderRadius: "24px",
              padding: "40px",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <h2
              style={{
                fontSize: "2rem",
                marginBottom: ".5rem",
              }}
            >
              Welcome Back 👋
            </h2>

            <p
              style={{
                color: "#94a3b8",
                marginBottom: "2rem",
              }}
            >
              Sign in to access Corvianaire Studio.
            </p>

            <Form method="post">
              <label
                style={{
                  display: "block",
                  marginBottom: ".6rem",
                  color: "#cbd5e1",
                }}
              >
                Shopify Store
              </label>

              <input
                name="shop"
                type="text"
                placeholder="your-store.myshopify.com"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                style={{
                  width: "100%",
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid #374151",
                  background: "#111827",
                  color: "white",
                  fontSize: "16px",
                  marginBottom: "10px",
                }}
              />

              {errors.shop && (
                <p
                  style={{
                    color: "#ef4444",
                    marginBottom: "16px",
                  }}
                >
                  {errors.shop}
                </p>
              )}

              <button
                type="submit"
                style={{
                  width: "100%",
                  padding: "16px",
                  background:
                    "linear-gradient(90deg,#6366f1,#8b5cf6)",
                  color: "white",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "16px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Continue →
              </button>
            </Form>

            <p
              style={{
                marginTop: "2rem",
                textAlign: "center",
                color: "#64748b",
                fontSize: ".9rem",
              }}
            >
              Secure authentication powered by Shopify
            </p>
          </div>
        </div>
      </div>
    </AppProvider>
  );
}