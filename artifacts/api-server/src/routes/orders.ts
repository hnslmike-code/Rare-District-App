import { Router, type IRouter } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, productsTable, vendorsTable, adminSettingsTable } from "@workspace/db";
import { CreateOrderBody, GetOrderParams, UpdateOrderStatusParams, UpdateOrderStatusBody, ListOrdersQueryParams } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

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

  // Get commission rate from settings
  const settings = await db.select().from(adminSettingsTable).limit(1);
  const commissionRate = settings[0] ? parseFloat(settings[0].defaultCommissionRate) : 5;

  // Calculate order items
  let totalAmount = 0;
  const orderItems: Array<{ productId: number; vendorId: number; quantity: number; selectedSize?: string; unitPrice: number; commissionRate: number; commissionAmount: number; vendorAmount: number }> = [];

  for (const item of parsed.data.items) {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    if (!product) {
      res.status(404).json({ error: `Product ${item.productId} not found` });
      return;
    }
    const unitPrice = parseFloat(product.price);
    const lineTotal = unitPrice * item.quantity;
    const commissionAmount = lineTotal * (commissionRate / 100);
    const vendorAmount = lineTotal - commissionAmount;
    totalAmount += lineTotal;

    const [vendor] = await db.select().from(vendorsTable).where(eq(vendorsTable.id, product.vendorId));
    orderItems.push({
      productId: item.productId,
      vendorId: vendor?.id ?? product.vendorId,
      quantity: item.quantity,
      selectedSize: item.selectedSize,
      unitPrice,
      commissionRate,
      commissionAmount,
      vendorAmount,
    });
  }

  const discountAmount = 0; // Applied by coupon validation before order creation
  const [order] = await db.insert(ordersTable).values({
    userId: req.user!.userId,
    status: "pending",
    totalAmount: String(totalAmount),
    discountAmount: String(discountAmount),
    currency: "NGN",
    shippingAddress: parsed.data.shippingAddress,
    shippingCity: parsed.data.shippingCity,
    shippingState: parsed.data.shippingState,
    shippingPhone: parsed.data.shippingPhone,
    couponCode: parsed.data.couponCode ?? null,
  }).returning();

  for (const item of orderItems) {
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: item.productId,
      vendorId: item.vendorId,
      quantity: item.quantity,
      selectedSize: item.selectedSize ?? null,
      unitPrice: String(item.unitPrice),
      commissionRate: String(item.commissionRate),
      commissionAmount: String(item.commissionAmount),
      vendorAmount: String(item.vendorAmount),
    });
  }

  res.status(201).json(await formatOrder(order));
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
  if (!order || (order.userId !== req.user!.userId && req.user!.role !== "admin")) {
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

  const isAdmin = req.user!.role === "admin";
  const [vendor] = req.user!.role === "vendor"
    ? await db.select().from(vendorsTable).where(and(eq(vendorsTable.userId, req.user!.userId), eq(vendorsTable.status, "approved")))
    : [];
  const items = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
  const ownsOrderItem = Boolean(vendor && items.some(item => item.vendorId === vendor.id));
  const isCustomer = order.userId === req.user!.userId;

  if (!isAdmin && !ownsOrderItem && !(isCustomer && parsed.data.status === "cancelled")) {
    res.status(403).json({ error: "You do not have permission to update this order." });
    return;
  }

  const current = order.status;
  const allowedTransitions: Record<string, string[]> = {
    pending: ["paid", "cancelled"],
    paid: ["processing", "cancelled"],
    processing: ["shipped", "cancelled"],
    shipped: ["delivered"],
    delivered: [],
    cancelled: [],
  };
  if (!isAdmin && parsed.data.status === "delivered") {
    res.status(403).json({ error: "Vendors cannot set that order status." });
    return;
  }
  if (!allowedTransitions[current]?.includes(parsed.data.status)) {
    res.status(409).json({ error: `Cannot move an order from ${current} to ${parsed.data.status}.` });
    return;
  }

  const [updated] = await db.update(ordersTable).set({ status: parsed.data.status }).where(eq(ordersTable.id, order.id)).returning();
  res.json(await formatOrder(updated));
});

export default router;
