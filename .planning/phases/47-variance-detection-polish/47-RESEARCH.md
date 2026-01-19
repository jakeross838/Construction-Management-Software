# Phase 47 Research: Variance Detection Polish

**Researched:** 2026-01-19
**Domain:** Variance Detection Service and VPO UI Integration
**Confidence:** HIGH

## Summary

Phase 47 focuses on polishing the variance detection service and completing VPO (Verbal Purchase Order) UI integration. Research reveals that:

1. **Variance detector service exists and is comprehensive** - `varianceDetector.js` has complete matching logic including text similarity (Jaccard), amount matching, VPO/CO integration, and multiple warning types
2. **VPO backend is complete** - Database schema (migration-065), API endpoints, and PO modal UI are all implemented and working
3. **Gap: Variance warnings display but lack action buttons** - The variance banner shows in invoice modal but does not offer "Create VPO" or "Create CO" buttons
4. **Gap: No automatic variance check on PO link change** - Quick variance check endpoint exists but UI doesn't call it when PO link changes

**Primary recommendation:** Focus on UI integration - add action buttons to variance warning banner and wire up VPO/CO creation flows from invoice modal.

## Current State

### Variance Detector Service (COMPLETE)
**File:** `C:\Users\Jake\Construction-Management-Software\server\services\varianceDetector.js`

**Capabilities:**
- `detectVariances(invoice)` - Full analysis with PO, CO, and VPO matching
- `quickVarianceCheck(poId, invoiceAmount, excludeInvoiceId)` - Fast budget check
- Text similarity via Jaccard coefficient (word overlap)
- Amount matching with 10% tolerance scoring
- Combined scoring: 70% text + 30% amount

**Warning Types:**
| Type | Severity | Description |
|------|----------|-------------|
| `over_budget` | high | Invoice exceeds PO remaining budget |
| `exceeds_po_total` | high | Total billed will exceed PO total |
| `amount_mismatch` | medium/low | Line item differs >5% from PO line |
| `unmatched_line_item` | medium/high | Invoice line not on PO or CO/VPO |
| `line_item_over_budget` | medium | Line item allocation exceeds budget |
| `approaching_limit` | low | PO >90% billed |

**VPO Matching (lines 271-296):** Already checks VPOs for unmatched items:
```javascript
// Check if it matches an approved VPO
for (const vpo of vpos) {
  const vpoDesc = vpo.description || '';
  const vpoAmount = parseFloat(vpo.amount) || 0;
  const descSimilarity = calculateSimilarity(invDesc, vpoDesc);
  const amountMatch = Math.abs(invAmount - vpoAmount) < 1;
  if (descSimilarity > 0.2 || amountMatch) {
    matchedVPO = vpo;
    break;
  }
}
```

### VPO Implementation (COMPLETE)

**Database:** `migration-065-vpo.sql`
- Table: `v2_verbal_purchase_orders`
- Fields: `po_id`, `vpo_number`, `description`, `reason`, `amount`, `authorized_by`, `authorized_date`, `status`
- Trigger: Automatically updates `v2_purchase_orders.vpo_total` and `total_amount`

**API Endpoints:** `server/routes/purchase-orders.js` (lines 1297-1452)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders/:poId/vpos` | List all VPOs |
| POST | `/api/purchase-orders/:poId/vpos` | Create VPO (auto-approved) |
| PATCH | `/api/purchase-orders/:poId/vpos/:vpoId` | Update VPO |
| POST | `/api/purchase-orders/:poId/vpos/:vpoId/void` | Void VPO |
| DELETE | `/api/purchase-orders/:poId/vpos/:vpoId` | Delete VPO |

**UI:** `public/js/po-modals.js` (lines 1038-1320)
- `renderVPOsSection()` - Renders VPO section in PO modal
- `renderVPOItem(vpo)` - Individual VPO card
- `showAddVPOModal()` / `editVPO()` / `voidVPO()` - Full CRUD

### Invoice Modal Variance Integration (PARTIAL)

**Current State:**
- `buildVarianceWarningsBanner(invoice)` in `modals.js` (lines 368-417)
- Displays warnings sorted by severity
- Shows PO summary (total, billed, remaining)
- NO action buttons to resolve variances

**Variance Detection Call:**
- Called in GET `/api/invoices/:id` route (invoices.js lines 205-209)
- Returns `variance` object attached to invoice

**Quick Variance Check Endpoint:**
- `GET /api/invoices/:id/variance-check?poId=xxx` exists
- NOT currently wired to UI

### CO Creation Patterns (Reference)

**From Allocation Link Picker:** `modals.js` lines 2150-2360
- `showCreateCOModal(allocationIndex)` - Full modal with form
- Creates CO via `POST /api/jobs/:jobId/change-orders`
- Links CO to allocation after creation

**From Selections Overage:** `selections.js` lines 753-820
- `createChangeOrder()` - Creates CO from allowance overage
- Uses `POST /api/selections/items/:id/create-co` endpoint

## Gaps Identified

### VAR-01: Variance Detection Service Polish

**Status:** Service is functionally complete

**Minor refinements needed:**
1. **Text similarity threshold** - Current 0.2 Jaccard may miss abbreviations (e.g., "Elec" vs "Electrical")
2. **Partial matching for model numbers** - Items like "Kohler K-6489-0" should fuzzy match
3. **Unit testing** - No test file exists for varianceDetector.js

**Suggested improvements:**
- Add token stemming (remove common suffixes)
- Add fuzzy model number matching
- Create test suite with edge cases

### VAR-02: Create CO/VPO from Warnings (NOT IMPLEMENTED)

**What's needed:**
1. **Add action buttons to variance banner** for unmatched line items:
   - "Create VPO" - Quick authorization
   - "Create CO" - Formal change order

2. **Wire up VPO creation from invoice modal:**
   - Need to know the PO ID (from invoice.po_id)
   - Pre-fill VPO form with unmatched item description and amount
   - After creation, re-run variance detection to update banner

3. **Wire up CO creation from invoice modal:**
   - Use existing `showCreateCOModal()` pattern but adapt for variance context
   - Pre-fill with unmatched item data
   - Use job's CO endpoint

**UI location:** Modify `buildVarianceWarningsBanner()` in `modals.js`

**Pattern to follow:** Similar to selections.js `createChangeOrder()` flow

### VAR-03: VPO UI Integration in PO Modal (COMPLETE)

**Status:** Already implemented in po-modals.js

**Existing features:**
- VPO section shows in Overview tab
- Create/Edit/Void actions work
- VPO totals update PO total automatically

**Only missing:**
- Link from invoice modal variance warnings to PO modal VPO section (minor UX enhancement)

## Technical Notes

### Key Files and Functions

| File | Function | Purpose |
|------|----------|---------|
| `server/services/varianceDetector.js` | `detectVariances()` | Main variance analysis |
| `server/services/varianceDetector.js` | `quickVarianceCheck()` | Fast budget check |
| `server/routes/invoices.js` | GET `/:id` | Calls detectVariances |
| `public/js/modals.js` | `buildVarianceWarningsBanner()` | Renders warning UI |
| `public/js/modals.js` | `showCreateCOModal()` | CO creation modal |
| `public/js/po-modals.js` | `showAddVPOModal()` | VPO creation modal |
| `server/routes/purchase-orders.js` | POST `/:poId/vpos` | Create VPO API |

### CSS Classes for Variance UI

Already defined in `styles.css` (lines 18271-18360):
```css
.variance-warnings-banner { }
.variance-banner-high { border-left-color: var(--accent-red); }
.variance-banner-medium { border-left-color: var(--accent-orange); }
.variance-warning { }
.variance-warning.variance-high { }
.variance-warning.variance-medium { }
.variance-icon { }
.variance-message { }
.variance-summary { }
```

### VPO CSS Classes

Already defined in `styles.css` (lines 27797-28042):
```css
.vpo-header-actions { }
.vpo-summary { }
.vpo-list { }
.vpo-item { }
.vpo-form-container { }
```

### Unmatched Item Data Structure

From `detectVariances()` result:
```javascript
{
  type: 'unmatched_line_item',
  severity: 'medium' | 'high',
  message: 'New line item not on PO: "..." ($X,XXX.XX)',
  details: {
    description: string,
    amount: number,
    isChangeOrder: boolean, // true if description contains "change order", "CO #", etc.
    isCredit: boolean      // true if amount < 0
  }
}
```

### VPO Creation Payload

For POST `/api/purchase-orders/:poId/vpos`:
```javascript
{
  description: string,  // Required
  reason: string,       // Optional
  amount: number,       // Required
  authorized_by: string,// Optional, defaults to 'system'
  authorized_date: string, // Optional, defaults to today
  notes: string         // Optional
}
```

### CO Creation Payload

For POST `/api/jobs/:jobId/change-orders`:
```javascript
{
  title: string,        // Required
  description: string,  // Optional
  reason: string,       // e.g., 'scope_change'
  status: string,       // 'approved', 'pending_approval', 'draft'
  days_added: number,   // Default 0
  base_amount: number,  // The cost
  gc_fee_percent: number,
  gc_fee_amount: number,
  amount: number        // Total (base + fee)
}
```

## Recommendations

### Task Breakdown for Planning

**VAR-01: Polish Variance Detection Service**
1. Add unit tests for varianceDetector.js (edge cases)
2. Consider token normalization for better matching
3. Document matching thresholds and their rationale

**VAR-02: Add Action Buttons to Variance Banner**
1. Modify `buildVarianceWarningsBanner()` to add buttons for `unmatched_line_item` warnings
2. Create `createVPOFromVariance(warning)` function
3. Create `createCOFromVariance(warning)` function
4. After VPO/CO creation, refresh variance state and update banner

**VAR-03: VPO UI Polish (already done)**
- Consider adding "View VPOs" link from invoice variance banner to PO modal
- No major work needed

### Implementation Order

1. **VAR-02 first** - Highest user value, enables workflow completion
2. **VAR-01 second** - Polish matching algorithms based on real usage feedback
3. **VAR-03** - Already complete, just minor UX links

### Code Pattern for VAR-02

```javascript
// In buildVarianceWarningsBanner(), for unmatched items:
if (w.type === 'unmatched_line_item') {
  const actions = w.details.isChangeOrder
    ? `<button class="btn-sm btn-secondary" onclick="window.Modals.createCOFromVariance(${JSON.stringify(w.details)})">Create CO</button>`
    : `<div class="variance-actions">
         <button class="btn-sm btn-secondary" onclick="window.Modals.createVPOFromVariance(${JSON.stringify(w.details)})">Quick VPO</button>
         <button class="btn-sm btn-secondary" onclick="window.Modals.createCOFromVariance(${JSON.stringify(w.details)})">Create CO</button>
       </div>`;
}
```

## Sources

### Primary (HIGH confidence)
- `server/services/varianceDetector.js` - Full implementation reviewed
- `server/routes/purchase-orders.js` - VPO API endpoints verified
- `public/js/po-modals.js` - VPO UI implementation verified
- `public/js/modals.js` - Variance banner and CO creation patterns
- `database/migration-065-vpo.sql` - Schema verified
- `public/css/styles.css` - CSS classes verified

### Project Documentation (HIGH confidence)
- `.planning/PROJECT.md` - Requirements reference
- `.planning/ROADMAP.md` - Phase requirements
- `CLAUDE.md` - System documentation

## Metadata

**Confidence breakdown:**
- Variance detector service: HIGH - Complete code review
- VPO implementation: HIGH - All layers verified (DB, API, UI)
- UI integration gaps: HIGH - Direct inspection confirmed missing features
- Matching algorithm quality: MEDIUM - No test data to validate edge cases

**Research date:** 2026-01-19
**Valid until:** 2026-02-19 (stable codebase)

---

## Summary of Work Required

| Requirement | Status | Effort | Priority |
|-------------|--------|--------|----------|
| VAR-01: Polish variance detection | 90% done | Low | 3 |
| VAR-02: Create CO/VPO from warnings | 0% done | Medium | 1 |
| VAR-03: VPO UI in PO modal | 100% done | None | - |

**Total estimated effort:** 1-2 tasks for VAR-02, optional polish for VAR-01
