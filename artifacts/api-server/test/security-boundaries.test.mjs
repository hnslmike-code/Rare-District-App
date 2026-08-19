import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCustomerOrder,
  canAccessVendorWorkspace,
  canRequestOrderStatusUpdate,
  canSetOrderStatus,
  isMixedVendorOrder,
  isAllowedOrderTransition,
  vendorItemsForOrder,
} from "../src/lib/security-boundaries.ts";
import { formatPublicVendor } from "../src/lib/public-responses.ts";

const customer = { userId: 1, role: "shopper" };
const otherCustomer = { userId: 2, role: "shopper" };
const vendor = { userId: 3, role: "vendor" };
const admin = { userId: 4, role: "admin" };
const order = { userId: customer.userId };

function assertNoSensitiveFields(value) {
  const sensitiveFields = new Set([
    "email",
    "role",
    "bankName",
    "accountNumber",
    "accountName",
    "payoutBalance",
    "commissionRateOverride",
    "adminNote",
  ]);

  function visit(current) {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    for (const [key, nestedValue] of Object.entries(current)) {
      assert.equal(sensitiveFields.has(key), false, `public response leaked "${key}"`);
      visit(nestedValue);
    }
  }

  visit(value);
}

test("only active, approved vendors can enter the vendor workspace", () => {
  assert.equal(canAccessVendorWorkspace("approved", false), true);
  assert.equal(canAccessVendorWorkspace("pending", false), false);
  assert.equal(canAccessVendorWorkspace("rejected", false), false);
  assert.equal(canAccessVendorWorkspace("approved", true), false);
});

test("vendor workspaces only receive their own items from mixed-vendor orders", () => {
  const items = [
    { id: 11, vendorId: 101, productId: 201 },
    { id: 12, vendorId: 202, productId: 202 },
    { id: 13, vendorId: 101, productId: 203 },
  ];

  assert.deepEqual(vendorItemsForOrder(items, 101), [items[0], items[2]]);
  assert.deepEqual(vendorItemsForOrder(items, 202), [items[1]]);
  assert.equal(isMixedVendorOrder(items), true);
  assert.equal(isMixedVendorOrder([items[0], items[2]]), false);
});

test("only customers and admins can retrieve an order or begin payment for it", () => {
  assert.equal(canAccessCustomerOrder(order, customer), true);
  assert.equal(canAccessCustomerOrder(order, admin), true);
  assert.equal(canAccessCustomerOrder(order, otherCustomer), false);
  assert.equal(canAccessCustomerOrder(undefined, customer), false);
});

test("cross-vendor updates and non-cancellation customer updates are rejected", () => {
  assert.equal(canRequestOrderStatusUpdate({
    actor: vendor,
    vendorOwnsOrderItem: false,
    mixedVendorOrder: false,
    order,
    nextStatus: "processing",
  }), false);
  assert.equal(canRequestOrderStatusUpdate({
    actor: customer,
    vendorOwnsOrderItem: true,
    mixedVendorOrder: false,
    order,
    nextStatus: "processing",
  }), false);
  assert.equal(canRequestOrderStatusUpdate({
    actor: customer,
    vendorOwnsOrderItem: false,
    mixedVendorOrder: false,
    order,
    nextStatus: "processing",
  }), false);
  assert.equal(canRequestOrderStatusUpdate({
    actor: customer,
    vendorOwnsOrderItem: false,
    mixedVendorOrder: false,
    order,
    nextStatus: "cancelled",
  }), true);
  assert.equal(canRequestOrderStatusUpdate({
    actor: vendor,
    vendorOwnsOrderItem: true,
    mixedVendorOrder: true,
    order,
    nextStatus: "processing",
  }), false);
  assert.equal(canRequestOrderStatusUpdate({
    actor: vendor,
    vendorOwnsOrderItem: true,
    mixedVendorOrder: false,
    order,
    nextStatus: "processing",
  }), true);
});

test("order status transitions remain valid for each role", () => {
  assert.equal(isAllowedOrderTransition("pending", "paid"), true);
  assert.equal(isAllowedOrderTransition("paid", "processing"), true);
  assert.equal(isAllowedOrderTransition("processing", "shipped"), true);
  assert.equal(isAllowedOrderTransition("shipped", "delivered"), true);
  assert.equal(isAllowedOrderTransition("delivered", "cancelled"), false);
  assert.equal(isAllowedOrderTransition("cancelled", "processing"), false);
  assert.equal(canSetOrderStatus(vendor, "delivered"), false);
  assert.equal(canSetOrderStatus(admin, "delivered"), true);
});

test("public vendor and nested product-vendor responses exclude private account data", () => {
  const publicVendor = formatPublicVendor({
    id: 101,
    brandName: "Private Label",
    description: "Independent design studio",
    category: "Streetwear",
    logoUrl: "https://example.com/logo.png",
    website: "https://example.com",
    socialLink: "https://example.com/social",
    status: "approved",
    createdAt: new Date("2026-08-19T00:00:00.000Z"),
  });

  assert.deepEqual(Object.keys(publicVendor).sort(), [
    "brandName",
    "category",
    "createdAt",
    "description",
    "id",
    "logoUrl",
    "socialLink",
    "status",
    "website",
  ]);
  assertNoSensitiveFields(publicVendor);
  assertNoSensitiveFields({
    id: 201,
    name: "Street Jacket",
    vendor: publicVendor,
  });
});