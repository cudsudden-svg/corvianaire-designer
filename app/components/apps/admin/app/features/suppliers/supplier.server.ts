// Supplier CRUD (Stage 8) — the only place that writes to the Supplier
// Prisma model. Resolution (mapping a row to its SupplierProvider
// implementation) stays in supplier-provider.server.ts; this file only
// manages the rows themselves, same split the rest of the app uses
// between a "server.ts" that owns a model and code that just reads it.
import { Prisma } from "@prisma/client";
import type { Supplier } from "@prisma/client";
import prisma from "~/lib/db/db.server";

// Slugs with a real SupplierProvider implementation today (see
// supplier-provider.server.ts's factory switch). Printful/Printify/Gelato
// are Stage 10's fulfillment-abstraction work, not yet backed by a
// provider class — kept as a constant here so the admin UI's slug picker
// and the factory switch can't silently drift apart.
export const IMPLEMENTED_SUPPLIER_SLUGS = ["manual", "apliiq"] as const;
export type ImplementedSupplierSlug = (typeof IMPLEMENTED_SUPPLIER_SLUGS)[number];

export interface UpsertSupplierInput {
  /** Omit to create a new supplier; include to update an existing one. */
  id?: string;
  shopDomain: string;
  name: string;
  slug: string;
  isActive: boolean;
  isDefault: boolean;
  /** Opaque provider-specific config as a JSON string — NEVER raw secrets; see suppliers/types.ts's secret-handling contract. */
  configJson: string;
}

export interface SupplierValidationError {
  field: string;
  message: string;
}

export function validateSupplierInput(input: UpsertSupplierInput): SupplierValidationError[] {
  const errors: SupplierValidationError[] = [];

  if (!input.name.trim()) {
    errors.push({ field: "name", message: "Name is required." });
  }
  if (!(IMPLEMENTED_SUPPLIER_SLUGS as readonly string[]).includes(input.slug)) {
    errors.push({
      field: "slug",
      message: `No SupplierProvider implementation exists for "${input.slug}" yet.`,
    });
  }
  try {
    JSON.parse(input.configJson || "{}");
  } catch {
    errors.push({ field: "configJson", message: "Config must be valid JSON (or left empty)." });
  }

  return errors;
}

export class SupplierValidationException extends Error {
  constructor(public readonly errors: SupplierValidationError[]) {
    super(`Supplier validation failed: ${errors.map((e) => e.message).join(" ")}`);
    this.name = "SupplierValidationException";
  }
}

export async function listSuppliers(shopDomain: string): Promise<Supplier[]> {
  return prisma.supplier.findMany({
    where: { shopDomain },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function getSupplier(id: string, shopDomain: string): Promise<Supplier | null> {
  return prisma.supplier.findFirst({ where: { id, shopDomain } });
}

export async function upsertSupplier(input: UpsertSupplierInput): Promise<Supplier> {
  const errors = validateSupplierInput(input);
  if (errors.length > 0) {
    throw new SupplierValidationException(errors);
  }

  const data = {
    shopDomain: input.shopDomain,
    name: input.name.trim(),
    slug: input.slug,
    isActive: input.isActive,
    isDefault: input.isDefault,
    configJson: input.configJson || "{}",
  };

  try {
    return await prisma.$transaction(async (tx) => {
      // Only one default supplier per shop — making this one the default
      // unsets any other rather than requiring the merchant to remember
      // to toggle the old one off first.
      if (input.isDefault) {
        await tx.supplier.updateMany({
          where: {
            shopDomain: input.shopDomain,
            isDefault: true,
            ...(input.id ? { id: { not: input.id } } : {}),
          },
          data: { isDefault: false },
        });
      }

      if (input.id) {
        return tx.supplier.update({ where: { id: input.id }, data });
      }
      return tx.supplier.create({ data });
    });
  } catch (error) {
    // Supplier.@@unique([shopDomain, slug]) — surface as a normal
    // validation error rather than a raw DB exception.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SupplierValidationException([
        { field: "slug", message: `A supplier using "${input.slug}" already exists for this shop.` },
      ]);
    }
    throw error;
  }
}

/** shopDomain-guarded delete via deleteMany — enforces ownership and delete in one atomic call rather than check-then-delete. */
export async function deleteSupplier(id: string, shopDomain: string): Promise<void> {
  await prisma.supplier.deleteMany({ where: { id, shopDomain } });
}
