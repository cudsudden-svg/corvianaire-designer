// PrintZone service — the only place that touches the PrintZone Prisma
// model directly. Both the admin management route (app.print-zones.*)
// and the public proxy route (proxy.print-zones.$productId) go through
// here, same pattern as clipart.server.ts / uploaded-asset.server.ts.
import prisma from "~/lib/db/db.server";
import type { PrintZone } from "@prisma/client";

export interface UpsertPrintZoneInput {
  shopDomain: string;
  shopifyProductId: string;
  viewName: string;
  safeAreaX: number;
  safeAreaY: number;
  safeAreaWidth: number;
  safeAreaHeight: number;
  bleedAreaX: number;
  bleedAreaY: number;
  bleedAreaWidth: number;
  bleedAreaHeight: number;
  physicalWidthIn: number;
  physicalHeightIn: number;
  bleedMarginIn: number;
  targetDpi: number;
  allowedFileFormats: string[];
  supplierId: string | null;
}

export interface PrintZoneValidationError {
  field: string;
  message: string;
}

/**
 * Validates zone geometry/production settings before they're ever
 * written. Kept as a pure function (no DB access) so both the server
 * action and any future automated test can call it directly.
 */
export function validatePrintZoneInput(input: UpsertPrintZoneInput): PrintZoneValidationError[] {
  const errors: PrintZoneValidationError[] = [];

  if (input.safeAreaWidth <= 0 || input.safeAreaHeight <= 0) {
    errors.push({ field: "safeArea", message: "Safe area width/height must be greater than 0." });
  }
  if (input.bleedAreaWidth < input.safeAreaWidth || input.bleedAreaHeight < input.safeAreaHeight) {
    errors.push({
      field: "bleedArea",
      message: "Bleed area must be at least as large as the safe area.",
    });
  }
  if (
    input.bleedAreaX > input.safeAreaX ||
    input.bleedAreaY > input.safeAreaY ||
    input.bleedAreaX + input.bleedAreaWidth < input.safeAreaX + input.safeAreaWidth ||
    input.bleedAreaY + input.bleedAreaHeight < input.safeAreaY + input.safeAreaHeight
  ) {
    errors.push({ field: "bleedArea", message: "Bleed area must fully contain the safe area." });
  }
  if (input.physicalWidthIn <= 0 || input.physicalHeightIn <= 0) {
    errors.push({
      field: "physicalSize",
      message: "Physical print width/height must be greater than 0 inches.",
    });
  }
  if (input.targetDpi < 72 || input.targetDpi > 1200) {
    errors.push({ field: "targetDpi", message: "Target DPI should be between 72 and 1200." });
  }
  if (input.allowedFileFormats.length === 0) {
    errors.push({ field: "allowedFileFormats", message: "At least one file format is required." });
  }

  return errors;
}

export async function upsertPrintZone(input: UpsertPrintZoneInput): Promise<PrintZone> {
  const errors = validatePrintZoneInput(input);
  if (errors.length > 0) {
    throw new PrintZoneValidationException(errors);
  }

  return prisma.printZone.upsert({
    where: {
      shopDomain_shopifyProductId_viewName: {
        shopDomain: input.shopDomain,
        shopifyProductId: input.shopifyProductId,
        viewName: input.viewName,
      },
    },
    update: {
      safeAreaX: input.safeAreaX,
      safeAreaY: input.safeAreaY,
      safeAreaWidth: input.safeAreaWidth,
      safeAreaHeight: input.safeAreaHeight,
      bleedAreaX: input.bleedAreaX,
      bleedAreaY: input.bleedAreaY,
      bleedAreaWidth: input.bleedAreaWidth,
      bleedAreaHeight: input.bleedAreaHeight,
      physicalWidthIn: input.physicalWidthIn,
      physicalHeightIn: input.physicalHeightIn,
      bleedMarginIn: input.bleedMarginIn,
      targetDpi: input.targetDpi,
      allowedFileFormats: input.allowedFileFormats.join(","),
      supplierId: input.supplierId,
    },
    create: {
      shopDomain: input.shopDomain,
      shopifyProductId: input.shopifyProductId,
      viewName: input.viewName,
      safeAreaX: input.safeAreaX,
      safeAreaY: input.safeAreaY,
      safeAreaWidth: input.safeAreaWidth,
      safeAreaHeight: input.safeAreaHeight,
      bleedAreaX: input.bleedAreaX,
      bleedAreaY: input.bleedAreaY,
      bleedAreaWidth: input.bleedAreaWidth,
      bleedAreaHeight: input.bleedAreaHeight,
      physicalWidthIn: input.physicalWidthIn,
      physicalHeightIn: input.physicalHeightIn,
      bleedMarginIn: input.bleedMarginIn,
      targetDpi: input.targetDpi,
      allowedFileFormats: input.allowedFileFormats.join(","),
      supplierId: input.supplierId,
    },
  });
}

export class PrintZoneValidationException extends Error {
  constructor(public readonly errors: PrintZoneValidationError[]) {
    super(`Print zone validation failed: ${errors.map((e) => e.message).join(" ")}`);
    this.name = "PrintZoneValidationException";
  }
}

export async function getPrintZonesForProduct(
  shopDomain: string,
  shopifyProductId: string,
): Promise<PrintZone[]> {
  return prisma.printZone.findMany({
    where: { shopDomain, shopifyProductId },
    orderBy: { viewName: "asc" },
  });
}

export async function deletePrintZone(id: string): Promise<void> {
  await prisma.printZone.delete({ where: { id } });
}
