import { Router, type IRouter } from "express";
import { eq, desc, and, gte, inArray, sql } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, vendorsTable, transactionsTable, adminSettingsTable, inventoryReservationTable } from "@workspace/db";
import { CreateOrderBody, GetOrderParams, UpdateOrderStatusParams, UpdateOrderStatusBody, ListOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  canAccessCustomerOrder,
  canRequestOrderStatusUpdate,
  canSetOrderStatus,
  hasApprovedVendorAccess,
  isMixedVendorOrder,
  isAllowedOrderTransition,
  type OrderStatus,
  vendorItemsForOrder,
} from "../lib/security-boundaries";
import { createVendorAlert } from "../lib/vendor-notifications";

const router: IRouter = Router();

type LedgerEntryType = "sale" | "refund" | "reversal";
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type OrderRow = typeof ordersTable.$inferSelect;
type OrderItemRow = typeof orderItemsTable.$inferSelect;

function ledgerReference(order: OrderRow, item: OrderItemRow, entryType: LedgerEntryType, paymentReference?: string) {
  return `${paymentReference ?? order.paymentReference ?? `order-${order.id}`}:${entryType}:${item.id}`;
}

/**
 * Records a signed vendor ledger entry exactly once for an order item. Sales
 * are positive; refunds and reversals are negative offsets to the same vendor
 * earnings and commission amounts.
 */
export async function recordOrderItemLedgerEntry(
  tx: DbTransaction,
  order: OrderRow,
  item: OrderItemRow,
  entryType: LedgerEntryType,
  paymentReference?: string,
) {
  const reference = ledgerReference(order, item, entryType, paymentReference);
  const [existing] = await tx.select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(eq(transactionsTable.reference, reference))
    .limit(1);
  if (existing) return false;

  let processor = order.paymentProcessor;
  if (entryType !== "sale") {
    const sales = await tx.select({
      id: transactionsTable.id,
      orderItemId: transactionsTable.orderItemId,
      processor: transactionsTable.processor,
    }).from(transactionsTable).where(and(
      eq(transactionsTable.orderId, order.id),
      eq(transactionsTable.vendorId, item.vendorId),
      eq(transactionsTable.transactionType, "sale"),
      eq(transactionsTable.status, "success"),
    ));
    // Item-linked sales provide an exact audit trail. Older sales were not
    // item-linked, but any successful vendor sale proves the item amount is
    // already included in that vendor's balance and can be offset safely.
    const sale = sales.find(transaction => transaction.orderItemId === item.id) ?? sales[0];
    if (!sale) return false;
    processor = sale.processor as typeof order.paymentProcessor;
  }
  if (!processor) return false;

  const multiplier = entryType === "sale" ? 1 : -1;
  const amount = parseFloat(item.unitPrice) * item.quantity * multiplier;
  const commissionAmount = parseFloat(item.commissionAmount) * multiplier;
  const vendorAmount = parseFloat(item.vendorAmount) * multiplier;
  const [inserted] = await tx.insert(transactionsTable).values({
    orderId: order.id,
    orderItemId: item.id,
    buyerId: order.userId,
    vendorId: item.vendorId,
    amount: String(amount),
    commissionRate: item.commissionRate,
    commissionAmount: String(commissionAmount),
    vendorAmount: String(vendorAmount),
    processor,
    reference,
    status: "success",
    transactionType: entryType,
  }).onConflictDoNothing({
    target: [transactionsTable.orderItemId, transactionsTable.transactionType],
  }).returning({ id: transactionsTable.id });
  if (!inserted) return false;
  await tx.update(vendorsTable)
    .set({ payoutBalance: sql`${vendorsTable.payoutBalance} + ${vendorAmount}` })
    .where(eq(vendorsTable.id, item.vendorId));
  return true;
}

export async function releaseOrderInventory(orderId: number, status: "cancelled" = "cancelled") {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`);
    const [order] = await tx.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return order;
    await tx.execute(sql`SELECT id FROM order_items WHERE order_id = ${orderId} FOR UPDATE`);
    const items = await tx.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
    for (const item of items) {
      const inventoryAlreadyRestored = ["cancelled", "returned", "refunded"].includes(item.fulfillmentStatus);
      if (!order.inventoryReleasedAt && !inventoryAlreadyRestored) {
        await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${item.quantity}` })
          .where(eq(productsTable.id, item.productId));
        await tx.update(orderItemsTable)
          .set({ fulfillmentStatus: "cancelled" })
          .where(eq(orderItemsTable.id, item.id));
      }
      // A terminal item has already recorded its financial offset. Do not
      // reverse it again when the rest of its order is later cancelled.
      if (!inventoryAlreadyRestored) {
        await recordOrderItemLedgerEntry(tx, order, item, "reversal");
      }
    }
    await tx.update(inventoryReservationTable).set({ status: "released", releasedAt: new Date() }).where(and(
      eq(inventoryReservationTable.orderId, orderId),
      eq(inventoryReservationTable.status, "active"),
    ));
    const [updated] = await tx.update(ordersTable)
      .set({ status, inventoryReleasedAt: order.inventoryReleasedAt ?? new Date() })
      .where(eq(ordersTable.id, orderId))
      .returning();
    return updated;
  });
}

export async function expireInventoryReservations() {
  return db.transaction(async tx => {
    const expired = await tx.select().from(inventoryReservationTable).where(and(
      eq(inventoryReservationTable.status, "active"),
      sql`${inventoryReservationTable.expiresAt} <= now()`,
    ));
    for (const reservation of expired) {
      await tx.execute(sql`SELECT id FROM inventory_reservations WHERE id = ${reservation.id} FOR UPDATE`);
      const [stillActive] = await tx.select().from(inventoryReservationTable).where(and(
        eq(inventoryReservationTable.id, reservation.id),
        eq(inventoryReservationTable.status, "active"),
      ));
      if (!stillActive) continue;
      await tx.update(productsTable).set({ stock: sql`${productsTable.stock} + ${reservation.quantity}` }).where(eq(productsTable.id, reservation.productId));
      await tx.update(inventoryReservationTable).set({ status: "expired", releasedAt: new Date() }).where(eq(inventoryReservationTable.id, reservation.id));
      await tx.update(ordersTable).set({ status: "cancelled", inventoryReleasedAt: new Date() }).where(and(eq(ordersTable.id, reservation.orderId), eq(ordersTable.status, "pending")));
    }
    return expired.length;
  });
}

async function formatOrder(order: typeof ordersTable.$inferSelect) {
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const formattedItems = await Promise.all(items.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return {
      id: item.id, orderId: item.orderId, productId: item.productId, vendorId: item.vendorId,
      quantity: item.quantity, selectedSize: item.selectedSize,
      unitPrice: parseFloat(item.unitPrice), commissionRate: parseFloat(item.commissionRate),
      commissionAmount: parseFloat(item.commissionAmount), vendorAmount: parseFloat(item.vendorAmount),
      product: product ? {
        id: product.id, vendorId: product.vendorId, name: product.name, description: product.description,
        price: parseFloat(product.price), currency: product.currency, category: product.category,
        sizes: product.sizes, images: product.images, stock: product.stock, isActive: product.isActive,
        isFeatured: product.isFeatured, wardrobeCount: product.wardrobeCount,
        averageRating: null, reviewCount: 0, createdAt: product.createdAt,
      } : undefined,
    };
  }));

  return {
    id: order.id, userId: order.userId, status: order.status,
    totalAmount: parseFloat(order.totalAmount), discountAmount: parseFloat(order.discountAmount ?? "0"),
    currency: order.currency, shippingAddress: order.shippingAddress,
    shippingCity: order.shippingCity, shippingState: order.shippingState,
    shippingPhone: order.shippingPhone, couponCode: order.couponCode,
    paymentProcessor: order.paymentProcessor, paymentReference: order.paymentReference,
    createdAt: order.createdAt, items: formattedItems,
  };
}

// GET /orders
router.get("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  const page = parsed.success ? (parsed.data.page ?? 1) : 1;
  const limit = parsed.success ? (parsed.data.limit ?? 20) : 20;
  const offset = (page - 1) * limit;

  const orders = await db.select().from(ordersTable)
    .where(eq(ordersTable.userId, req.user!.userId))
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit).offset(offset);

  res.json(await Promise.all(orders.map(formatOrder)));
});

// POST /orders
router.post("/orders", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    await expireInventoryReservations();
    const order = await db.transaction(async (tx) => {
      const settings = await tx.select().from(adminSettingsTable).limit(1);
      const commissionRate = settings[0] ? parseFloat(settings[0].defaultCommissionRate) : 5;
      let totalAmount = 0;
      const orderItems: Array<{ productId: number; vendorId: number; quantity: number; selectedSize?: string; unitPrice: number; commissionRate: number; commissionAmount: number; vendorAmount: number }> = [];

      for (const item of parsed.data.items) {
        // The conditional update is the reservation: concurrent checkouts
        // cannot both decrement the same final unit.
        const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, item.productId));
        if (!product || !product.isActive) throw new Error(`Product ${item.productId} is unavailable.`);
        const unitPrice = parseFloat(product.price);
        const lineTotal = unitPrice * item.quantity;
        const commissionAmount = lineTotal * (commissionRate / 100);
        const vendorAmount = lineTotal - commissionAmount;
        totalAmount += lineTotal;
        const [reserved] = await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} - ${item.quantity}` })
          .where(and(eq(productsTable.id, item.productId), gte(productsTable.stock, item.quantity), eq(productsTable.isActive, true)))
          .returning({ id: productsTable.id });
        if (!reserved) throw new Error(`${product.name} does not have enough stock.`);
        orderItems.push({
          productId: item.productId, vendorId: product.vendorId, quantity: item.quantity,
          selectedSize: item.selectedSize, unitPrice, commissionRate, commissionAmount, vendorAmount,
        });
      }

      const [created] = await tx.insert(ordersTable).values({
        userId: req.user!.userId, status: "pending", totalAmount: String(totalAmount),
        discountAmount: "0", currency: "NGN", shippingAddress: parsed.data.shippingAddress,
        shippingCity: parsed.data.shippingCity, shippingState: parsed.data.shippingState,
        shippingPhone: parsed.data.shippingPhone, couponCode: parsed.data.couponCode ?? null,
      }).returning();
      for (const item of orderItems) {
        const [createdItem] = await tx.insert(orderItemsTable).values({
          orderId: created.id, productId: item.productId, vendorId: item.vendorId,
          quantity: item.quantity, selectedSize: item.selectedSize ?? null,
          unitPrice: String(item.unitPrice), commissionRate: String(item.commissionRate),
          commissionAmount: String(item.commissionAmount), vendorAmount: String(item.vendorAmount),
        }).returning({ id: orderItemsTable.id });
        await tx.insert(inventoryReservationTable).values({
          orderId: created.id, orderItemId: createdItem.id, productId: item.productId,
          quantity: item.quantity, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        });
      }
      const vendorIds = [...new Set(orderItems.map(item => item.vendorId))];
      const vendors = vendorIds.length
        ? await tx.select().from(vendorsTable).where(inArray(vendorsTable.id, vendorIds))
        : [];
      for (const vendor of vendors) {
        const units = orderItems.filter(item => item.vendorId === vendor.id).reduce((total, item) => total + item.quantity, 0);
        await createVendorAlert(tx, vendor, {
          type: "order",
          title: "New order received",
          body: `Order #${created.id} includes ${units} unit${units === 1 ? "" : "s"} from your catalog.`,
          href: "/vendor-dashboard/orders",
        });
      }
      return created;
    });
    res.status(201).json(await formatOrder(order));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reserve inventory.";
    res.status(409).json({ error: message });
  }
});

// GET /orders/:id
router.get("/orders/:id", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = GetOrderParams.safeParse({ id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, parsed.data.id));
  if (!canAccessCustomerOrder(order, req.user!)) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(await formatOrder(order));
});

// PATCH /orders/:id/status
router.patch("/orders/:id/status", requireAuth, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const paramsParsed = UpdateOrderStatusParams.safeParse({ id });
  if (!paramsParsed.success) {
    res.status(400).json({ error: "Invalid order id" });
    return;
  }
  const parsed = UpdateOrderStatusBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, paramsParsed.data.id));
  if (!order) {
    res.status(404).json({ error: "Order not found" });
    return;
  }

  const [vendor] = req.user!.role === "vendor"
    ? await db.select().from(vendorsTable).where(eq(vendorsTable.userId, req.user!.userId))
    : [];
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const ownsOrderItem = Boolean(
    vendor &&
    hasApprovedVendorAccess(vendor.status) &&
    vendorItemsForOrder(items, vendor.id).length > 0,
  );

  if (!canRequestOrderStatusUpdate({
    actor: req.user!,
    vendorOwnsOrderItem: ownsOrderItem,
    mixedVendorOrder: isMixedVendorOrder(items),
    order,
    nextStatus: parsed.data.status,
  })) {
    res.status(403).json({ error: "You do not have permission to update this order." });
    return;
  }

  const current = order.status as OrderStatus;
  if (!canSetOrderStatus(req.user!, parsed.data.status)) {
    res.status(403).json({ error: "Vendors cannot set that order status." });
    return;
  }
  if (!isAllowedOrderTransition(current, parsed.data.status)) {
    res.status(409).json({ error: `Cannot move an order from ${current} to ${parsed.data.status}.` });
    return;
  }

  const updated = parsed.data.status === "cancelled"
    ? await releaseOrderInventory(order.id)
    : (await db.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, order.id)).returning())[0];
  if (!updated) {
    res.status(409).json({ error: "Order could not be updated." });
    return;
  }
  res.json(await formatOrder(updated));
});

export default router;
