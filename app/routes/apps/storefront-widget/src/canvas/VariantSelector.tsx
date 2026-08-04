// VariantSelector — color/size selection + quantity, resolving to a real
// Shopify variant ID from the product's own live variant list (Phase 10).
// Nothing here is hardcoded: colors/sizes come from
// ShopifyProduct.availableColors/availableSizes, which are themselves
// derived from variants at fetch time (see normalize-product.ts).
import type { ShopifyProduct, ShopifyProductVariant } from "@corvianaire/shared/types";

interface VariantSelectorProps {
  product: ShopifyProduct;
  selectedColor: string | null;
  selectedSize: string | null;
  quantity: number;
  onColorChange: (color: string) => void;
  onSizeChange: (size: string) => void;
  onQuantityChange: (quantity: number) => void;
}

/** Resolves the exact variant matching a given color/size combination, if one exists and is available. */
export function resolveVariant(
  product: ShopifyProduct,
  color: string | null,
  size: string | null,
): ShopifyProductVariant | null {
  return (
    product.variants.find((variant) => {
      const optionValue = (name: string) =>
        variant.selectedOptions.find((o) => o.name.toLowerCase() === name)?.value;
      const colorMatches = color === null || optionValue("color") === color;
      const sizeMatches = size === null || optionValue("size") === size;
      return colorMatches && sizeMatches && variant.availableForSale;
    }) ?? null
  );
}

export function VariantSelector({
  product,
  selectedColor,
  selectedSize,
  quantity,
  onColorChange,
  onSizeChange,
  onQuantityChange,
}: VariantSelectorProps) {
  return (
    <div className="corvianaire-variant-selector">
      {product.availableColors.length > 0 && (
        <div className="corvianaire-variant-option-group">
          <span>Color</span>
          {product.availableColors.map((color) => {
            const matchExists = resolveVariant(product, color, selectedSize) !== null;
            return (
              <button
                key={color}
                type="button"
                className={`corvianaire-variant-swatch${color === selectedColor ? " is-active" : ""}`}
                disabled={!matchExists}
                onClick={() => onColorChange(color)}
                title={matchExists ? color : `${color} — not available in this size`}
              >
                {color}
              </button>
            );
          })}
        </div>
      )}

      {product.availableSizes.length > 0 && (
        <div className="corvianaire-variant-option-group">
          <span>Size</span>
          {product.availableSizes.map((size) => {
            const matchExists = resolveVariant(product, selectedColor, size) !== null;
            return (
              <button
                key={size}
                type="button"
                className={`corvianaire-variant-swatch${size === selectedSize ? " is-active" : ""}`}
                disabled={!matchExists}
                onClick={() => onSizeChange(size)}
                title={matchExists ? size : `${size} — not available in this color`}
              >
                {size}
              </button>
            );
          })}
        </div>
      )}

      <div className="corvianaire-variant-option-group">
        <span>Qty</span>
        <button
          type="button"
          className="corvianaire-variant-swatch"
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
        >
          −
        </button>
        <span>{quantity}</span>
        <button
          type="button"
          className="corvianaire-variant-swatch"
          onClick={() => onQuantityChange(quantity + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
