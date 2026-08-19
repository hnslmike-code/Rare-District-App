import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  db, productsTable, productVariantsTable, inventoryAdjustmentTable,
  inventoryReservationTable, ordersTable, orderItemsTable, returnsTable,
  returnMessagesTable, returnShippingProposalsTable, returnAuditEventsTable,
  notificationsTable, vendorsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { hasApprovedVendorAccess } from "../lib/security-boundaries";
import { recordOrderItemLedgerEntry } from "./orders";
import { createVendorAlert } from "../lib/vendor-notifications";

const router: IRouter = Router();
const variantAttributes = (value: unknown): Record<string, string> =>
  value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).filter(([key, item]) => key.trim() && typeof item === "string" && item.trim()).slice(0, 12))
    : {};

async function approvedVendor(userId: number) {
  const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.userId, userId));
  return vendor && hasApprovedVendorAccess(vendor.status) ? vendor : undefined;
}

async function returnParticipantRole(userId: number, request: typeof returnsTable.$inferSelect) {
  if (request.customerId === userId) return "customer" as const;
  const vendor = await approvedVendor(userId);
  return vendor?.id === request.vendorId ? "vendor" as const : undefined;
}

async function notifyReturnParticipant(
  tx: any,
  userId: number,
  title: string,
  body: string,
  href: string,
) {
  await tx.insert(notificationsTable).values({
    userId,
    type: "return",
    title,
    body,
    href,
  });
}

function parseShippingProposal(value: unknown) {
  const source = value as Record<string, unknown> | undefined;
  const payer = source?.payer;
  const rawAmount = typeof source?.amount === "number" || typeof source?.amount === "string" ? String(source.amount).trim() : "";
  const instructions = typeof source?.instructions === "string" ? source.instructions.trim().slice(0, 1000) : "";
  const note = typeof source?.note === "string" ? source.note.trim().slice(0, 1000) : "";
  if (!["vendor", "customer", "shared"].includes(String(payer)) || !/^\d+(?:\.\d{1,2})?$/.test(rawAmount)) {
    return undefined;
  }
  const amountInKobo = Math.round(Number(rawAmount) * 100);
  if (!Number.isSafeInteger(amountInKobo) || amountInKobo < 0 || amountInKobo > 500_000_000) return undefined;
  return {
    payer: payer as "vendor" | "customer" | "shared",
    amount: (amountInKobo / 100).toFixed(2),
    instructions: instructions || null,
    note: note || null,
  };
}

async function ownProduct(userId: number, productId: number) {
  const vendor = await approvedVendor(userId);
  if (!vendor) return undefined;
  const [product] = await db.select().from(productsTable).where(and(eq(productsTable.id, productId), eq(productsTable.vendorId, vendor.id)));
  return product ? { vendor, product } : undefined;
}

async function syncAggregateStock(productId: number, tx: any = db) {
  await tx.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`);
  const [row] = await tx.select({ stock: sql<number>`coalesce(sum(${productVariantsTable.stock}), 0)` })
    .from(productVariantsTable).where(and(eq(productVariantsTable.productId, productId), eq(productVariantsTable.isActive, true)));
  await tx.update(productsTable).set({ stock: Number(row?.stock ?? 0) }).where(eq(productsTable.id, productId));
}

const formatVariant = (variant: typeof productVariantsTable.$inferSelect) => ({
  ...variant,
  priceAdjustment: Number(variant.priceAdjustment),
  availableStock: variant.stock - variant.reservedStock,
});

type BulkStockUpdate = { variantId: number; stock: number; reason?: string; note?: string };

class BulkStockUpdateError extends Error {
  constructor(message: string, readonly details?: string[]) {
    super(message);
  }
}

function parseBulkStockUpdates(value: unknown): BulkStockUpdate[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new BulkStockUpdateError("Choose between 1 and 100 variants to update.");
  }
  const seen = new Set<number>();
  return value.map((entry, index) => {
    const variantId = Number((entry as Record<string, unknown>)?.variantId);
    const stock = Number((entry as Record<string, unknown>)?.stock);
    if (!Number.isInteger(variantId) || variantId < 1 || !Number.isInteger(stock) || stock < 0 || stock > 1_000_000 || seen.has(variantId)) {
      throw new BulkStockUpdateError(`Row ${index + 1} has an invalid or duplicate variant and stock value.`);
    }
    seen.add(variantId);
    const rawReason = (entry as Record<string, unknown>).reason;
    const rawNote = (entry as Record<string, unknown>).note;
    const reason = typeof rawReason === "string"
      ? rawReason.trim().slice(0, 80)
      : undefined;
    const note = typeof rawNote === "string"
      ? rawNote.trim().slice(0, 500)
      : undefined;
    return { variantId, stock, reason, note };
  });
}

async function applyBulkStockUpdate(
  vendor: Awaited<ReturnType<typeof approvedVendor>>,
  userId: number,
  updates: BulkStockUpdate[],
) {
  if (!vendor) throw new BulkStockUpdateError("Approved vendor access is required.");
  const updateById = new Map(updates.map(update => [update.variantId, update]));
  const variantIds = [...updateById.keys()].sort((left, right) => left - right);

  return db.transaction(async tx => {
    for (const variantId of variantIds) {
      await tx.execute(sql`SELECT id FROM product_variants WHERE id = ${variantId} FOR UPDATE`);
    }

    const rows = await tx.select({
      variant: productVariantsTable,
      product: productsTable,
    }).from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .where(inArray(productVariantsTable.id, variantIds));

    if (rows.length !== updates.length || rows.some(row => row.product.vendorId !== vendor.id)) {
      throw new BulkStockUpdateError("Every selected variant must belong to your catalog.");
    }

    const protectedRows = rows.filter(row => updateById.get(row.variant.id)!.stock < row.variant.reservedStock);
    if (protectedRows.length) {
      throw new BulkStockUpdateError(
        "Stock cannot be below reserved stock.",
        protectedRows.map(row => `${row.variant.sku} has ${row.variant.reservedStock} reserved.`),
      );
    }

    const affectedProducts = new Set<number>();
    const updatedVariants: Array<typeof productVariantsTable.$inferSelect> = [];
    for (const row of rows) {
      const update = updateById.get(row.variant.id)!;
      const adjustment = update.stock - row.variant.stock;
      if (adjustment === 0) {
        updatedVariants.push(row.variant);
        continue;
      }
      const [updated] = await tx.update(productVariantsTable)
        .set({ stock: update.stock })
        .where(eq(productVariantsTable.id, row.variant.id))
        .returning();
      await tx.insert(inventoryAdjustmentTable).values({
        vendorId: vendor.id,
        productId: row.variant.productId,
        variantId: row.variant.id,
        quantityChange: adjustment,
        reason: update.reason || "bulk_update",
        note: update.note || "Bulk inventory update",
        createdBy: userId,
      });
      const previousAvailable = row.variant.stock - row.variant.reservedStock;
      const available = updated.stock - updated.reservedStock;
      if (previousAvailable > updated.lowStockThreshold && available <= updated.lowStockThreshold) {
        await createVendorAlert(tx, vendor, {
          type: "inventory",
          title: `${updated.sku} needs attention`,
          body: available <= 0
            ? "This variant is out of available stock."
            : `Only ${available} unit${available === 1 ? "" : "s"} remain available.`,
          href: "/vendor-dashboard/inventory",
        });
      }
      affectedProducts.add(row.variant.productId);
      updatedVariants.push(updated);
    }

    for (const productId of [...affectedProducts].sort((left, right) => left - right)) await syncAggregateStock(productId, tx);
    return updatedVariants.map(formatVariant);
  });
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsvRows(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell); cell = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }
  if (quoted) throw new BulkStockUpdateError("The CSV has an unclosed quoted value.");
  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function updatesFromCsv(source: unknown) {
  if (typeof source !== "string" || source.length === 0 || source.length > 250_000) {
    throw new BulkStockUpdateError("Upload a CSV file no larger than 250 KB.");
  }
  const rows = parseCsvRows(source);
  if (rows.length < 2) throw new BulkStockUpdateError("The CSV needs a header and at least one inventory row.");
  const header = rows[0].map(value => value.trim().toLowerCase().replace(/[\s_-]/g, ""));
  const variantIdIndex = header.indexOf("variantid");
  const stockIndex = header.indexOf("stock");
  if (variantIdIndex < 0 || stockIndex < 0) {
    throw new BulkStockUpdateError("The CSV must include Variant ID and Stock columns.");
  }
  const details: string[] = [];
  const updates = rows.slice(1).map((row, index) => {
    const rawVariantId = row[variantIdIndex]?.trim() ?? "";
    const rawStock = row[stockIndex]?.trim() ?? "";
    const variantId = Number(rawVariantId);
    const stock = Number(rawStock);
    if (!/^\d+$/.test(rawVariantId) || !/^\d+$/.test(rawStock) || !Number.isInteger(variantId) || !Number.isInteger(stock) || stock < 0) details.push(`Row ${index + 2} needs a whole-number Variant ID and Stock.`);
    return { variantId, stock, reason: "csv_import", note: "CSV inventory import" };
  });
  if (details.length) throw new BulkStockUpdateError("Fix the highlighted CSV rows and try again.", details.slice(0, 10));
  return parseBulkStockUpdates(updates);
}

router.get("/vendors/inventory/variants", requireAuth, async (req, res): Promise<void> => {
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId)) { res.status(400).json({ error: "A valid productId is required." }); return; }
  const owned = await ownProduct(req.user!.userId, productId);
  if (!owned) { res.status(403).json({ error: "Approved vendor access is required." }); return; }
  const variants = await db.select().from(productVariantsTable).where(eq(productVariantsTable.productId, productId)).orderBy(desc(productVariantsTable.createdAt));
  res.json(variants.map(formatVariant));
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
    res.status(201).json(formatVariant(variant));
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
    const previousAvailable = variant.stock - variant.reservedStock;
    const available = next.stock - next.reservedStock;
    if (previousAvailable > next.lowStockThreshold && available <= next.lowStockThreshold) {
      await createVendorAlert(tx, owned.vendor, {
        type: "inventory",
        title: `${next.sku} needs attention`,
        body: available <= 0
          ? "This variant is out of available stock."
          : `Only ${available} unit${available === 1 ? "" : "s"} remain available.`,
        href: "/vendor-dashboard/inventory",
      });
    }
    return next;
  });
  res.json(formatVariant(updated));
});

router.post("/vendors/inventory/variants/bulk-stock", requireAuth, async (req, res): Promise<void> => {
  try {
    const vendor = await approvedVendor(req.user!.userId);
    const updated = await applyBulkStockUpdate(vendor, req.user!.userId, parseBulkStockUpdates(req.body?.updates));
    res.json({ updated, count: updated.length });
  } catch (error) {
    if (error instanceof BulkStockUpdateError) {
      res.status(400).json({ error: error.message, details: error.details });
      return;
    }
    throw error;
  }
});

router.post("/vendors/inventory/variants/import", requireAuth, async (req, res): Promise<void> => {
  try {
    const vendor = await approvedVendor(req.user!.userId);
    const updated = await applyBulkStockUpdate(vendor, req.user!.userId, updatesFromCsv(req.body?.csv));
    res.json({ updated, count: updated.length });
  } catch (error) {
    if (error instanceof BulkStockUpdateError) {
      res.status(400).json({ error: error.message, details: error.details });
      return;
    }
    throw error;
  }
});

router.get("/vendors/inventory/variants/export", requireAuth, async (req, res): Promise<void> => {
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId)) { res.status(400).json({ error: "A valid productId is required." }); return; }
  const owned = await ownProduct(req.user!.userId, productId);
  if (!owned) { res.status(403).json({ error: "Approved vendor access is required." }); return; }
  const variants = await db.select().from(productVariantsTable)
    .where(eq(productVariantsTable.productId, productId))
    .orderBy(desc(productVariantsTable.createdAt));
  const rows = [
    ["Variant ID", "Product ID", "SKU", "Attributes", "Stock", "Reserved Stock", "Available Stock", "Low Stock Threshold", "Price Adjustment"],
    ...variants.map(variant => [
      variant.id,
      variant.productId,
      variant.sku,
      Object.entries(variant.attributes).map(([key, value]) => `${key}=${value}`).join("; "),
      variant.stock,
      variant.reservedStock,
      variant.stock - variant.reservedStock,
      variant.lowStockThreshold,
      Number(variant.priceAdjustment),
    ]),
  ];
  res
    .setHeader("Content-Type", "text/csv; charset=utf-8")
    .setHeader("Content-Disposition", `attachment; filename="rare-district-variants-${productId}.csv"`)
    .send(rows.map(row => row.map(csvCell).join(",")).join("\n"));
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
  const created = await db.transaction(async tx => {
    const [request] = await tx.insert(returnsTable).values({
      orderId, orderItemId, customerId: req.user!.userId, vendorId: item.vendorId, reason,
      description: typeof req.body?.description === "string" ? req.body.description.slice(0, 2000) : null,
      refundAmount: String(parseFloat(item.unitPrice) * item.quantity), requestedAt, responseDeadline,
    }).returning();
    await tx.insert(returnAuditEventsTable).values({
      returnId: request.id, actorId: req.user!.userId, action: "return_requested",
      details: { reason, responseDeadline: responseDeadline.toISOString() },
    });
    const [vendor] = await tx.select().from(vendorsTable).where(eq(vendorsTable.id, item.vendorId));
    if (vendor) await createVendorAlert(tx, vendor, {
      type: "return",
      title: "New return request",
      body: `Order #${order.id} has a ${reason.replace("_", " ")} return request awaiting your response.`,
      href: "/vendor-dashboard/returns",
    });
    return request;
  });
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
  const transitions: Record<string, string[]> = { requested: ["approved", "rejected"], approved: ["received"], received: ["inspected"], inspected: [], rejected: [], refunded: [], disputed: [] };
  let updated: typeof returnsTable.$inferSelect | undefined;
  try {
    updated = await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM returns WHERE id = ${returnId} FOR UPDATE`);
    const [request] = await tx.select().from(returnsTable).where(and(eq(returnsTable.id, returnId), eq(returnsTable.vendorId, vendor.id)));
    if (!request) throw new Error("RETURN_NOT_FOUND");
    if (!transitions[request.status]?.includes(nextStatus)) throw new Error("INVALID_TRANSITION");
    if (nextStatus === "approved" && (!request.shippingAgreementProposalId || request.shippingDecision === "undecided")) throw new Error("SHIPPING_NOT_AGREED");
    if (nextStatus === "inspected") {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${request.orderId} FOR UPDATE`);
      await tx.execute(sql`SELECT id FROM order_items WHERE id = ${request.orderItemId} FOR UPDATE`);
    }
    const nextStock = nextStatus === "inspected" && Boolean(req.body?.resalable);
    const [next] = await tx.update(returnsTable).set({
      status: nextStatus,
      approvedAt: nextStatus === "approved" ? new Date() : request.approvedAt,
      rejectedAt: nextStatus === "rejected" ? new Date() : null,
      receivedAt: nextStatus === "received" ? new Date() : request.receivedAt,
      inspectedAt: nextStatus === "inspected" ? new Date() : request.inspectedAt,
      resolutionNote: typeof req.body?.resolutionNote === "string" ? req.body.resolutionNote.slice(0, 1000) : request.resolutionNote,
    }).where(eq(returnsTable.id, returnId)).returning();
    await tx.insert(returnAuditEventsTable).values({
      returnId, actorId: req.user!.userId, action: `return_${nextStatus}`,
      details: { resalable: nextStatus === "inspected" ? nextStock : undefined, shippingAgreementProposalId: next.shippingAgreementProposalId },
    });
    if (nextStock) {
      const [returnedItem] = await tx.select({ productId: orderItemsTable.productId, quantity: orderItemsTable.quantity })
        .from(orderItemsTable).where(eq(orderItemsTable.id, request.orderItemId));
      if (returnedItem) await tx.update(productsTable)
        .set({ stock: sql`${productsTable.stock} + ${returnedItem.quantity}` })
        .where(eq(productsTable.id, returnedItem.productId));
    }
    await notifyReturnParticipant(
      tx, request.customerId,
      nextStatus === "approved" ? "Return approved" : `Return ${nextStatus.replace("_", " ")}`,
      nextStatus === "approved" ? "Your return has been approved. Follow the agreed shipping instructions." : `Your return is now marked ${nextStatus.replace("_", " ")}.`,
      `/orders/${request.orderId}`,
    );
      return next;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RETURN_NOT_FOUND") { res.status(404).json({ error: "Return request not found." }); return; }
    if (error instanceof Error && error.message === "INVALID_TRANSITION") { res.status(409).json({ error: "Cannot move this return from its current status." }); return; }
    if (error instanceof Error && error.message === "SHIPPING_NOT_AGREED") { res.status(409).json({ error: "Agree on return shipping before approving this return." }); return; }
    throw error;
  }
  if (!updated) { res.status(404).json({ error: "Return request not found." }); return; }
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
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${locked.orderId} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM order_items WHERE id = ${locked.orderItemId} FOR UPDATE`);
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, locked.orderId));
    const [item] = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.id, locked.orderItemId));
    if (!order || !item) throw new Error("RETURN_NOT_FOUND");
    await recordOrderItemLedgerEntry(tx, order, item, "refund");
    await tx.update(orderItemsTable).set({ fulfillmentStatus: "refunded" }).where(eq(orderItemsTable.id, item.id));
    const [next] = await tx.update(returnsTable).set({ status: "refunded", refundedAt: new Date() }).where(eq(returnsTable.id, returnId)).returning();
    await tx.insert(returnAuditEventsTable).values({
      returnId, actorId: req.user!.userId, action: "return_refunded",
      details: { refundAmount: next.refundAmount, orderItemId: item.id },
    });
    const [vendor] = await tx.select().from(vendorsTable).where(eq(vendorsTable.id, locked.vendorId));
    if (req.user!.userId === locked.customerId) {
      if (vendor) await notifyReturnParticipant(tx, vendor.userId, "Return refunded", "A customer finalized the refund for an inspected return.", "/vendor-dashboard/returns");
    } else {
      await notifyReturnParticipant(tx, locked.customerId, "Return refunded", "Your inspected return has been finalized for refund.", `/orders/${locked.orderId}`);
      if (vendor) await notifyReturnParticipant(tx, vendor.userId, "Return refunded", "An inspected return has been finalized for refund.", "/vendor-dashboard/returns");
    }
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

// A single negotiated view keeps the customer and vendor looking at the same
// messages, shipping proposals, and immutable event history.
router.get("/returns/:id/conversation", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  if (!request || !await returnParticipantRole(req.user!.userId, request)) { res.status(404).json({ error: "Return not found." }); return; }
  const [messages, proposals, audit] = await Promise.all([
    db.select().from(returnMessagesTable).where(eq(returnMessagesTable.returnId, returnId)).orderBy(returnMessagesTable.createdAt),
    db.select().from(returnShippingProposalsTable).where(eq(returnShippingProposalsTable.returnId, returnId)).orderBy(desc(returnShippingProposalsTable.createdAt)),
    db.select().from(returnAuditEventsTable).where(eq(returnAuditEventsTable.returnId, returnId)).orderBy(returnAuditEventsTable.createdAt),
  ]);
  res.json({ request, messages, proposals, audit });
});

router.post("/returns/:id/shipping-proposals", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const proposal = parseShippingProposal(req.body);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  const role = request && await returnParticipantRole(req.user!.userId, request);
  if (!request || !role) { res.status(404).json({ error: "Return not found." }); return; }
  if (!proposal) { res.status(400).json({ error: "Choose who pays and enter a valid shipping amount." }); return; }
  let created: typeof returnShippingProposalsTable.$inferSelect | undefined;
  try {
    created = await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM returns WHERE id = ${returnId} FOR UPDATE`);
    const [locked] = await tx.select().from(returnsTable).where(eq(returnsTable.id, returnId));
    if (!locked || locked.status !== "requested") throw new Error("SHIPPING_CLOSED");
    if (locked.shippingAgreementProposalId || locked.shippingDecision !== "undecided") throw new Error("SHIPPING_AGREED");
    await tx.update(returnShippingProposalsTable).set({ status: "countered", respondedBy: req.user!.userId, respondedAt: new Date() })
      .where(and(eq(returnShippingProposalsTable.returnId, returnId), eq(returnShippingProposalsTable.status, "proposed")));
    const [next] = await tx.insert(returnShippingProposalsTable).values({
      returnId, proposedBy: req.user!.userId, payer: proposal.payer, amount: proposal.amount,
      instructions: proposal.instructions, note: proposal.note,
    }).returning();
    await tx.insert(returnAuditEventsTable).values({
      returnId, actorId: req.user!.userId, action: "shipping_proposed",
      details: { payer: proposal.payer, amount: proposal.amount, instructions: proposal.instructions },
    });
    const destination = role === "vendor" ? locked.customerId : (await tx.select().from(vendorsTable).where(eq(vendorsTable.id, locked.vendorId)))[0]?.userId;
    if (destination) await notifyReturnParticipant(tx, destination, "Return shipping proposal", "A shipping-cost proposal needs your response.", role === "vendor" ? `/orders/${locked.orderId}` : "/vendor-dashboard/returns");
    return next;
    });
  } catch (error) {
    if (error instanceof Error && ["SHIPPING_CLOSED", "SHIPPING_AGREED"].includes(error.message)) { res.status(409).json({ error: "Return shipping terms have already been settled or this return is no longer awaiting approval." }); return; }
    throw error;
  }
  res.status(201).json(created);
});

router.post("/returns/:id/shipping-proposals/:proposalId/respond", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const proposalId = Number(req.params.proposalId);
  const action = req.body?.action;
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  const role = request && await returnParticipantRole(req.user!.userId, request);
  if (!request || !role) { res.status(404).json({ error: "Return not found." }); return; }
  if (!["accept", "decline", "counter"].includes(action)) { res.status(400).json({ error: "Choose accept, decline, or counter." }); return; }
  const counter = action === "counter" ? parseShippingProposal(req.body) : undefined;
  if (action === "counter" && !counter) { res.status(400).json({ error: "Your counter-proposal needs a payer and valid amount." }); return; }
  let result: { proposal: typeof returnShippingProposalsTable.$inferSelect; shippingDecision: string } | undefined;
  try {
    result = await db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM returns WHERE id = ${returnId} FOR UPDATE`);
    const [lockedRequest] = await tx.select().from(returnsTable).where(eq(returnsTable.id, returnId));
    if (!lockedRequest || lockedRequest.status !== "requested" || lockedRequest.shippingAgreementProposalId || lockedRequest.shippingDecision !== "undecided") throw new Error("SHIPPING_CLOSED");
    const [current] = await tx.select().from(returnShippingProposalsTable).where(and(
      eq(returnShippingProposalsTable.id, proposalId),
      eq(returnShippingProposalsTable.returnId, returnId),
    ));
    if (!current || current.status !== "proposed" || current.proposedBy === req.user!.userId) throw new Error("PROPOSAL_UNAVAILABLE");
    const status = action === "accept" ? "accepted" : action === "decline" ? "declined" : "countered";
    await tx.update(returnShippingProposalsTable).set({ status, respondedBy: req.user!.userId, respondedAt: new Date() })
      .where(eq(returnShippingProposalsTable.id, proposalId));
    let nextProposal: typeof returnShippingProposalsTable.$inferSelect | undefined;
    if (action === "accept") {
      await tx.update(returnsTable).set({
        shippingDecision: current.payer,
        shippingInstructions: current.instructions,
        shippingAgreementProposalId: current.id,
      }).where(eq(returnsTable.id, returnId));
    }
    if (action === "counter" && counter) {
      [nextProposal] = await tx.insert(returnShippingProposalsTable).values({
        returnId, parentProposalId: proposalId, proposedBy: req.user!.userId, payer: counter.payer,
        amount: counter.amount, instructions: counter.instructions, note: counter.note,
      }).returning();
    }
    await tx.insert(returnAuditEventsTable).values({
      returnId, actorId: req.user!.userId, action: `shipping_${action === "accept" ? "agreed" : action}`,
      details: action === "accept"
        ? { payer: current.payer, amount: current.amount, instructions: current.instructions }
        : action === "counter" && counter ? { payer: counter.payer, amount: counter.amount, parentProposalId: proposalId }
        : { proposalId },
    });
    if (current.proposedBy !== req.user!.userId) await notifyReturnParticipant(
      tx, current.proposedBy,
      action === "accept" ? "Return shipping agreed" : action === "counter" ? "Return shipping counter-proposal" : "Return shipping proposal declined",
      action === "accept" ? "Shipping terms are agreed. The vendor can now approve the return." : "Review the latest shipping terms in your return conversation.",
      role === "vendor" ? `/orders/${lockedRequest.orderId}` : "/vendor-dashboard/returns",
    );
    return { proposal: nextProposal ?? { ...current, status }, shippingDecision: action === "accept" ? current.payer : lockedRequest.shippingDecision };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SHIPPING_CLOSED") { res.status(409).json({ error: "Return shipping terms are already settled or this return is no longer awaiting approval." }); return; }
    if (error instanceof Error && error.message === "PROPOSAL_UNAVAILABLE") { res.status(409).json({ error: "This proposal is no longer available to respond to." }); return; }
    throw error;
  }
  res.json(result);
});

router.post("/returns/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const returnId = Number(req.params.id);
  const [request] = await db.select().from(returnsTable).where(eq(returnsTable.id, returnId));
  const vendor = await approvedVendor(req.user!.userId);
  if (!request || (request.customerId !== req.user!.userId && vendor?.id !== request.vendorId)) { res.status(404).json({ error: "Return not found." }); return; }
  const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 2000) : "";
  if (!body) { res.status(400).json({ error: "Message is required." }); return; }
  const [message] = await db.transaction(async tx => {
    const [created] = await tx.insert(returnMessagesTable).values({ returnId, senderId: req.user!.userId, body }).returning();
    await tx.insert(returnAuditEventsTable).values({ returnId, actorId: req.user!.userId, action: "message_sent", details: {} });
    const role = await returnParticipantRole(req.user!.userId, request);
    const destination = role === "vendor" ? request.customerId : (await tx.select().from(vendorsTable).where(eq(vendorsTable.id, request.vendorId)))[0]?.userId;
    if (destination) await notifyReturnParticipant(
      tx, destination, "New return message", "You have a new message about an active return.",
      role === "vendor" ? `/orders/${request.orderId}` : "/vendor-dashboard/returns",
    );
    return [created];
  });
  res.status(201).json(message);
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  res.json(await db.select().from(notificationsTable).where(eq(notificationsTable.userId, req.user!.userId)).orderBy(desc(notificationsTable.createdAt)).limit(100));
});

router.get("/notifications/unread-count", requireAuth, async (req, res): Promise<void> => {
  const [row] = await db.select({ count: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, req.user!.userId), isNull(notificationsTable.readAt)));
  res.json({ unreadCount: Number(row?.count ?? 0) });
});

router.patch("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const updated = await db.update(notificationsTable).set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, req.user!.userId), isNull(notificationsTable.readAt)))
    .returning({ id: notificationsTable.id });
  res.json({ count: updated.length });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const [notification] = await db.update(notificationsTable).set({ readAt: new Date() }).where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.userId, req.user!.userId))).returning();
  if (!notification) { res.status(404).json({ error: "Notification not found." }); return; }
  res.json(notification);
});

router.patch("/notifications/:id/unread", requireAuth, async (req, res): Promise<void> => {
  const [notification] = await db.update(notificationsTable).set({ readAt: null }).where(and(eq(notificationsTable.id, Number(req.params.id)), eq(notificationsTable.userId, req.user!.userId))).returning();
  if (!notification) { res.status(404).json({ error: "Notification not found." }); return; }
  res.json(notification);
});

export default router;