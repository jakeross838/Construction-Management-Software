# Roadmap: v1.7 Data Integrity & AI Accuracy

**Created:** 2026-01-19
**Goal:** Foolproof invoice -> approval -> draw -> budget pipeline with accurate PO/CO linking

## Overview

| Phase | Name | Requirements | Goal |
|-------|------|--------------|------|
| 43 | Budget Integrity | BUD-INT-01 to BUD-INT-04 | RPC functions and committed_amount tracking |
| 44 | Invoice Pipeline | INV-INT-01 to INV-INT-04 | Allocation cleanup and transaction safety |
| 45 | Draw & PO/CO Linking | DRW-INT-01 to DRW-INT-03, PO-INT-01 to PO-INT-04 | Accurate draws and PO/CO sync |
| 46 | AI Accuracy | AI-INT-01 to AI-INT-04 | Better job matching and extraction |

---

## Phase 43: Budget Integrity ✓

**Status:** Complete (2026-01-19)
**Goal:** Create missing RPC functions and fix committed_amount tracking so PO approval correctly updates budget lines.

**Requirements:**
- BUD-INT-01: Create `increment_committed_amount` RPC function
- BUD-INT-02: Create `decrement_committed_amount` RPC function
- BUD-INT-03: Fix budget line creation (require non-zero budget)
- BUD-INT-04: Sync committed_amount on all PO lifecycle events

**Success Criteria:**
1. When PO is approved, budget_lines.committed_amount increases by PO line item amounts
2. When PO is voided, budget_lines.committed_amount decreases by PO line item amounts
3. Budget lines cannot be created with budgeted_amount = 0 (error thrown)
4. CO approval also updates committed_amount correctly

**Plans:** 3 plans

Plans:
- [x] 43-01-PLAN.md - Create RPC functions for atomic budget updates
- [x] 43-02-PLAN.md - Wire PO approval/void/CO to use RPC functions
- [x] 43-03-PLAN.md - Fix draws.js to not create zero-budget lines

**Key Files:**
- `database/migration-064-budget-rpc.sql` (new)
- `server/routes/purchase-orders.js`
- `server/routes/draws.js`

---

## Phase 44: Invoice Pipeline

**Goal:** Make invoice approval and allocation bulletproof with proper cleanup and transaction safety.

**Requirements:**
- INV-INT-01: Allocation cleanup on status transitions
- INV-INT-02: Transaction wrapping for critical operations
- INV-INT-03: Billed_amount recalculation on allocation changes
- INV-INT-04: Validate allocation sum before approval

**Success Criteria:**
1. When invoice is denied, all allocations are removed and PO line items updated
2. When invoice is deleted, same cleanup occurs
3. Approve, allocate, add-to-draw operations are atomic (all-or-nothing)
4. Cannot approve invoice if allocations don't sum to invoice amount

**Plans:** 4 plans

Plans:
- [ ] 44-01-PLAN.md - Allocation cleanup on denied/deleted transitions
- [ ] 44-02-PLAN.md - Validate allocation sum before approval
- [ ] 44-03-PLAN.md - Transaction wrapping for critical operations
- [ ] 44-04-PLAN.md - Billed_amount recalculation on allocation changes

**Key Files:**
- `server/routes/invoices.js`
- `server/services/invoiceHelpers.js`

---

## Phase 45: Draw & PO/CO Linking

**Goal:** Fix draw calculations and ensure PO/CO amounts stay in sync with invoice allocations.

**Requirements:**
- DRW-INT-01: Recalculate draw total on GET
- DRW-INT-02: Include zero-billed cost codes in G703
- DRW-INT-03: Validate draw vs invoice allocations
- PO-INT-01: Sync PO line item invoiced_amount
- PO-INT-02: Track CO invoiced_amount on approval
- PO-INT-03: Reverse committed on PO void
- PO-INT-04: Validate CO mutual exclusivity

**Success Criteria:**
1. GET /draws/:id always returns accurate total (recalculated, not stored)
2. G703 shows all cost codes with budget, even if 0% billed
3. PO line items reflect exact sum of linked invoice allocations
4. CO amounts track invoices correctly
5. Voiding PO reverses budget committed_amount
6. Cannot double-count CO billings

**Plans:** (created by /gsd:plan-phase)

**Key Files:**
- `server/routes/draws.js`
- `server/routes/purchase-orders.js`
- `server/invoiceHelpers.js`

---

## Phase 46: AI Accuracy

**Goal:** Improve job matching and invoice data extraction accuracy.

**Requirements:**
- AI-INT-01: Raise confidence thresholds
- AI-INT-02: Improve text scanning
- AI-INT-03: Robust date validation
- AI-INT-04: Better vendor extraction

**Success Criteria:**
1. Job matches require 70%+ confidence (was 50%)
2. Text scanning checks ship-to, project, customer fields
3. Invalid dates (like 2024-05-34) become null, not errors
4. Vendor name extracted from invoice header, not confused with customer

**Plans:** (created by /gsd:plan-phase)

**Key Files:**
- `server/ai-processor.js`
- `server/ocr-processor.js`

---

## Dependencies

```
Phase 43 (Budget) -> Phase 44 (Invoice) -> Phase 45 (Draw/PO) -> Phase 46 (AI)
         |
    RPC functions needed before invoice cleanup can update budgets
```

Phase 43 must complete first as it creates the RPC functions that Phase 44 and 45 need.
Phase 46 is independent but logically comes last.

---
*Roadmap created: 2026-01-19*
