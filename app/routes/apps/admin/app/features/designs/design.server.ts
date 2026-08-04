// Design persistence service — the only place that touches
// Design/DesignView Prisma models directly (same "one service owns the
// model" pattern as clipart.server.ts / uploaded-asset.server.ts).
//
// Two save paths coexist on purpose:
//   - The DRAFT/checkpoint system (getOrCreateDraft, autosaveView,
//     saveCheckpoint, listCheckpoints, findLoginDraftConflict) — gives
//     the customer a continuously-autosaved in-progress design plus an
//     explicit-Save "My Designs" history of named checkpoints, with
//     careful guest-to-account handoff at login.
//   - saveDesign() — a direct, one-shot save used by the add-to-cart
//     flow (Stage 7). It doesn't go through a draft; it creates or
//     updates a SAVED design straight from whatever the widget currently
//     has in memory. Both paths produce ordinary Design rows and are
//     indistinguishable to everything downstream (pricing, admin
//     dashboard, order webhook) — they're just two different UX entry
//     points into the same model.
//
// Preview images are always rendered CLIENT-SIDE (a headless
// fabric.StaticCanvas in the widget — see
// apps/storefront-widget/src/commerce/render-view-image.ts) and
// uploaded as a finished image; this service only ever stores the
// resulting URL. There is deliberately no server-side re-render step —
// the admin app has no native canvas library in its dependency tree,
// and Fabric's own client-side rendering is already the source of truth
// for what the customer sees, so a second server-side rendering path
// would just be a divergent, unnecessary duplicate.
import prisma from "~/lib/db/db.server";
import type { Design, DesignView, Prisma } from "@prisma/client";
import { getStorageProvider, deleteByUrl } from "~/features/storage/storage-provider.server";
import { decodeDataUrl, extensionForMimeType } from "~/features/storage/data-url.server";
import type {
  PrintViewName,
  SaveDesignInput,
  SavedDesign,
  DesignState,
  DesignCheckpointSummary,
} from "@corvianaire/shared/types";

export type DesignWithViews = Design & { views: DesignView[] };

// ─────────────────────────────────────────────────────────────
// Shared ownership helpers
// ─────────────────────────────────────────────────────────────

export interface DesignIdentity {
  shopDomain: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  /** Known Shopify customer id, or null for a not-yet-logged-in visitor. */
  customerId: string | null;
  /** Browser-persisted id for a not-yet-logged-in visitor; ignored once customerId is set. */
  guestSessionId: string | null;
}

function ownerWhere(identity: {
  customerId: string | null;
  guestSessionId: string | null;
}): Prisma.DesignWhereInput {
  return identity.customerId
    ? { customerId: identity.customerId }
    : { customerId: null, guestSessionId: identity.guestSessionId };
}

// ─────────────────────────────────────────────────────────────
// Draft / autosave
// ─────────────────────────────────────────────────────────────

/**
 * Find the existing DRAFT for this identity, or create a fresh empty one.
 * Never creates a second DRAFT for the same (owner, product, variant) —
 * autosave always upserts into this same row.
 */
export async function getOrCreateDraft(identity: DesignIdentity): Promise<DesignWithViews> {
  const owner = ownerWhere(identity);

  const existing = await prisma.design.findFirst({
    where: {
      shopDomain: identity.shopDomain,
      shopifyProductId: identity.shopifyProductId,
      shopifyVariantId: identity.shopifyVariantId,
      status: "DRAFT",
      ...owner,
    },
    include: { views: true },
  });
  if (existing) return existing;

  return prisma.design.create({
    data: {
      shopDomain: identity.shopDomain,
      shopifyProductId: identity.shopifyProductId,
      shopifyVariantId: identity.shopifyVariantId,
      customerId: identity.customerId,
      guestSessionId: identity.customerId ? null : identity.guestSessionId,
      status: "DRAFT",
    },
    include: { views: true },
  });
}

export interface AutosaveViewInput {
  designId: string;
  viewName: PrintViewName;
  /** Fabric.js canvas.toJSON() output, already JSON.stringify'd by the caller. */
  canvasJson: string;
  /** Client-rendered preview snapshot, already uploaded — this is its URL, not the image bytes. */
  previewImageUrl: string;
}

/** Upsert one view's canvas state on autosave. */
export async function autosaveView(input: AutosaveViewInput): Promise<DesignView> {
  const view = await prisma.designView.upsert({
    where: { designId_viewName: { designId: input.designId, viewName: input.viewName } },
    update: {
      canvasJson: input.canvasJson,
      previewImageUrl: input.previewImageUrl,
    },
    create: {
      designId: input.designId,
      viewName: input.viewName,
      canvasJson: input.canvasJson,
      previewImageUrl: input.previewImageUrl,
    },
  });

  // touch the parent Design's updatedAt so "most recently edited" sorting
  // (checkpoint list, login-conflict resolution) reflects view-level edits
  await prisma.design.update({ where: { id: input.designId }, data: { updatedAt: new Date() } });

  return view;
}

// ─────────────────────────────────────────────────────────────
// Checkpoints ("My Designs")
// ─────────────────────────────────────────────────────────────

/**
 * Clone the current DRAFT into a new named checkpoint (status SAVED).
 * The draft itself is left untouched and keeps autosaving independently.
 */
export async function saveCheckpoint(designId: string, name: string): Promise<DesignWithViews> {
  const draft = await prisma.design.findUnique({ where: { id: designId }, include: { views: true } });
  if (!draft) throw new DesignNotFoundError(designId);
  if (draft.status !== "DRAFT") {
    throw new Error(`Design ${designId} is not a DRAFT — only a draft can be saved as a checkpoint.`);
  }

  return prisma.design.create({
    data: {
      shopDomain: draft.shopDomain,
      customerId: draft.customerId,
      guestSessionId: draft.guestSessionId,
      shopifyProductId: draft.shopifyProductId,
      shopifyVariantId: draft.shopifyVariantId,
      customerNotes: draft.customerNotes,
      computedPriceCents: draft.computedPriceCents,
      status: "SAVED",
      name,
      views: {
        create: draft.views.map((v) => ({
          viewName: v.viewName,
          canvasJson: v.canvasJson,
          previewImageUrl: v.previewImageUrl,
        })),
      },
    },
    include: { views: true },
  });
}

export interface ListCheckpointsInput {
  shopDomain: string;
  customerId: string | null;
  guestSessionId: string | null;
  shopifyProductId?: string;
  take?: number;
  cursor?: string | null;
}

/**
 * Paginated on purpose: no hard cap on checkpoints, but never fetch/render
 * an unbounded list — a future per-customer limit is a query-layer
 * change here, not a schema change.
 */
export async function listCheckpoints(
  input: ListCheckpointsInput,
): Promise<{ items: DesignWithViews[]; nextCursor: string | null }> {
  const take = Math.min(input.take ?? 20, 50);
  const owner = ownerWhere({ customerId: input.customerId, guestSessionId: input.guestSessionId });

  const where: Prisma.DesignWhereInput = {
    shopDomain: input.shopDomain,
    status: "SAVED",
    ...owner,
    ...(input.shopifyProductId ? { shopifyProductId: input.shopifyProductId } : {}),
  };

  const items = await prisma.design.findMany({
    where,
    include: { views: true },
    orderBy: { updatedAt: "desc" },
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > take;
  const page = hasMore ? items.slice(0, take) : items;
  return { items: page, nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null };
}

// ─────────────────────────────────────────────────────────────
// Guest → account login handoff
// ─────────────────────────────────────────────────────────────

/**
 * Login-flow check: does this visitor have both a guest DRAFT and an
 * account DRAFT for the same product+variant? Read-only — never merges,
 * overwrites, or deletes either row. The caller (login route) decides
 * what to show based on the returned shape.
 */
export async function findLoginDraftConflict(
  shopDomain: string,
  guestSessionId: string,
  customerId: string,
  shopifyProductId: string,
  shopifyVariantId: string,
): Promise<
  | { kind: "none" }
  | { kind: "guest-only" | "account-only"; design: DesignWithViews }
  | { kind: "conflict"; guestDraft: DesignWithViews; accountDraft: DesignWithViews }
> {
  const [guestDraft, accountDraft] = await Promise.all([
    prisma.design.findFirst({
      where: { shopDomain, guestSessionId, customerId: null, shopifyProductId, shopifyVariantId, status: "DRAFT" },
      include: { views: true },
    }),
    prisma.design.findFirst({
      where: { shopDomain, customerId, shopifyProductId, shopifyVariantId, status: "DRAFT" },
      include: { views: true },
    }),
  ]);

  if (guestDraft && accountDraft) return { kind: "conflict", guestDraft, accountDraft };
  if (guestDraft) return { kind: "guest-only", design: guestDraft };
  if (accountDraft) return { kind: "account-only", design: accountDraft };
  return { kind: "none" };
}

/**
 * Apply the customer's choice from a login conflict. The design NOT
 * chosen is left exactly as-is (still reachable by guestSessionId if the
 * guest draft was the one skipped) — never deleted automatically.
 */
export async function resolveLoginChoice(
  chosenDesignId: string,
  customerId: string,
): Promise<DesignWithViews> {
  return prisma.design.update({
    where: { id: chosenDesignId },
    data: { customerId, guestSessionId: null },
    include: { views: true },
  });
}

/** Silent single-draft adoption — only one draft exists, nothing to ask the customer. Safe to call even if already adopted. */
export async function adoptGuestDraft(designId: string, customerId: string): Promise<DesignWithViews> {
  return prisma.design.update({
    where: { id: designId },
    data: { customerId, guestSessionId: null },
    include: { views: true },
  });
}

// ─────────────────────────────────────────────────────────────
// Commerce (Stage 7) — direct save used by add-to-cart
// ─────────────────────────────────────────────────────────────

export interface SaveDesignContext {
  shopDomain: string;
  customerId: string | null;
}

/**
 * Create or update a Design and replace its DesignView rows to match
 * exactly what was submitted. A view with no canvas content (an empty
 * fabric objects array) is simply not written — "not customized" is
 * represented by the row's absence, not an empty-but-present row.
 */
export async function saveDesign(
  input: SaveDesignInput,
  ctx: SaveDesignContext,
): Promise<SavedDesign> {
  const storage = getStorageProvider();

  const usedViews = input.views.filter((view) => hasCanvasContent(view.canvasJson));

  const previewUrlByView = new Map<PrintViewName, string | null>();
  for (const view of usedViews) {
    if (!view.previewImageDataUrl) {
      previewUrlByView.set(view.viewName, null);
      continue;
    }
    const decoded = decodeDataUrl(view.previewImageDataUrl);
    if (!decoded) {
      previewUrlByView.set(view.viewName, null);
      continue;
    }
    const result = await storage.upload({
      buffer: decoded.buffer,
      fileName: `${view.viewName}-preview.${extensionForMimeType(decoded.mimeType)}`,
      mimeType: decoded.mimeType,
      folder: "previews",
    });
    previewUrlByView.set(view.viewName, result.url);
  }

  const design = await prisma.$transaction(async (tx) => {
    const existing = input.id
      ? await tx.design.findFirst({ where: { id: input.id, shopDomain: ctx.shopDomain } })
      : null;

    if (input.id && !existing) {
      throw new DesignNotFoundError(input.id);
    }
    if (existing?.customerId && existing.customerId !== ctx.customerId) {
      throw new DesignOwnershipError();
    }

    const record = existing
      ? await tx.design.update({
          where: { id: existing.id },
          data: {
            shopifyProductId: input.shopifyProductId,
            shopifyVariantId: input.shopifyVariantId,
            customerNotes: input.customerNotes,
            computedPriceCents: input.computedPriceCents,
            status: existing.status === "DRAFT" ? "SAVED" : existing.status,
          },
        })
      : await tx.design.create({
          data: {
            shopDomain: ctx.shopDomain,
            customerId: ctx.customerId,
            shopifyProductId: input.shopifyProductId,
            shopifyVariantId: input.shopifyVariantId,
            customerNotes: input.customerNotes,
            computedPriceCents: input.computedPriceCents,
            status: "SAVED",
          },
        });

    await tx.designView.deleteMany({
      where: { designId: record.id, viewName: { notIn: usedViews.map((v) => v.viewName) } },
    });

    for (const view of usedViews) {
      await tx.designView.upsert({
        where: { designId_viewName: { designId: record.id, viewName: view.viewName } },
        update: {
          canvasJson: JSON.stringify(view.canvasJson),
          previewImageUrl: previewUrlByView.get(view.viewName) ?? undefined,
        },
        create: {
          designId: record.id,
          viewName: view.viewName,
          canvasJson: JSON.stringify(view.canvasJson),
          previewImageUrl: previewUrlByView.get(view.viewName) ?? null,
        },
      });
    }

    return tx.design.findUniqueOrThrow({
      where: { id: record.id },
      include: { views: true },
    });
  });

  return serialize(design);
}

export async function getDesignForCustomer(
  id: string,
  ctx: SaveDesignContext,
): Promise<SavedDesign> {
  const design = await prisma.design.findFirst({
    where: { id, shopDomain: ctx.shopDomain },
    include: { views: true },
  });
  if (!design) throw new DesignNotFoundError(id);
  if (design.customerId && design.customerId !== ctx.customerId) {
    throw new DesignOwnershipError();
  }
  return serialize(design);
}

/**
 * Full detail (with canvasJson per view) for a design this visitor owns —
 * used by the "reopen a checkpoint" / login-conflict-resolution flows,
 * which need to rehydrate the live canvas, not just show a preview.
 * Distinct from getDesignForCustomer (which returns the lighter
 * SavedDesign DTO with no canvasJson) and from getDesignAdminDetail
 * (which skips the ownership check entirely — merchant, not customer).
 */
export async function getDesignFullForCustomer(
  id: string,
  ctx: SaveDesignContext,
): Promise<DesignState> {
  const design = await prisma.design.findFirst({
    where: { id, shopDomain: ctx.shopDomain },
    include: { views: true },
  });
  if (!design) throw new DesignNotFoundError(id);
  if (design.customerId && design.customerId !== ctx.customerId) {
    throw new DesignOwnershipError();
  }
  return serializeFull(design);
}

/** Internal lookup (no ownership check) — used by the order webhook, which authenticates via HMAC rather than a customer session. */
export async function getDesignById(id: string): Promise<DesignWithViews | null> {
  return prisma.design.findUnique({ where: { id }, include: { views: true } });
}

export async function markDesignOrdered(
  id: string,
  data: { shopifyOrderId: string; supplierOrderId?: string },
): Promise<void> {
  await prisma.design.update({
    where: { id },
    data: {
      status: "ORDERED",
      shopifyOrderId: data.shopifyOrderId,
      supplierOrderId: data.supplierOrderId,
      productionSubmittedAt: data.supplierOrderId ? new Date() : undefined,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Admin dashboard queries (Stage 8). Read-only except delete/reassign,
// shop-scoped. These are the only place the admin UI touches
// Design/DesignView beyond the customer-facing paths above.
// ─────────────────────────────────────────────────────────────

export interface ListDesignsFilters {
  shopDomain: string;
  status?: "DRAFT" | "SAVED" | "ORDERED";
  /** ORDERED with no supplierOrderId yet — the Stage 7 "needs manual follow-up" case. Takes precedence over `status` if both are set. */
  needsAttention?: boolean;
  /** Matches against design id, Shopify order id, or supplier order id. */
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DesignListItem {
  id: string;
  shopifyProductId: string;
  shopifyVariantId: string;
  customerId: string | null;
  status: Design["status"];
  computedPriceCents: number | null;
  shopifyOrderId: string | null;
  supplierOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  thumbnailUrl: string | null;
}

export async function listDesigns(
  filters: ListDesignsFilters,
): Promise<{ items: DesignListItem[]; total: number }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : 20;

  const statusFilter = filters.needsAttention
    ? { status: "ORDERED" as const, supplierOrderId: null }
    : filters.status
      ? { status: filters.status }
      : {};

  const search = filters.search?.trim();
  const searchFilter = search
    ? { OR: [{ id: search }, { shopifyOrderId: search }, { supplierOrderId: search }] }
    : {};

  const where = { shopDomain: filters.shopDomain, ...statusFilter, ...searchFilter };

  const [rows, total] = await Promise.all([
    prisma.design.findMany({
      where,
      include: { views: { select: { viewName: true, previewImageUrl: true } } },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.design.count({ where }),
  ]);

  return {
    total,
    items: rows.map((d) => ({
      id: d.id,
      shopifyProductId: d.shopifyProductId,
      shopifyVariantId: d.shopifyVariantId,
      customerId: d.customerId,
      status: d.status,
      computedPriceCents: d.computedPriceCents,
      shopifyOrderId: d.shopifyOrderId,
      supplierOrderId: d.supplierOrderId,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      viewCount: d.views.length,
      thumbnailUrl: d.views.find((v) => v.previewImageUrl)?.previewImageUrl ?? null,
    })),
  };
}

/** Full detail for the admin design-detail page — shop-scoped, unlike getDesignById (webhook use, no ownership check). */
export async function getDesignAdminDetail(
  id: string,
  shopDomain: string,
): Promise<DesignWithViews | null> {
  return prisma.design.findFirst({ where: { id, shopDomain }, include: { views: true } });
}

export interface DesignStats {
  draft: number;
  saved: number;
  ordered: number;
  needsAttention: number;
}

export async function getDesignStats(shopDomain: string): Promise<DesignStats> {
  const [draft, saved, ordered, needsAttention] = await Promise.all([
    prisma.design.count({ where: { shopDomain, status: "DRAFT" } }),
    prisma.design.count({ where: { shopDomain, status: "SAVED" } }),
    prisma.design.count({ where: { shopDomain, status: "ORDERED" } }),
    prisma.design.count({ where: { shopDomain, status: "ORDERED", supplierOrderId: null } }),
  ]);
  return { draft, saved, ordered, needsAttention };
}

/**
 * Permanently deletes a design and its views (DesignView cascades via
 * the schema's onDelete: Cascade). Also best-effort deletes each view's
 * stored files (preview image, production file) through the active
 * StorageProvider — a storage failure doesn't block the DB delete
 * itself, since an orphaned file is a much smaller problem than a
 * design a merchant explicitly asked to remove still showing up.
 * Shop-scoped: throws DesignNotFoundError rather than silently
 * no-op'ing on a cross-shop id, so the route can tell the difference
 * between "deleted" and "nothing to delete here."
 */
export async function deleteDesignAdmin(id: string, shopDomain: string): Promise<void> {
  const design = await prisma.design.findFirst({ where: { id, shopDomain }, include: { views: true } });
  if (!design) throw new DesignNotFoundError(id);

  for (const view of design.views) {
    for (const url of [view.previewImageUrl, view.productionFileUrl]) {
      if (!url) continue;
      try {
        await deleteByUrl(url);
      } catch (error) {
        console.error(`Failed to delete stored file for design ${id}, view ${view.viewName}:`, error);
      }
    }
  }

  await prisma.design.delete({ where: { id: design.id } });
}

/**
 * Reassigns a design to a different customer — e.g. correcting a wrong
 * attribution, or moving a guest-created design onto a specific
 * customer's account for support purposes. Shop-scoped for the same
 * reason as deleteDesignAdmin. Pass null to unassign (make it a
 * guest-owned design again).
 */
export async function reassignDesignCustomer(
  id: string,
  shopDomain: string,
  newCustomerId: string | null,
): Promise<void> {
  const design = await prisma.design.findFirst({ where: { id, shopDomain } });
  if (!design) throw new DesignNotFoundError(id);

  await prisma.design.update({
    where: { id: design.id },
    data: { customerId: newCustomerId },
  });
}

// ─────────────────────────────────────────────────────────────
// Serialization
// ─────────────────────────────────────────────────────────────

function hasCanvasContent(canvasJson: unknown): boolean {
  if (!canvasJson || typeof canvasJson !== "object") return false;
  const objects = (canvasJson as { objects?: unknown[] }).objects;
  return Array.isArray(objects) && objects.length > 0;
}

function serialize(design: DesignWithViews): SavedDesign {
  return {
    id: design.id,
    status: design.status,
    views: design.views.map((v) => ({
      viewName: v.viewName as PrintViewName,
      previewImageUrl: v.previewImageUrl,
    })),
  };
}

/** Full DesignState serialization, including each view's canvasJson — for draft/checkpoint hydration, never sent for the lighter admin list/detail views. */
function serializeFull(design: DesignWithViews): DesignState {
  const views = {} as DesignState["views"];
  for (const v of design.views) {
    views[v.viewName as PrintViewName] = {
      viewName: v.viewName as PrintViewName,
      canvasJson: JSON.parse(v.canvasJson),
      previewImageUrl: v.previewImageUrl,
    };
  }

  return {
    id: design.id,
    status: design.status,
    name: design.name,
    shopifyProductId: design.shopifyProductId,
    shopifyVariantId: design.shopifyVariantId,
    customerNotes: design.customerNotes ?? "",
    computedPriceCents: design.computedPriceCents,
    views,
  };
}

export function toCheckpointSummary(design: DesignWithViews): DesignCheckpointSummary {
  return {
    id: design.id,
    name: design.name,
    shopifyProductId: design.shopifyProductId,
    shopifyVariantId: design.shopifyVariantId,
    updatedAt: design.updatedAt.toISOString(),
    previewImageUrl: design.views.find((v) => v.previewImageUrl)?.previewImageUrl ?? null,
  };
}

export { serializeFull as serializeDesignState };

// ─────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────

export class DesignNotFoundError extends Error {
  constructor(id: string) {
    super(`Design "${id}" not found`);
    this.name = "DesignNotFoundError";
  }
}

export class DesignOwnershipError extends Error {
  constructor() {
    super("This design belongs to a different customer");
    this.name = "DesignOwnershipError";
  }
}
