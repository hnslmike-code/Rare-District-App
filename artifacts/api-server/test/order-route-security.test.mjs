import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { signToken } from "../src/lib/auth.ts";

const databaseRequire = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = databaseRequire("pg");
const databaseUrl = process.env.DATABASE_URL;
const suffix = randomUUID().replaceAll("-", "");
const apiPort = 18110;
const apiUrl = `http://127.0.0.1:${apiPort}/api`;

function auth(user) {
  return {
    Authorization: `Bearer ${signToken({ userId: user.id, email: user.email, role: user.role })}`,
    "Content-Type": "application/json",
  };
}

async function waitForHealthyServer(server, output) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`Test API exited before becoming healthy:\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${apiUrl}/healthz`);
      if (response.ok) return;
    } catch {
      // The child process is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Test API did not become healthy:\n${output.join("")}`);
}

async function stopServer(server) {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await once(server, "exit");
}

if (!databaseUrl) {
  test("order route security fixtures require a database", { skip: "DATABASE_URL is required" }, () => {});
} else {
  test("order routes isolate mixed-vendor data and enforce ownership boundaries", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const created = { users: [], vendors: [], products: [], orders: [], orderItems: [], transactions: [], payouts: [] };
    const serverOutput = [];
    const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
      cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env, NODE_ENV: "test", PORT: String(apiPort) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => serverOutput.push(chunk.toString()));
    server.stderr.on("data", chunk => serverOutput.push(chunk.toString()));

    async function query(text, values) {
      return pool.query(text, values);
    }

    async function createOrder(buyerId, status, items) {
      const orderResult = await query(
        `INSERT INTO orders (
          user_id, status, total_amount, shipping_address, shipping_city, shipping_state, shipping_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          buyerId,
          status,
          items.reduce((total, item) => total + item.unitPrice, 0).toString(),
          "1 Regression Road",
          "Lagos",
          "Lagos",
          "08000000000",
        ],
      );
      const orderId = orderResult.rows[0].id;
      created.orders.push(orderId);

      for (const item of items) {
        const orderItemResult = await query(
          `INSERT INTO order_items (
            order_id, product_id, vendor_id, quantity, unit_price, commission_rate, commission_amount, vendor_amount
          ) VALUES ($1, $2, $3, 1, $4, 5, $5, $6) RETURNING id`,
          [
            orderId,
            item.productId,
            item.vendorId,
            item.unitPrice.toString(),
            (item.unitPrice * 0.05).toString(),
            (item.unitPrice * 0.95).toString(),
          ],
        );
        created.orderItems.push(orderItemResult.rows[0].id);
      }

      return orderId;
    }

    try {
      await waitForHealthyServer(server, serverOutput);

      const userResult = await query(
        `INSERT INTO users (email, referral_code, role, is_suspended) VALUES
          ($1, $2, 'shopper', false),
          ($3, $4, 'shopper', false),
          ($5, $6, 'vendor', false),
          ($7, $8, 'vendor', false),
          ($9, $10, 'vendor', false),
          ($11, $12, 'vendor', false),
          ($13, $14, 'vendor', true),
          ($15, $16, 'admin', false)
        RETURNING id, email, role`,
        [
          `buyer-${suffix}@example.test`, `BUY${suffix.slice(0, 8)}`,
          `outsider-${suffix}@example.test`, `OUT${suffix.slice(0, 8)}`,
          `vendor-a-${suffix}@example.test`, `VNA${suffix.slice(0, 8)}`,
          `vendor-b-${suffix}@example.test`, `VNB${suffix.slice(0, 8)}`,
          `pending-${suffix}@example.test`, `PND${suffix.slice(0, 8)}`,
          `rejected-${suffix}@example.test`, `REJ${suffix.slice(0, 8)}`,
          `suspended-${suffix}@example.test`, `SUS${suffix.slice(0, 8)}`,
          `admin-${suffix}@example.test`, `ADM${suffix.slice(0, 8)}`,
        ],
      );
      const [buyer, outsider, vendorAUser, vendorBUser, pendingUser, rejectedUser, suspendedUser, adminUser] = userResult.rows;
      created.users.push(...userResult.rows.map(user => user.id));

      const vendorResult = await query(
        `INSERT INTO vendors (user_id, brand_name, status) VALUES
          ($1, $2, 'approved'),
          ($3, $4, 'approved'),
          ($5, $6, 'pending'),
          ($7, $8, 'rejected'),
          ($9, $10, 'approved')
        RETURNING id`,
        [
          vendorAUser.id, `Vendor A ${suffix}`,
          vendorBUser.id, `Vendor B ${suffix}`,
          pendingUser.id, `Pending ${suffix}`,
          rejectedUser.id, `Rejected ${suffix}`,
          suspendedUser.id, `Suspended ${suffix}`,
        ],
      );
      const [vendorA, vendorB] = vendorResult.rows;
      created.vendors.push(...vendorResult.rows.map(vendor => vendor.id));

      const productResult = await query(
        `INSERT INTO products (vendor_id, name, price, stock) VALUES
          ($1, $2, 1000, 5),
          ($3, $4, 2000, 5)
        RETURNING id`,
        [vendorA.id, `A Product ${suffix}`, vendorB.id, `B Product ${suffix}`],
      );
      const [productA, productB] = productResult.rows;
      created.products.push(...productResult.rows.map(product => product.id));

      const mixedOrderId = await createOrder(buyer.id, "paid", [
        { productId: productA.id, vendorId: vendorA.id, unitPrice: 1000 },
        { productId: productB.id, vendorId: vendorB.id, unitPrice: 2000 },
      ]);
      const deliveredOrderId = await createOrder(buyer.id, "delivered", [
        { productId: productA.id, vendorId: vendorA.id, unitPrice: 1000 },
      ]);
      const cancellableOrderId = await createOrder(buyer.id, "paid", [
        { productId: productA.id, vendorId: vendorA.id, unitPrice: 1000 },
      ]);
      await query("UPDATE vendors SET admin_note = $1 WHERE id = $2", ["Retain this note", vendorA.id]);
      const transactionResult = await query(
        `INSERT INTO transactions (
          order_id, buyer_id, vendor_id, amount, commission_rate, commission_amount, vendor_amount, processor, status
        ) VALUES ($1, $2, $3, 1000, 5, 50, 950, 'paystack', 'success') RETURNING id`,
        [mixedOrderId, buyer.id, vendorA.id],
      );
      created.transactions.push(transactionResult.rows[0].id);
      const payoutResult = await query(
        `INSERT INTO payout_records (vendor_id, amount, note, status, reference)
         VALUES ($1, 500, 'Settlement', 'paid', 'payout-secret-reference') RETURNING id`,
        [vendorA.id],
      );
      created.payouts.push(payoutResult.rows[0].id);

      const recentOrdersResponse = await fetch(`${apiUrl}/vendors/dashboard/recent-orders`, {
        headers: auth(vendorAUser),
      });
      assert.equal(recentOrdersResponse.status, 200);
      const recentOrders = await recentOrdersResponse.json();
      const vendorMixedOrder = recentOrders.find(order => order.id === mixedOrderId);
      assert.deepEqual(vendorMixedOrder.items.map(item => item.vendorId), [vendorA.id]);
      assert.deepEqual(vendorMixedOrder.items.map(item => item.productId), [productA.id]);

      const preserveNoteResponse = await fetch(`${apiUrl}/admin/vendors/${vendorA.id}/status`, {
        method: "PATCH",
        headers: auth(adminUser),
        body: JSON.stringify({ status: "approved" }),
      });
      assert.equal(preserveNoteResponse.status, 200);
      assert.equal((await preserveNoteResponse.json()).adminNote, "Retain this note");

      const vendorDetailResponse = await fetch(`${apiUrl}/admin/vendors/${vendorA.id}`, {
        headers: auth(adminUser),
      });
      assert.equal(vendorDetailResponse.status, 200);
      const vendorDetail = await vendorDetailResponse.json();
      assert.equal(vendorDetail.vendor.id, vendorA.id);
      assert.deepEqual(
        vendorDetail.orderItems.filter(item => item.orderId === mixedOrderId).map(item => item.productId),
        [productA.id],
      );
      assert.equal("accountNumber" in vendorDetail.vendor, false);
      assert.equal("referralCode" in vendorDetail.vendor.user, false);
      assert.equal("shippingAddress" in vendorDetail.orderItems[0], false);
      assert.equal("shippingPhone" in vendorDetail.orderItems[0], false);
      assert.equal("paymentReference" in vendorDetail.orderItems[0], false);
      assert.equal("vendor" in vendorDetail.catalog[0], false);
      assert.equal("accountNumber" in vendorDetail.catalog[0], false);
      assert.equal("referralCode" in vendorDetail.catalog[0], false);
      assert.equal(vendorDetail.balance.totalSales, 950);
      assert.equal(vendorDetail.balance.totalCommission, 50);
      assert.equal(vendorDetail.balance.totalPaid, 500);
      assert.equal(vendorDetail.payouts[0].reference, "••••ence");
      assert.ok(vendorDetail.notes.some(note => note.text === "Retain this note"));
      assert.ok(vendorDetail.decisions.some(decision => decision.status === "approved"));
      assert.ok(vendorDetail.auditEvents.some(event => event.action === "vendor_approved"));

      const nonAdminVendorDetailResponse = await fetch(`${apiUrl}/admin/vendors/${vendorA.id}`, {
        headers: auth(vendorAUser),
      });
      assert.equal(nonAdminVendorDetailResponse.status, 403);

      const mixedUpdateResponse = await fetch(`${apiUrl}/orders/${mixedOrderId}/status`, {
        method: "PATCH",
        headers: auth(vendorAUser),
        body: JSON.stringify({ status: "processing" }),
      });
      assert.equal(mixedUpdateResponse.status, 403);
      const mixedOrderAfterUpdate = await query("SELECT status FROM orders WHERE id = $1", [mixedOrderId]);
      assert.equal(mixedOrderAfterUpdate.rows[0].status, "paid");

      const adminMixedOrderUpdateResponse = await fetch(`${apiUrl}/orders/${mixedOrderId}/status`, {
        method: "PATCH",
        headers: auth(adminUser),
        body: JSON.stringify({ status: "processing" }),
      });
      assert.equal(adminMixedOrderUpdateResponse.status, 200);
      const mixedOrderAfterAdminUpdate = await query("SELECT status FROM orders WHERE id = $1", [mixedOrderId]);
      assert.equal(mixedOrderAfterAdminUpdate.rows[0].status, "processing");

      const invalidTransitionResponse = await fetch(`${apiUrl}/orders/${deliveredOrderId}/status`, {
        method: "PATCH",
        headers: auth(vendorAUser),
        body: JSON.stringify({ status: "processing" }),
      });
      assert.equal(invalidTransitionResponse.status, 409);

      const vendorSingleOrderUpdateResponse = await fetch(`${apiUrl}/orders/${cancellableOrderId}/status`, {
        method: "PATCH",
        headers: auth(vendorAUser),
        body: JSON.stringify({ status: "processing" }),
      });
      assert.equal(vendorSingleOrderUpdateResponse.status, 200);
      const singleOrderAfterVendorUpdate = await query("SELECT status FROM orders WHERE id = $1", [cancellableOrderId]);
      assert.equal(singleOrderAfterVendorUpdate.rows[0].status, "processing");

      const cancellationResponse = await fetch(`${apiUrl}/orders/${cancellableOrderId}/status`, {
        method: "PATCH",
        headers: auth(buyer),
        body: JSON.stringify({ status: "cancelled" }),
      });
      assert.equal(cancellationResponse.status, 200);
      const cancelledOrder = await query("SELECT status FROM orders WHERE id = $1", [cancellableOrderId]);
      assert.equal(cancelledOrder.rows[0].status, "cancelled");

      const crossCustomerOrderResponse = await fetch(`${apiUrl}/orders/${mixedOrderId}`, {
        headers: auth(outsider),
      });
      assert.equal(crossCustomerOrderResponse.status, 404);

      const unknownOrderResponse = await fetch(`${apiUrl}/orders/2147483647/status`, {
        method: "PATCH",
        headers: auth(vendorAUser),
        body: JSON.stringify({ status: "processing" }),
      });
      assert.equal(unknownOrderResponse.status, 404);

      const paymentOwnershipResponse = await fetch(`${apiUrl}/payments/paystack/initiate`, {
        method: "POST",
        headers: auth(outsider),
        body: JSON.stringify({ orderId: mixedOrderId, email: outsider.email }),
      });
      assert.equal(paymentOwnershipResponse.status, 404);

      for (const user of [pendingUser, rejectedUser, suspendedUser]) {
        const dashboardResponse = await fetch(`${apiUrl}/vendors/dashboard`, { headers: auth(user) });
        assert.equal(dashboardResponse.status, 403);
      }
    } finally {
      try {
        if (created.vendors.length) await query("DELETE FROM admin_audit_logs WHERE entity_type = 'vendor' AND entity_id = ANY($1::text[])", [created.vendors.map(String)]);
        if (created.payouts.length) await query("DELETE FROM payout_records WHERE id = ANY($1::int[])", [created.payouts]);
        if (created.transactions.length) await query("DELETE FROM transactions WHERE id = ANY($1::int[])", [created.transactions]);
        if (created.orderItems.length) await query("DELETE FROM order_items WHERE id = ANY($1::int[])", [created.orderItems]);
        if (created.orders.length) await query("DELETE FROM orders WHERE id = ANY($1::int[])", [created.orders]);
        if (created.products.length) await query("DELETE FROM products WHERE id = ANY($1::int[])", [created.products]);
        if (created.vendors.length) await query("DELETE FROM vendors WHERE id = ANY($1::int[])", [created.vendors]);
        if (created.users.length) await query("DELETE FROM users WHERE id = ANY($1::int[])", [created.users]);
      } finally {
        await pool.end();
        await stopServer(server);
      }
    }
  });
}