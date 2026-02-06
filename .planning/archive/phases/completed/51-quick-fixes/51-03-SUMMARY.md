# Summary: Enhanced Error Messages with Actionable Guidance

## Plan Reference
- Phase: 51 (Quick Fixes)
- Plan: 03
- Wave: 1
- Complexity: S

## Objective

Enhance all validation error messages to include clear, actionable guidance explaining what's wrong and how to fix it.

## Requirements Addressed

- **FIX-03**: Clear error messages showing what's wrong and how to fix - actionable guidance, not just errors

## Completed Tasks

### Task 1: Created Standardized Error Helper Module
Created `server/validation-errors.js` with:
- `createValidationError()` - Standard error object creator
- `createValidationWarning()` - Convenience wrapper for warnings
- `createDetailedFixHint()` - Context-aware fix hints with amounts
- `formatAmount()` - Currency formatting helper
- Default messages (ERROR_MESSAGES) and fix hints (FIX_HINTS) for all error types:
  - Linkage errors: ORPHANED_PO_ALLOCATION, ORPHANED_LINE_ITEM_ALLOCATION, ORPHANED_CO_ALLOCATION, DRAW_STATUS_MISMATCH, ALLOCATION_SUM_EXCEEDS_INVOICE, INVOICE_PO_NO_ALLOCATIONS
  - PO total errors: CO_TOTAL_MISMATCH, PO_TOTAL_MISMATCH, VPO_NOT_TRACKED, CO_NOT_IN_BUDGET
  - Budget errors: OVER_COMMITTED, OVER_BILLED, APPROACHING_LIMIT, WOULD_EXCEED_BUDGET

### Task 2: Updated Invoice Linkage Validation
Updated `server/routes/invoices.js` validate-linkages endpoint:
- All 6 error/warning types now use standardized helpers
- Errors include detailed `details` objects with amounts and IDs
- Fix hints are context-aware with specific amounts

### Task 3: Updated Budget Accuracy Validation
Updated `server/routes/jobs.js` budget-accuracy endpoint:
- OVER_COMMITTED and OVER_BILLED errors use createValidationError
- APPROACHING_LIMIT warnings use createValidationWarning
- WOULD_EXCEED_BUDGET what-if warnings standardized
- All include percent_over calculations and detailed amounts

### Task 4: Updated PO Total Validation
Updated `server/routes/purchase-orders.js` validate-totals endpoint:
- CO_TOTAL_MISMATCH and PO_TOTAL_MISMATCH errors standardized
- VPO_NOT_TRACKED and CO_NOT_IN_BUDGET warnings standardized
- All messages include formatted currency amounts

## Verification

- [x] All validation endpoints use standardized error structure
- [x] Every error type has a default message and fix_hint
- [x] Error objects include relevant context (IDs, amounts, discrepancies)
- [x] Warnings are clearly marked with severity: 'warning'
- [x] fix_hint text is actionable (verb-first, specific)

## Files Changed

| File | Change |
|------|--------|
| server/validation-errors.js | New file - error helper functions |
| server/routes/invoices.js | Updated validate-linkages endpoint |
| server/routes/jobs.js | Updated budget-accuracy endpoint |
| server/routes/purchase-orders.js | Updated validate-totals endpoint |

## Error Object Structure

All validation errors now follow this consistent structure:

```javascript
{
  type: 'ERROR_TYPE',           // Constant identifier
  severity: 'error' | 'warning', // Severity level
  message: 'What went wrong',   // Human-readable description
  fix_hint: 'How to fix it',    // Actionable guidance
  invoice_id: '...',            // (optional) Related entity IDs
  po_id: '...',
  po_number: '...',
  cost_code: '...',
  cost_code_id: '...',
  allocation_id: '...',
  details: {                    // Additional context
    // Specific to error type
  }
}
```

## Example Error Output

```javascript
// OVER_COMMITTED error
{
  type: 'OVER_COMMITTED',
  severity: 'error',
  message: 'Cost code 06100 committed $5,000.00 over budget',
  fix_hint: 'Cost code 06100 is over budget by $5,000.00. Increase budget, reduce commitments, or reallocate to another cost code.',
  cost_code: '06100',
  cost_code_id: 'uuid-123',
  cost_code_name: 'Rough Carpentry',
  details: {
    budgeted: 50000,
    committed: 55000,
    excess: 5000,
    percent_over: '10.0'
  }
}
```

## Commits

1. `feat(51-03): create standardized validation error helpers`
2. `refactor(51-03): standardize validate-linkages error messages`
3. `refactor(51-03): standardize budget-accuracy error messages`
4. `refactor(51-03): standardize validate-totals error messages`
