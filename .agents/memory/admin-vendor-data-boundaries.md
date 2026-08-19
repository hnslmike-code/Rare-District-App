---
name: Admin vendor data boundaries
description: Rules for keeping the admin vendor operations view scoped and free of unnecessary private fields.
---

Admin vendor operations responses must use explicit safe summary/detail schemas. Order records must be selected through the vendor's own line items, and generic vendor or nested-product contracts must not be reused where they allow bank account, referral, shipping, payment, or another vendor's fulfillment data.

**Why:** A multi-vendor order and shared response models can otherwise expose unrelated vendor or customer information even when the immediate server mapping happens to omit it.

**How to apply:** When extending this view, start from the least data needed by the admin workflow; keep payout account/reference values masked, use vendor-scoped joins, and update the contract plus integration assertions whenever a new nested object is introduced.