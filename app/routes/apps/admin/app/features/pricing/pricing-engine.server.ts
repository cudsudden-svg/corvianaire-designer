// Pricing engine — the ONLY place that turns a design's customization
// choices into a price. Reads PricingRule rows (merchant-configurable —
// CRUD UI deferred to Stage 8, but the read/apply path here is exactly
// what that UI will end up managing) and applies every rule that matches
// the given design context, in a deterministic, debuggable way.
//
// Fallback behavior: if NO rules exist for a shop (fresh install, before
// a merchant configures anything), the engine returns just the base
// price with an empty breakdown — never throws, never silently charges
// an arbitrary default. A missing pricing configuration is a valid state,
// not an error.
import prisma from "~/lib/db/db.server";
import type { PricingRule } from "@prisma/client";

export interface PricingContext {
  shopDomain: string;
  shopifyProductId: string;
  /** Base price for the selected variant, in cents (from live Shopify variant data — never stored). */
  baseVariantPriceCents: number;
  /** Print views actually used in this design (have content) — drives PRINT_LOCATION rules. */
  usedViews: string[];
  /** Per-view technique, if the customer chose one (e.g. "embroidery") — drives TECHNIQUE rules. Views not present here are assumed standard/no surcharge. */
  techniqueByView?: Record<string, string>;
  /** Whether a premium font tier was used anywhere in the design — drives FONT_TIER rules. */
  usedPremiumFont?: boolean;
  /** Per-view dominant asset type ("uploaded" | "clipart") — drives ASSET_TYPE rules. */
  assetTypeByView?: Record<string, "uploaded" | "clipart">;
}

export interface AppliedRuleBreakdown {
  ruleId: string;
  label: string;
  ruleType: PricingRule["ruleType"];
  viewName: string | null;
  priceDeltaCents: number;
}

export interface PricingResult {
  baseVariantPriceCents: number;
  appliedRules: AppliedRuleBreakdown[];
  totalDeltaCents: number;
  totalPriceCents: number;
}

/**
 * A rule "matches" a context when its scoping (shopifyProductId/viewName,
 * both nullable = wildcard) is satisfied AND the rule's type-specific
 * condition is met. Kept as a small set of pure predicate functions so
 * each rule type's matching logic is independently readable/testable.
 */
function ruleScopeMatches(rule: PricingRule, ctx: PricingContext, viewName: string | null): boolean {
  if (rule.shopifyProductId && rule.shopifyProductId !== ctx.shopifyProductId) return false;
  if (rule.viewName && rule.viewName !== viewName) return false;
  return true;
}

export async function computePrice(ctx: PricingContext): Promise<PricingResult> {
  const rules = await prisma.pricingRule.findMany({
    where: { shopDomain: ctx.shopDomain, isActive: true },
  });

  const appliedRules: AppliedRuleBreakdown[] = [];

  for (const rule of rules) {
    switch (rule.ruleType) {
      case "PRINT_LOCATION": {
        // One charge per used view that this rule's scope matches.
        for (const view of ctx.usedViews) {
          if (ruleScopeMatches(rule, ctx, view)) {
            appliedRules.push(toBreakdown(rule, view));
          }
        }
        break;
      }

      case "TECHNIQUE": {
        for (const [view, technique] of Object.entries(ctx.techniqueByView ?? {})) {
          if (!ctx.usedViews.includes(view)) continue;
          // A TECHNIQUE rule's `label` convention encodes which technique
          // it applies to isn't modeled as a separate column (kept the
          // schema minimal per the Stage 1 design) — matching here is
          // scope-only (product/view); technique-name-specific rules are
          // expressed by scoping a rule to that view and giving it a
          // clear label, e.g. "Embroidery — Front".
          if (technique && ruleScopeMatches(rule, ctx, view)) {
            appliedRules.push(toBreakdown(rule, view));
          }
        }
        break;
      }

      case "FONT_TIER": {
        if (ctx.usedPremiumFont && ruleScopeMatches(rule, ctx, null)) {
          appliedRules.push(toBreakdown(rule, null));
        }
        break;
      }

      case "ASSET_TYPE": {
        for (const [view, assetType] of Object.entries(ctx.assetTypeByView ?? {})) {
          if (!ctx.usedViews.includes(view)) continue;
          if (assetType === "uploaded" && ruleScopeMatches(rule, ctx, view)) {
            appliedRules.push(toBreakdown(rule, view));
          }
        }
        break;
      }
    }
  }

  const totalDeltaCents = appliedRules.reduce((sum, r) => sum + r.priceDeltaCents, 0);

  return {
    baseVariantPriceCents: ctx.baseVariantPriceCents,
    appliedRules,
    totalDeltaCents,
    totalPriceCents: ctx.baseVariantPriceCents + totalDeltaCents,
  };
}

function toBreakdown(rule: PricingRule, viewName: string | null): AppliedRuleBreakdown {
  return {
    ruleId: rule.id,
    label: rule.label,
    ruleType: rule.ruleType,
    viewName,
    priceDeltaCents: rule.priceDeltaCents,
  };
}

// ─────────────────────────────────────────────────────────────
// PricingRule CRUD (Stage 8). Deferred from Stage 5 — see that stage's
// README note. The read/apply path above is exactly what this UI
// manages; kept in the same file since both own the one PricingRule
// model (same rule as print-zone.server.ts / design.server.ts).
// ─────────────────────────────────────────────────────────────
export interface UpsertPricingRuleInput {
  /** Omit to create a new rule; include to update an existing one. */
  id?: string;
  shopDomain: string;
  label: string;
  ruleType: PricingRule["ruleType"];
  /** Null = applies to every product / every view (wildcard scoping — see ruleScopeMatches above). */
  shopifyProductId: string | null;
  viewName: string | null;
  priceDeltaCents: number;
  isActive: boolean;
}

export interface PricingRuleValidationError {
  field: string;
  message: string;
}

/** Pure validation, no DB access — same shape/rationale as validatePrintZoneInput. */
export function validatePricingRuleInput(input: UpsertPricingRuleInput): PricingRuleValidationError[] {
  const errors: PricingRuleValidationError[] = [];

  if (!input.label.trim()) {
    errors.push({ field: "label", message: "Label is required." });
  }
  if (!Number.isFinite(input.priceDeltaCents)) {
    errors.push({ field: "priceDeltaCents", message: "Price adjustment must be a number." });
  }

  return errors;
}

export class PricingRuleValidationException extends Error {
  constructor(public readonly errors: PricingRuleValidationError[]) {
    super(`Pricing rule validation failed: ${errors.map((e) => e.message).join(" ")}`);
    this.name = "PricingRuleValidationException";
  }
}

export async function listPricingRules(shopDomain: string): Promise<PricingRule[]> {
  return prisma.pricingRule.findMany({
    where: { shopDomain },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });
}

export async function getPricingRule(id: string, shopDomain: string): Promise<PricingRule | null> {
  return prisma.pricingRule.findFirst({ where: { id, shopDomain } });
}

export async function upsertPricingRule(input: UpsertPricingRuleInput): Promise<PricingRule> {
  const errors = validatePricingRuleInput(input);
  if (errors.length > 0) {
    throw new PricingRuleValidationException(errors);
  }

  const data = {
    shopDomain: input.shopDomain,
    label: input.label.trim(),
    ruleType: input.ruleType,
    shopifyProductId: input.shopifyProductId,
    viewName: input.viewName,
    priceDeltaCents: input.priceDeltaCents,
    isActive: input.isActive,
  };

  if (input.id) {
    return prisma.pricingRule.update({ where: { id: input.id }, data });
  }
  return prisma.pricingRule.create({ data });
}

/** shopDomain-guarded delete via deleteMany — enforces ownership and delete in one atomic call rather than check-then-delete. */
export async function deletePricingRule(id: string, shopDomain: string): Promise<void> {
  await prisma.pricingRule.deleteMany({ where: { id, shopDomain } });
}
