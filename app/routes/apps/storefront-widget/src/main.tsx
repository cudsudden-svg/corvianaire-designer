import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { productClient } from "./api/client";
import { LivePrintZoneProvider } from "./config/view-configuration-provider";
import "./styles.css";

const ROOT_ELEMENT_ID = "corvianaire-studio-root";

function mount() {
  const root = document.getElementById(ROOT_ELEMENT_ID);
  if (!root) return;

  const productHandle = root.dataset.productHandle;
  if (!productHandle) {
    root.textContent = "Customizer unavailable: no product handle found.";
    return;
  }
  // Liquid renders {{ customer.id }} as an empty string when signed out —
  // normalize that to null so downstream code has one clean "not logged
  // in" value instead of also having to check for "".
  const customerId = root.dataset.customerId || null;

  // Composition root: this is the one place that decides which
  // ViewConfigurationProvider implementation is in use. Stage 5 swaps
  // Stage 3's FallbackViewConfigurationProvider for the real,
  // per-product LivePrintZoneProvider — nothing in App.tsx, ViewTabs, or
  // CanvasStage had to change to make this work, exactly as the
  // interface was designed to allow back in Stage 3. Reuses the same
  // proxy client singleton the product/upload/clipart calls already use.
  const viewConfigurationProvider = new LivePrintZoneProvider(productClient);

  createRoot(root).render(
    <StrictMode>
      <App
        productHandle={productHandle}
        viewConfigurationProvider={viewConfigurationProvider}
        customerId={customerId}
      />
    </StrictMode>,
  );
}

mount();
