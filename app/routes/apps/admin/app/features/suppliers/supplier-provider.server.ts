// Supplier provider factory. Resolves a `Supplier` DB row (shop-specific
// config) to its `SupplierProvider` implementation by slug. Same pattern
// as storage-provider.server.ts — callers never import a provider class
// directly, and adding a new supplier never touches this file's callers,
// only this switch.
import type { Supplier } from "@prisma/client";
import type { SupplierProvider } from "./types";
import { ApliiqSupplierProvider } from "./providers/apliiq-supplier.provider.server";
import { ManualSupplierProvider } from "./providers/manual-supplier.provider.server";
import prisma from "~/lib/db/db.server";

export function getSupplierProvider(supplier: Supplier): SupplierProvider {
  switch (supplier.slug) {
    case "apliiq": {
      const config = JSON.parse(supplier.configJson) as { accountId?: string };
      return new ApliiqSupplierProvider(config);
    }
    case "manual":
      return new ManualSupplierProvider();
    default:
      throw new Error(
        `Unknown supplier slug "${supplier.slug}". Add a matching provider in ` +
          `app/features/suppliers/providers/ and register it here.`,
      );
  }
}

/**
 * Resolve the effective supplier for a print zone: the zone's own
 * supplier if set, otherwise the shop's default supplier, otherwise the
 * built-in ManualSupplierProvider (never a hard failure — an
 * unconfigured supplier is a supported state, not an error).
 */
export async function getSupplierProviderForZone(
  shopDomain: string,
  supplierId: string | null,
): Promise<SupplierProvider> {
  if (supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (supplier) return getSupplierProvider(supplier);
  }

  const defaultSupplier = await prisma.supplier.findFirst({
    where: { shopDomain, isDefault: true, isActive: true },
  });
  if (defaultSupplier) return getSupplierProvider(defaultSupplier);

  return new ManualSupplierProvider();
}
