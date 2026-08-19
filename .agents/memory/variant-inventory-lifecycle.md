---
name: Variant inventory lifecycle
description: Durable rule for reserving, settling, cancelling, and expiring product variant inventory.
---

Variant products must use the selected combination's reservation and physical stock as the source of truth during checkout. Aggregate product stock remains a compatibility value and changes only when variant physical stock changes during payment settlement or restoration.

**Why:** A product can have multiple size, color, material, or custom combinations whose quantities are independent; changing the aggregate value during a hold can oversell one combination while another remains available.

**How to apply:** Require an active variant for variant products, carry its ID through wardrobe and order items, increment `reservedStock` for pending holds, consume both stock fields on settlement, and release or restore the same variant on cancellation and expiry.