# Kind-Creation Construction Management System

## Overview

React/TypeScript frontend integrated with Supabase backend. Uses database views to alias `v2_` prefixed tables to non-prefixed names.

**CRITICAL**: This codebase has a split architecture:
- **Views** (invoices, vendors, jobs, etc.) - For **READING** data
- **v2_ Tables** (v2_invoices, v2_vendors, v2_jobs, etc.) - For **WRITING** data
- **FK Joins only work on actual tables, NOT on views**

---

## Agentic Development Workflow

### BEFORE Writing Any Code

```
1. UNDERSTAND THE REQUEST
   - What exactly is the user asking for?
   - What is the expected behavior?
   - What are the success criteria?

2. EXPLORE THE CODEBASE
   - Find relevant files using Grep/Glob
   - Read the actual code, don't assume
   - Check existing patterns

3. VERIFY THE SCHEMA
   - Query the actual database tables to confirm column names
   - Don't trust memory - column names differ between tables and views
   - Run: curl to check schema before writing queries
```

### WHILE Writing Code

```
4. IMPLEMENT INCREMENTALLY
   - Make one change at a time
   - Don't make assumptions about column names or types

5. TEST EACH CHANGE
   - For database operations: Test with curl
   - For Edge Functions: Call with test data
   - For frontend: Check dev server for compile errors
```

### BEFORE Saying "It's Done"

```
6. VERIFICATION CHECKLIST (MANDATORY)
   [ ] Database query tested with curl
   [ ] Edge Function tested with curl (if applicable)
   [ ] Frontend compiles without errors
   [ ] Full data flow traced: UI → Hook → Database → Response → UI
   [ ] Logic test: Does it actually accomplish the user's request?

7. LOGIC TESTING
   - Manually trace the code path
   - Verify state changes happen in correct order
   - Check error handling paths
   - Verify UI reflects the expected state
```

---

## Testing Commands

### Database Schema Verification

```bash
# Check table columns (replace TABLE_NAME)
curl -s "https://sorghqcpeamdfbvysafj.supabase.co/rest/v1/TABLE_NAME?select=*&limit=1" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcmdocWNwZWFtZGZidnlzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1NjIyOCwiZXhwIjoyMDgzMDMyMjI4fQ.Y31vzEWbvR7F539vP3Nsc_WqhcTWojh03LY-a5I0YPY"
```

### Edge Function Testing

```bash
# Test Edge Function (replace FUNCTION_NAME and BODY)
curl -s -X POST "https://sorghqcpeamdfbvysafj.supabase.co/functions/v1/FUNCTION_NAME" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcmdocWNwZWFtZGZidnlzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1NjIyOCwiZXhwIjoyMDgzMDMyMjI4fQ.Y31vzEWbvR7F539vP3Nsc_WqhcTWojh03LY-a5I0YPY" \
  -d 'BODY'
```

### Deploy Edge Function

```bash
cd Kind-Creation-Combined
SUPABASE_ACCESS_TOKEN=sbp_ae9c44c729dc9bbdf2ea2815e03b1b5c3df4a26b \
  npx supabase functions deploy FUNCTION_NAME --project-ref sorghqcpeamdfbvysafj
```

---

## Database Schema Reference

### CRITICAL Column Name Differences

| Frontend Expects | v2_invoices Column | Notes |
|------------------|-------------------|-------|
| `stamped_pdf_url` | `pdf_stamped_url` | Must map in hook |
| `description` (allocations) | `notes` | v2_invoice_allocations uses `notes` |

| Frontend Expects | v2_purchase_orders Column | Notes |
|------------------|--------------------------|-------|
| `change_order_amount` | `change_order_total` | Different name |
| `current_amount` | Does not exist | Compute from original + change_order_total |
| `invoiced_amount` | Does not exist | Must compute from invoices |
| `remaining_amount` | Does not exist | Must compute |

### v2_invoices (Actual Table)

```
id, job_id, vendor_id, invoice_number, invoice_date, due_date, amount, status,
pdf_path, notes, created_at, approved_at, approved_by, po_id, pdf_url,
pdf_stamped_url, coded_at, coded_by, denied_at, denied_by, denial_reason,
deleted_at, ai_processed, ai_confidence, ai_extracted_data, ai_overrides,
needs_review, review_flags, version, paid_amount, closed_out_at, closed_out_by,
closed_out_reason, billed_amount, first_draw_id, fully_billed_at, paid_to_vendor,
paid_to_vendor_date, paid_to_vendor_amount, paid_to_vendor_ref, last_reconciled_at,
reconciliation_status, parent_invoice_id, is_split_parent, split_index,
original_amount, ai_split_suggested, ai_split_data, sent_back_at, sent_back_by,
sent_back_reason, invoice_type, paid_at, write_off_amount
```

**Valid status values**: `received`, `needs_review`, `needs_approval`, `approved`, `in_draw`, `paid`, `denied`

### v2_invoice_allocations (Actual Table)

```
id, invoice_id, cost_code_id, amount, notes, created_at, job_id,
po_line_item_id, change_order_id, po_id, pending_co
```

**Note**: Uses `notes` NOT `description`

### v2_purchase_orders (Actual Table)

```
id, job_id, vendor_id, po_number, description, total_amount, status,
created_at, created_by, status_detail, approval_status, approved_at, approved_by,
rejection_reason, closed_at, closed_by, closed_reason, original_amount,
change_order_total, notes, scope_of_work, expected_completion_date, version,
updated_at, deleted_at, assigned_to, schedule_start_date, schedule_end_date,
schedule_notes, contact_name, contact_phone, contact_email, title,
job_change_order_id, source_bid_id, vpo_total
```

### v2_draws (Actual Table)

```
id, job_id, draw_number, period_end, total_amount, status, submitted_at,
funded_at, funded_amount, created_at, funding_difference, partial_funding_note,
is_current_draft, cached_g702_pdf_url, cached_g703_pdf_url, locked_at,
unsubmitted_at, unsubmit_reason, notes, g702_original_contract_override,
g702_change_orders_override, retainage_percent, updated_at, last_reconciled_at,
reconciliation_status
```

---

## Code Patterns

### Reading Data (Use Views - OK for FK joins simulation)

```typescript
// For simple reads without FK joins, views work fine
const { data } = await supabase
  .from('invoices')  // View is OK for reads
  .select('*')
  .eq('id', id);
```

### Reading Data WITH FK Joins (Use v2_ Tables)

```typescript
// FK joins ONLY work on actual tables, NOT views!
const { data } = await supabase
  .from('v2_invoices')  // Must use actual table
  .select(`
    *,
    v2_vendors (id, name),
    v2_jobs (id, name),
    v2_invoice_allocations (
      id, cost_code_id, amount, notes,
      v2_cost_codes (id, code, name)
    )
  `)
  .eq('id', id);

// Then map the response
return {
  ...data,
  vendor_name: data.v2_vendors?.name,
  job_name: data.v2_jobs?.name,
  stamped_pdf_url: data.pdf_stamped_url,  // Map column name!
  allocations: data.v2_invoice_allocations?.map(a => ({
    ...a,
    description: a.notes,  // Map column name!
    cost_code: a.v2_cost_codes?.code,
  })),
};
```

### Writing Data (ALWAYS Use v2_ Tables)

```typescript
// NEVER write to views - they don't have triggers
// ALWAYS use v2_ tables for insert/update/delete

// BAD - will silently fail or error
await supabase.from('invoices').update({...})

// GOOD
await supabase.from('v2_invoices').update({...})
```

---

## Feature Implementation Checklist

When implementing any feature, complete this checklist:

### 1. Schema Verification
- [ ] Queried actual table to confirm column names
- [ ] Identified any column name differences (table vs frontend types)
- [ ] Checked if feature needs FK joins (if so, use v2_ tables)

### 2. Code Implementation
- [ ] Used correct table (v2_ for writes, either for reads)
- [ ] Mapped column names where they differ
- [ ] Added all required fields for inserts

### 3. Testing
- [ ] Tested database operation with curl
- [ ] Tested Edge Function with curl (if applicable)
- [ ] Verified frontend compiles
- [ ] Tested full user flow in browser

### 4. Logic Verification
- [ ] Traced complete data flow
- [ ] Verified state changes occur correctly
- [ ] Checked UI updates reflect changes
- [ ] Tested error scenarios

---

## Common Pitfalls (Things That Break)

### 1. FK Joins on Views
**Symptom**: Query returns null for related data
**Fix**: Use v2_ tables instead of views for queries with FK joins

### 2. Column Name Mismatches
**Symptom**: "column does not exist" errors
**Fix**: Always verify column names with curl before writing queries

### 3. Writing to Views
**Symptom**: Updates silently fail, data doesn't change
**Fix**: Always use v2_ tables for insert/update/delete

### 4. Missing Required Fields
**Symptom**: Insert fails with constraint error
**Fix**: Check table schema for required fields (e.g., job_id on allocations)

### 5. Status Value Mismatches
**Symptom**: Records don't appear in UI filters
**Fix**: Use exact status values: `received`, `needs_review`, `needs_approval`, `approved`, `in_draw`, `paid`, `denied`

---

## Edge Functions

### stamp-invoice
Stamps PDF with approval/status badge.

**Endpoint**: `POST /functions/v1/stamp-invoice`
**Body**: `{ "invoiceId": "uuid", "status": "approved" }`
**Returns**: `{ "success": true, "stamped_pdf_url": "..." }`

**Test**:
```bash
curl -s -X POST "https://sorghqcpeamdfbvysafj.supabase.co/functions/v1/stamp-invoice" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcmdocWNwZWFtZGZidnlzYWZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzQ1NjIyOCwiZXhwIjoyMDgzMDMyMjI4fQ.Y31vzEWbvR7F539vP3Nsc_WqhcTWojh03LY-a5I0YPY" \
  -d '{"invoiceId":"INVOICE_UUID","status":"approved"}'
```

### extract-invoice
AI extraction of invoice data from PDF.

### extract-po
AI extraction of PO data.

### extract-prices
Price intelligence extraction.

### send-po-email
Email PO to vendor.

---

## File Structure

```
src/
├── components/
│   └── invoices/
│       └── InvoiceDetailDialog.tsx  # Invoice detail modal
├── hooks/
│   ├── useFinancialData.ts          # Main data hooks (invoices, POs, draws)
│   ├── useInvoiceStamping.ts        # Stamping hooks
│   └── useDrawMutations.ts          # Draw-related mutations
├── pages/
│   └── Invoices.tsx                 # Invoice list page
└── types/
    └── financial.ts                 # TypeScript types

supabase/
└── functions/
    └── stamp-invoice/
        └── index.ts                 # PDF stamping Edge Function
```

---

## Quick Reference

### Supabase Project
- **Project Ref**: sorghqcpeamdfbvysafj
- **URL**: https://sorghqcpeamdfbvysafj.supabase.co

### Invoice Statuses
```typescript
type InvoiceStatus = 'received' | 'needs_review' | 'needs_approval' | 'approved' | 'in_draw' | 'paid' | 'denied';
```

### Key Type Mappings
```typescript
// Frontend type → Database column
stamped_pdf_url → pdf_stamped_url
description (allocation) → notes
change_order_amount → change_order_total
```

---

## Pre-Implementation Ritual

Before implementing ANY feature, run through this:

1. **What tables are involved?**
2. **Will I need FK joins?** (If yes → use v2_ tables)
3. **Will I be writing data?** (If yes → use v2_ tables)
4. **What columns do I need?** (Verify with curl)
5. **What are the exact column names?** (Don't assume - check!)
6. **What status values are valid?** (Check the enum)
7. **How will I test this?** (Write the curl command first)
