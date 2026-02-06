# Financial Module Audit Report
**Date:** 2026-02-05
**Status:** Critical issues found - not production ready

---

## Executive Summary

The financial module has **fundamental schema mismatches** between the frontend, API validation, and database. These prevent basic CRUD operations from working.

---

## Critical Issues Found

### 1. Jobs API - CREATE fails with 400 (BLOCKING)

**Root Cause:** Triple mismatch between frontend, API, and database

| Field | Frontend Sends | API Accepts | Database Column |
|-------|---------------|-------------|-----------------|
| Client name | `client` | `client_name` | `client_name` |
| Status | `'planning'` | `['active','completed','on_hold','cancelled']` | `TEXT` |
| Budget | `budget_amount` | NOT ACCEPTED | NOT IN v2_jobs |
| Start date | `start_date` | NOT ACCEPTED | `estimated_start` |
| End date | `end_date` | NOT ACCEPTED | `estimated_completion` |
| % Complete | `percent_complete` | NOT ACCEPTED | NOT IN v2_jobs |
| Project manager | `project_manager` | NOT ACCEPTED | NOT IN v2_jobs |
| Site supervisor | `site_supervisor` | NOT ACCEPTED | NOT IN v2_jobs |
| Architect | `architect` | NOT ACCEPTED | `architect` (exists) |
| Engineer | `engineer` | NOT ACCEPTED | `engineer` (exists) |

**Files involved:**
- `client/src/components/jobs/JobFormDialog.tsx` - sends wrong field names
- `server/middleware/validate.js:229-235` - jobCreateSchema too restrictive
- `database/schema.sql:5-13` - base v2_jobs table minimal
- `database/migration-035-job-specs.sql` - adds architect/engineer but not others

### 2. New Job Button - Fixed
**Status:** FIXED in this session
- `client/src/components/layout/JobSidebar.tsx` - button had no onClick handler
- Added JobFormDialog integration

### 3. Auth - Fixed
**Status:** FIXED in this session
- Signup route wasn't in PUBLIC_ROUTES
- Authorization header caching fixed

---

## Schema Analysis

### v2_jobs Current Columns (from migrations):
```
Base: id, name, address, client_name, contract_amount, status, created_at
047:  deleted_at, updated_at
035:  sqft_*, bedrooms, bathrooms, half_baths, stories, garage_spaces,
      ac_units, pool_type, construction_type, foundation_type, roof_type,
      exterior_finish, year_built, zoning, flood_zone, parcel_id,
      architect, engineer, permit_number, permit_date,
      estimated_start, estimated_completion, actual_start, actual_completion,
      specs_notes, custom_specs
036:  100+ detailed spec columns (structural, plumbing, electrical, HVAC, etc.)
077:  phase_current, phase_count, milestone_progress
```

### MISSING from v2_jobs (frontend expects):
- `client` (uses `client_name` instead)
- `budget_amount`
- `start_date` / `end_date` (uses `estimated_start` / `estimated_completion`)
- `percent_complete`
- `project_manager`
- `site_supervisor`
- `client_email`
- `client_phone`
- `client_cell`
- `square_footage` (uses `sqft_conditioned` / `sqft_total`)
- `target_margin`
- `retainage_percent`
- `notes` (uses `specs_notes`)

### API Validation Too Restrictive:
```javascript
// Current (server/middleware/validate.js:229-235)
const jobCreateSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  client_name: z.string().max(200).optional(),
  contract_amount: moneySchema.optional(),
  status: z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional()
});
```

Needs to accept ALL fields from migration-035/036 plus mapped aliases.

---

## Other APIs Audited

### Invoice API - Looks OK
- Schema accepts: job_id, vendor_id, po_id, invoice_number, invoice_date, due_date, amount, status, notes
- Status enum defined properly

### PO API - Looks OK
- Schema accepts: job_id, vendor_id, description, scope_of_work, notes, line_items
- Requires at least one line item

### Draw API - Looks OK
- Schema accepts: period_end (minimal)
- Update accepts more fields

### Budget API - Not validated (uses direct Supabase)
- Need to verify route implementations

---

## Priority Fix List

### P0 - Blocking (Must fix to use the app)

1. **Align Job API schema with frontend/database**
   - Add missing columns to v2_jobs: `budget_amount`, `percent_complete`, `project_manager`, `site_supervisor`, `client_email`, `client_phone`, `client_cell`, `target_margin`, `retainage_percent`
   - OR map frontend fields to existing columns (client→client_name, start_date→estimated_start)
   - Update API validation schema to accept all fields
   - Update API route handler to use correct column names

2. **Fix status enum mismatch**
   - Frontend sends: `'planning'`
   - API accepts: `['active', 'completed', 'on_hold', 'cancelled']`
   - Add `'planning'`, `'pre_construction'`, `'warranty'`, `'closed'` to enum

### P1 - High Priority

3. **Add database migration for missing v2_jobs columns**
   ```sql
   ALTER TABLE v2_jobs
   ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(14,2),
   ADD COLUMN IF NOT EXISTS percent_complete DECIMAL(5,2) DEFAULT 0,
   ADD COLUMN IF NOT EXISTS project_manager TEXT,
   ADD COLUMN IF NOT EXISTS site_supervisor TEXT,
   ADD COLUMN IF NOT EXISTS client_email TEXT,
   ADD COLUMN IF NOT EXISTS client_phone TEXT,
   ADD COLUMN IF NOT EXISTS client_cell TEXT,
   ADD COLUMN IF NOT EXISTS target_margin DECIMAL(5,2),
   ADD COLUMN IF NOT EXISTS retainage_percent DECIMAL(5,2) DEFAULT 10,
   ADD COLUMN IF NOT EXISTS notes TEXT;
   ```

4. **Align field names (choose one approach):**
   - Option A: Change frontend to use database column names
   - Option B: Add API layer translation (frontend names → database names)
   - Recommendation: Option A (simpler, less magic)

### P2 - Medium Priority

5. **Test all Invoice CRUD operations**
6. **Test all PO CRUD operations**
7. **Test all Draw CRUD operations**
8. **Test Budget operations**
9. **Test manual draw line items (non-invoice entries)**

### P3 - Low Priority

10. **Remove hardcoded values audit**
11. **Add comprehensive error messages**
12. **Add field validation feedback in UI**

---

## Recommended Fix Order

1. Create database migration for missing columns (10 min)
2. Update API validation schema (10 min)
3. Update API route to handle all fields (15 min)
4. Fix frontend field name mapping OR update frontend forms (20 min)
5. Test job creation end-to-end
6. Then proceed to test Invoice/PO/Draw/Budget

---

## Files to Modify

| File | Changes Needed |
|------|----------------|
| `database/migration-XXX-job-fields.sql` | New - add missing columns |
| `server/middleware/validate.js` | Expand jobCreateSchema |
| `server/routes/jobs.js` | Update POST handler |
| `client/src/components/jobs/JobFormDialog.tsx` | Map field names OR use correct names |
| `client/src/hooks/useJobs.ts` | Check Job type definition |
