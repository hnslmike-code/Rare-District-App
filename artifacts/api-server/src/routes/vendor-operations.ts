import { Router, type IRouter } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db, productsTable, productVariantsTable, inventoryAdjustmentTable,
  inventoryReservationTable, ordersTable, orderItemsTable, returnsTable,
  returnMessagesTable, notificationsTable, vendorsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { hasApprovedVendorAccess } from "../lib/security-boundaries";
import { recordOrderItemLedgerEntry } from "./orders";

const router: IRouter = Router();
const variantAttributes = (value: unknown): Record<string, string> =>
  value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).filter(([key, item]) => key.trim() && typeof item === "string" && item.trim()).slice(0, 12))
    : {};

async function approvedVendor(userId: number) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
  return vendor && hasApprovedVendorAccess(vendor.status) ? vendor : undefined;
}

async function ownProduct(userId: number, productId: number) {
  const vendor = await approvedVendor(userId);
  if (!vendor) return undefined;
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.vendorId, vendor.id)));
  return product ? { vendor, product } : undefined;
}

async function syncAggregateStock(productId: number, tx: any = db) {
  const [row] = await tx.select({ stock: sql<number>`coalesce(sum(${productVariantsTable.stock}), 0)` })
    .from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.isActive, true)));
  await tx.update(productsTable).set({ stock: Number(row?.stock ?? 0) }).where(eq(productsTable.id, productId));
}

router.get("/vendors/inventory/variants", requireAuth, async (req, res): Promise<void> => {
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId)) { res.status(400).json({ error: "A valid productId is required." }); return; }
  const owned = await ownProduct(req.user!.userId, productId);
  if (!owned) { res.status(403).json({ error: "Approved vendor access is required." }); return; }
  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId)).orderBy(desc(productVariantsTable.createdAt));
  res.json(variants.map(variant => ({ ...variant, priceAdjustment: Number(variant.priceAdjustment), availableStock: variant.stock - variant.reservedStock })));
});

router.post("/vendors/inventory/variants", requireAuth, async (req, res): Promise<void> => {
  const productId = Number(req.body?.productId);
  const owned = await ownProduct(req.user!.userId, productId);
  const attributes = variantAttributes(req.body?.attributes);
  const sku = typeof req.body?.sku === "string" && req.body.sku.trim()
    ? req.body.sku.trim().slice(0, 80)
    : `RD-${productId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const stock = Number(req.body?.stock ?? 0);
  const priceAdjustment = Number(req.body?.priceAdjustment ?? 0);
  if (!owned || !Number.isInteger(stock) || stock < 0 || !Number.isFinite(priceAdjustment) || Object.keys(attributes).length === 0) {
    res.status(400).json({ error: "Product, attributes, stock, and price adjustment are required." }); return;
  }
  try {
    const variant = await db.transaction(async tx => {
      const [created] = await tx.insert(productVariantsTable).values({
        productId, sku, attributes, stock, priceAdjustment: String(priceAdjustment),
        lowStockThreshold: Number.isInteger(req.body?.lowStockThreshold) ? Math.max(0, Number(req.body.lowStockThreshold)) : 2,
      }).returning();
      await tx.insert(inventoryAdjustmentTable).values({
        vendorId: owned.vendor.id, productId, variantId: created.id, quantityChange: stock,
        reason: "initial_stock", note: "Variant created", createdBy: req.user!.userId,
      });
      await syncAggregateStock(productId, tx);
      return created;
    });
    res.status(201).json({ ...variant, priceAdjustment: Number(variant.priceAdjustment), availableStock: variant.stock });
  } catch (error) {
    if (String(error).includes("product_variants_product_sku_unique")) { res.status(409).json({ error: "That SKU already exists for this product." }); return; }
    throw error;
  }
});

router.patch("/vendors/inventory/variants/:id", requireAuth, async (req, res): Promise<void> => {
  const variantId = Number(req.params.id);
  const [variant] = await db.select().from(productVariantsTable).where(eq(productVariantsTable.id, variantId));
  const owned = variant ? await ownProduct(req.user!.userId, variant.productId) : undefined;
  if (!variant || !owned) { res.status(404).json({ error: "Variant not found." }); return; }
  const nextStock = req.body?.stock === undefined ? variant.stock : Number(req.body.stock);
  const adjustment = nextStock - variant.stock;
  if (!Number.isInteger(nextStock) || nextStock < variant.reservedStock) { res.status(400).json({ error: "Stock cannot be below reserved stock." }); return; }
  const updated = await db.transaction(async tx => {
    const [next] = await tx.update(productVariantsTable).set({
      sku: typeof req.body?.sku === "string" ? req.body.sku.trim().slice(0, 80) : variant.sku,
      attributes: req.body?.attributes ? variantAttributes(req.body.attributes) : variant.attributes,
      priceAdjustment: req.body?.priceAdjustment === undefined ? variant.priceAdjustment : String(Number(req.body.priceAdjustment)),
      stock: nextStock,
      lowStockThreshold: req.body?.lowStockThreshold === undefined ? variant.lowStockThreshold : Math.max(0, Number(req.body.lowStockThreshold)),
      isActive: req.body?.isActive === undefined ? variant.isActive : Boolean(req.body.isActive),
    }).where(eq(productVariantsTable.id, variantId)).returning();
    if (adjustment !== 0) await tx.insert(inventoryAdjustmentTable).values({
      vendorId: owned.vendor.id, productId: variant.productId, variantId, quantityChange: adjustment,
      reason: typeof req.body?.reason === "string" ? req.body.reason.slice(0, 80) : "manual_adjustment",
      note: typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null, createdBy: req.user!.userId,
    });
    await syncAggregateStock(variant.productId, tx);
    return next;
  });
  res.json({ ...updated, priceAdjustment: Number(updated.priceAdjustment), availableStock: updated.stock - updated.reservedStock });
});

router.get("/vendors/inventory/adjustments", requireAuth, async (req, res): Promise<void> => {
  const vendor = await approvedVendor(req.user!.userId);
  if (!vendor) { res.status(403).json({ error: "Approved vendor access is required." }); return; }
  const rows = await db.select().from(inventoryAdjustmentTable).where(eq(inventoryAdjustmentTable.vendorId, vendor.id)).orderBy(desc(inventoryAdjustmentTable.createdAt)).limit(200);
  res.json(rows);
});

router.post("/returns", requireAuth, async (req, res): Promise<void> => {
  const orderId = Number(req.body?.orderId);
  const orderItemId = Number(req.body?.orderItemId);
  const reason = req.body?.reason;
  if (!Number.isInteger(orderId) || !Number.isInteger(orderItemId) || !["wrong_item", "damaged"].includes(reason)) {
    res.status(400).json({ error: "Order item and an eligible return reason are required." }); return;
  }
  const [item] = await db.select().from(orderItemsTable).where(and(eq(orderItemsTable.id, orderItemId), eq(orderItemsTable.orderId, orderId)));
  const [order] = await db.select().from(ordersTable).where(and(eq(ordersTable.id, orderId), eq(ordersTable.userId, req.user!.userId)));
  if (!item || !order || !["delivered", "shipped"].includes(order.status)) { res.status(404).json({ error: "Eligible order item not found." }); return; }
  const [existing] = await db.select().from(returnsTable).where(and(eq(returnsTable.orderItemId, item.id), sql`${returnsTable.status} NOT IN ('rejected', 'cancelled', 'refunded')`));
  if (existing) { res.status(409).json({ error: "A return is already active for this item." }); return; }
  const requestedAt = new Date();
  const responseDeadline = new Date(requestedAt.getTime() + 48 * 60 * 60 * 1000);
  const [created] = await db.insert(returnsTable).values({
    orderId, orderItemId, customerId: req.user!.userId, vendorId: item.vendorId, reason,
    description: typeof req.body?.description === "string" ? req.body.description.slice(0, 2000) : null,
    refundAmount: String(parseFloat(item.unitPrice) * item.quantity), requestedAt, responseDeadline,
  }).returning();
  res.status(201).json(created);
});

router.get("/returns/mine", requireAuth, async (req, res): Promise<void> => {
  const rows = await db.select().from(returnsTable).where(eq(returnsTable.customerId, req.user!.userId)).orderBy(desc(returnsTable.requestedAt)).limit(100);
  res.json(rows);
});

router.get("/vendors/returns", requireAuth, async (req, res): Promise<void> => {
  const vendor = await approvedVendor(req.user!.userId);
  if (!vendor) { res.status(403).json({ error: "Approved vendor access is required." }); return; }
  const rows = await db.select().from(returnsTable).where(eq(returnsTable.vendorId, vendor.id)).orderBy(desc(returnsTable.requestedAt)).limit(100);
  res.json(rows);
});

router.patch("/vendors/returns/:id", requireAuth, async (req, res): Promise<void> => {
  const vendor = await approvedVendor(req.user!.userId);
  const returnId = Number(req.params.id);
  const nextStatus = req.body?.status;
  if (!vendor || !["approved", "rejected", "received", "inspected"].includes(nextStatus)) { res.status(400).json({ error: "Invalid return update." }); return; }
  const [request] = await db.select().from(returnsTable).where(and(eq(returnsTable.id, returnId), eq(returnsTable.vendorId, vendor.id)));
  if (!request) { res.status(404).json({ error: "Return request not found." }); return; }
  const transitions: Record<string, string[]> = { requested: ["approved", "rejected"], approved: ["received"], received: ["inspected"], inspected: [], rejected: [], refunded: [], disputed: [] };
  if (!transitions[request.status]?.includes(nextStatus)) { res.status(409).json({ error: `Cannot move return from ${request.status} to ${nextStatus}.` }); return; }
  const updated = await db.transaction(async tx => {
    let nextStock = false;
    if (nextStatus === "inspected") nextStock = Boolean(req.body?.resalable);
    const [next] = await tx.update(returnsTable).set({
      status: nextStatus,
      approvedAt: nextStatus === "approved" ? new Date() : request.approvedAt,
      rejectedAt: nextStatus === "rejected" ? new Date() : null,
      receivedAt: nextStatus === "received" ? new Date() : request.receivedAt,
      inspectedAt: nextStatus === "inspected" ? new Date() : request.inspectedAt,
      shippingDecision: ["vendor", "customer", "shared", "undecided"].includes(req.body?.shippingDecision) ? req.body.shippingDecision : request.shippingDecision,
      shippingInstructions: typeof req.body?.shippingInstructions === "string" ? req.body.shippingInstructions.slice(0, 1000) : request.shippingInstructions,
      resolutionNote: typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.slice(0, 1000) : request.resolutionNote,
    }).where(eq(returnsTable.id, returnId)).returning();
    if (nextStock) {
      const [returnedItem] = await tx.select({ productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
        .from(orderItemsTable).where(eq(orderItemsTable.id, request.orderItemId));
      if (returnedItem) {
        await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${returnedItem.quantity}` })
          .where(eq(productsTable.id, returnedItem.productId));
      }
    }
    return next;
  });
  res.json(updated);
});

// POST /returns/:id/refund — customer or admin finalizes an inspected return.
router.post("/returns/:id/refund", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  if (!request || (request.customerId !== req.user!.userId && req.user!.role !== "admin")) {
    res.status(404).json({ error: "Return not found." });
    return;
  }
  if (request.status !== "inspected") {
    res.status(409).json({ error: "A return must be inspected before it can be refunded." });
    return;
  }
  const updated = await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM returns WHERE id = ${returnId} FOR UPDATE`);
    const [locked] = await tx.select().from(returnsTable).where(eq(returnsTable.id, returnId));
    if (!locked || locked.status !== "inspected") throw new Error("RETURN_NOT_READY");
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, locked.orderId));
    const [item] = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.id, locked.orderItemId));
    if (!order || !item) throw new Error("RETURN_NOT_FOUND");
    await recordOrderItemLedgerEntry(tx, order, item, "refund");
    await tx.update(orderItemsTable).set({ fulfillmentStatus: "refunded" }).where(eq(orderItemsTable.id, item.id));
    const [next] = await tx.update(returnsTable).set({ status: "refunded", refundedAt: new Date() }).where(eq(returnsTable.id, returnId)).returning();
    return next;
  }).catch(error => {
    if (error instanceof Error && error.message === "RETURN_NOT_READY") return undefined;
    throw error;
  });
  if (!updated) { res.status(409).json({ error: "Return is no longer ready for refund." }); return; }
  res.json(updated);
});

router.get("/returns/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  const messageVendor = await approvedVendor(req.user!.userId);
  if (!request || (request.customerId !== req.user!.userId && messageVendor?.id !== request.vendorId)) { res.status(404).json({ error: "Return not found." }); return; }
  res.json(await db.select().from(returnMessagesTable).where(eq(returnMessagesTable.returnId, returnId)).orderBy(returnMessagesTable.createdAt));
});

router.post("/returns/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  const vendor = await approvedVendor(req.user!.userId);
  if (!request || (request.customerId !== req.user!.userId && vendor?.id !== request.vendorId)) { res.status(404).json({ error: "Return not found." }); return; }
  const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 2000) : "";
  if (!body) { res.status(400).json({ error: "Message is required." }); return; }
  const [message] = await db.insert(returnMessagesTable).values({ returnId, senderId: req.user!.userId, body }).returning();
  res.status(201).json(message);
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  res.json(await db.select().from(notificationsTable).where(eq(notificationsTable.userId, req.user!.userId)).orderBy(desc(notificationsTable.createdAt)).limit(100));
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const [notification] = await db.update(notificationsTable).set({ readAt: new Date() }).where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.userId, req.user!.userId))).returning();
  if (!notification) { res.status(404).json({ error: "Notification not found." }); return; }
  res.json(notification);
});

export default router;