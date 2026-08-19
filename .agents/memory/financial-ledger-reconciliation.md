---
name: Financial ledger reconciliation
description: Concurrency and idempotency rules for vendor earnings when an order changes after payment.
---

Each item-level financial outcome must create at most one signed ledger entry for its entry type before changing the vendor’s payout balance. Any path that can settle, cancel, return, or refund the same order must acquire locks in the same order: order first, then its item rows. A broader cancellation must not offset items already in a terminal, financially reconciled state.

**Why:** Payment callbacks and fulfillment updates can arrive concurrently. Without a common lock order and database-enforced ledger identity, retries or late callbacks can credit a terminal item, debit it twice, or restock it twice.

**How to apply:** Reuse the ledger identity and signed-entry approach for future chargebacks, partial refunds, or payment-provider reversals. Update reporting from ledger amounts rather than original order-item amounts whenever it needs net revenue.