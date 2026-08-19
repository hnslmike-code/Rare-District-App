---
name: Return shipping agreement
description: Return approval requires an accepted, auditable shipping-cost agreement.
---

Return shipping must be negotiated through a proposal/counter/accept flow before a vendor approves a return. An approval cannot rely on a mutable client-supplied payer value; it requires an accepted proposal, preserved instructions, and immutable audit events.

**Why:** A customer and vendor need one shared, defensible record of who pays and how the item is returned. A direct status change could otherwise approve a return without agreed terms or erase the negotiation history.

**How to apply:** Any later return workflow—disputes, carrier labels, shipping reimbursement, admin intervention, or customer return history—must read the accepted proposal and audit timeline as the source of truth.