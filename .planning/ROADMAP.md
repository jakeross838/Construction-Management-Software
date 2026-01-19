# Roadmap: v1.8 Invoice Variance & Data Linkage

**Created:** 2026-01-19
**Goal:** Comprehensive data linkage with variance detection, quick fixes, and correlated data across POs, invoices, draws, and budgets.

## Overview

| Phase | Name | Requirements | Goal |
|-------|------|--------------|------|
| 47 | Variance Detection Polish | VAR-01 to VAR-03 | Finalize variance detection and VPO UI |
| 48 | Cost Code Linkage | CCL-01 to CCL-04 | Improve cost code assignment and validation |
| 49 | Data Correlation | COR-01 to COR-04 | Validate linkages and integrate with price intelligence |
| 50 | AI PO Generation | AIPO-01 to AIPO-03 | Refine document-to-PO auto-generation |
| 51 | Quick Fixes | FIX-01 to FIX-03 | One-click fixes and bulk correction tools |

---

## Phase 47: Variance Detection Polish

**Status:** Planned
**Goal:** Finalize the variance detection service and complete VPO UI integration.
**Plans:** 2 plans

**Requirements:**
- VAR-01: Polish variance detection service - test thoroughly, refine line item matching
- VAR-02: Add UI to create CO/VPO directly from variance warnings
- VAR-03: Complete VPO UI integration in PO modal (ALREADY COMPLETE)

**Success Criteria:**
1. Variance detection correctly identifies unmatched invoice line items
2. User can click "Create VPO" or "Create CO" from variance warning to resolve
3. VPO section in PO modal shows all VPOs with create/edit/void actions
4. VPO totals correctly update PO total amount

**Key Files:**
- `server/services/varianceDetector.js`
- `public/js/modals.js` (invoice modal variance banner)
- `public/js/po-modals.js` (VPO section)
- `database/migration-065-vpo.sql`

Plans:
- [ ] 47-01-PLAN.md - Add action buttons to variance banner for VPO/CO creation (VAR-02)
- [ ] 47-02-PLAN.md - Add variance detector tests and polish matching (VAR-01)

Note: VAR-03 (VPO UI in PO modal) is already complete per research findings.

---

## Phase 48: Cost Code Linkage

**Status:** Not Started
**Goal:** Improve cost code assignment accuracy and validation across the system.

**Requirements:**
- CCL-01: Improve AI cost code assignment on invoice processing
- CCL-02: Validate PO line items have proper cost codes
- CCL-03: Fix line item matching between invoices and PO line items
- CCL-04: Validate G703 cost code accuracy

**Success Criteria:**
1. AI assigns correct cost code 90%+ of the time using vendor trade and keywords
2. PO creation warns if line items missing cost codes
3. Invoice line items match to PO line items with 80%+ accuracy
4. G703 shows all cost codes with correct totals

**Key Files:**
- `server/ai-processor.js`
- `server/routes/purchase-orders.js`
- `server/services/varianceDetector.js`
- `server/routes/draws.js`

---

## Phase 49: Data Correlation

**Status:** Not Started
**Goal:** Validate linkages and ensure data consistency across all entities.

**Requirements:**
- COR-01: Validate PO ↔ Invoice ↔ Draw linkage consistency
- COR-02: Ensure CO/VPO totals reflected correctly everywhere
- COR-03: Integrate variance detection with price intelligence
- COR-04: Budget vs actual accuracy validation

**Success Criteria:**
1. API validates linkages and returns warnings for inconsistencies
2. CO/VPO changes immediately reflected in PO totals, budget committed
3. Variance warnings include price intelligence (e.g., "invoice $50 above best price")
4. Budget reports show accurate committed/billed/paid amounts

**Key Files:**
- `server/routes/invoices.js`
- `server/routes/purchase-orders.js`
- `server/routes/budgets.js`
- `server/services/varianceDetector.js`

---

## Phase 50: AI PO Generation

**Status:** Not Started
**Goal:** Refine the document upload to auto-generate POs with better accuracy.

**Requirements:**
- AIPO-01: Refine document upload auto-PO generation
- AIPO-02: Improve cost code assignment on AI-generated PO line items
- AIPO-03: Better vendor/job linking for AI-generated POs

**Success Criteria:**
1. Uploaded proposal/quote extracts line items with correct amounts
2. Each line item assigned appropriate cost code based on description
3. Vendor matched with 90%+ accuracy (fuzzy match existing vendors)
4. Job context extracted from document (address, client name)

**Key Files:**
- `server/ai-po-processor.js`
- `server/routes/purchase-orders.js`
- `server/ai-processor.js`

---

## Phase 51: Quick Fixes

**Status:** Not Started
**Goal:** Make it easy to fix broken linkages with one-click actions.

**Requirements:**
- FIX-01: One-click to fix broken linkages from error displays
- FIX-02: Bulk correction tools for common issues
- FIX-03: Clear actionable error messages

**Success Criteria:**
1. Error messages include "Fix" button that opens correction modal
2. Bulk tools to reassign cost codes, fix allocations for multiple items
3. All error messages explain what's wrong AND how to fix it

**Key Files:**
- `public/js/modals.js`
- `public/js/po-modals.js`
- `server/routes/invoices.js`
- `server/routes/purchase-orders.js`

---

## Dependencies

```
Phase 47 (Variance) → Phase 49 (Correlation)
                      ↓
Phase 48 (Cost Codes) → Phase 49 (Correlation)
                        ↓
                   Phase 50 (AI PO) → Phase 51 (Quick Fixes)
```

Phase 47 and 48 can run in parallel.
Phase 49 depends on variance and cost code improvements.
Phase 50 builds on cost code improvements.
Phase 51 creates UI for fixing issues found by all previous phases.

---
*Roadmap created: 2026-01-19*
