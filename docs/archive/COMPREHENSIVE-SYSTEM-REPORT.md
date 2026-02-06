# COMPREHENSIVE SYSTEM REPORT
## Ross Built Construction Management Software
## Complete Analysis & Strategic Roadmap

**Analysis Date:** January 31, 2026
**Codebase Size:** 46,000+ lines of route code, 7,200+ lines of hooks, 130+ migrations
**System Scale:** 227+ database tables, 600+ API endpoints, 35 pages, 100+ components

---

# EXECUTIVE SUMMARY

## Current State Assessment

| Layer | Status | Grade | Critical Issues |
|-------|--------|-------|-----------------|
| **Database** | Feature-rich but fragmented | C+ | No users table, 40+ orphaned tables, status enum chaos |
| **API** | Extensive but unsecured | C | 0% authorization, 0% transactions, inconsistent patterns |
| **Frontend** | Good foundation, incomplete | B- | 8 placeholder pages, missing forms, no validation |
| **Data Layer** | Functional but inefficient | C | Duplicate hooks, no caching, over-invalidation |

## Key Statistics

```
DATABASE:
├── 227+ tables created across 131 migrations
├── 40+ tables confirmed orphaned/unused
├── 23 tables missing created_at timestamps
├── 0 tables with proper user FK (no auth system)
└── 3 different status enum patterns

API:
├── 600+ endpoints across 63 route files
├── 0% authorization enforcement
├── 0% database transaction usage
├── ~15% pagination support
└── 12+ duplicate/overlapping endpoints

FRONTEND:
├── 35 pages (27 implemented, 8 placeholder)
├── 100+ components
├── 6 TODO comments for incomplete features
├── 0% form validation library usage
└── 3 different dialog patterns

HOOKS:
├── 30 custom hooks
├── 4 duplicate hook pairs (useJobs, useVendors, useChangeOrders)
├── 0% optimistic updates
├── 0% staleTime configuration
└── 14 missing hooks for existing endpoints
```

---

# PART 1: WHAT EXISTS (Complete Inventory)

## 1.1 Database Tables by Domain

### Financial Core (Mature - 17 tables)
```
v2_invoices              ✓ Full CRUD, AI processing, stamping
v2_invoice_allocations   ✓ Cost code splits
v2_invoice_activity      ✓ Audit trail
v2_invoice_hashes        ✓ Duplicate detection
v2_purchase_orders       ✓ Full lifecycle management
v2_po_line_items         ✓ Cost code breakdown
v2_po_activity           ✓ Audit trail
v2_po_attachments        ✓ Document storage
v2_change_orders         ✓ CO management
v2_change_order_line_items ✓ CO breakdown
v2_draws                 ✓ G702/G703 generation
v2_draw_invoices         ✓ Draw contents
v2_draw_allocations      ✓ Cost code breakdown
v2_draw_attachments      ✓ Documents
v2_draw_activity         ✓ Audit trail
v2_budget_lines          ✓ Job budgets by cost code
v2_lien_releases         ✓ Lien waivers
```

### Project Management (Mature - 15 tables)
```
v2_jobs                  ✓ Project records
v2_job_specifications    ✓ 200+ spec fields
v2_job_milestones        ✓ Project phases
v2_job_activity          ✓ Audit trail
v2_schedules             ✓ Project schedules
v2_schedule_tasks        ✓ Task management
v2_schedule_activity     ✓ Audit trail
v2_daily_logs            ✓ Field reports
v2_daily_log_crew        ✓ Worker tracking
v2_daily_log_deliveries  ✓ Material receipts
v2_daily_log_attachments ✓ Photos
v2_daily_log_activity    ✓ Audit trail
v2_tasks                 ✓ Task management
v2_task_comments         ✓ Collaboration
v2_task_checklists       ✓ Subtasks
```

### Bidding System (Recent - 9 tables)
```
v2_bids                  ✓ Bid packages
v2_bid_documents         ✓ Specs/drawings
v2_bid_package_templates ✓ Reusable templates
v2_bid_template_checklist ✓ Template items
v2_bid_activity          ✓ Audit trail
v2_subcontractor_bids    ✓ Vendor submissions
v2_subcontractor_bid_documents ✓ Vendor proposals
v2_bid_package_invites   ✓ Vendor invitations
v2_bid_lines             ✓ Line items
```

### Estimates & Proposals (Complex - 15 tables)
```
v2_estimates             ✓ Cost estimates
v2_estimate_lines        ✓ Line items
v2_estimate_sections     ✓ Sections
v2_estimate_groups       ✓ Groups
v2_estimate_phases       ✓ Phases
v2_estimate_activity     ✓ Audit trail
v2_estimate_versions     ✓ Version control
v2_estimate_conversions  ✓ Budget conversion
v2_ai_estimates          ✓ AI-generated
v2_ai_estimate_lines     ✓ AI line items
v2_proposals             ✓ Client proposals
v2_contracts             ✓ Contracts
v2_contract_signers      ✓ Signers
v2_contract_activity     ✓ Audit trail
```

### Selections & Catalog (Extensive - 20 tables)
```
v2_selections            ✓ Client selections
v2_selection_catalog     ✓ Product database
v2_selection_categories  ✓ Categories
v2_selection_bundles     ✓ Bundles
v2_selection_bundle_items ✓ Bundle contents
v2_selection_status_history ✓ Selection history
v2_allowances            ✓ Budget allowances
v2_catalog_brands        ✓ Brand tracking
v2_catalog_images        ✓ Product images
v2_catalog_trades        ✓ Trade categories
v2_catalog_recent        ✓ Recent items
v2_catalog_favorites     ✓ Favorites
v2_catalog_labor_feedback ✓ Labor feedback
v2_catalog_knowledge     ✓ Product knowledge
v2_catalog_dependencies  ✓ Item dependencies
```

### Reference Data (Core - 8 tables)
```
v2_vendors               ✓ Subcontractor directory
v2_cost_codes            ✓ Budget categories
v2_contacts              ✓ Contact directory
v2_companies             ✓ Company records
v2_employees             ✓ Employee records
v2_crew_members          ✓ Team members
v2_leads                 ✓ Sales leads
v2_lead_activities       ✓ Lead activity
```

### Quality & Compliance (Exists - 15 tables)
```
v2_inspections           ✓ Quality checks
v2_inspection_attachments
v2_inspection_deficiencies
v2_punch_lists           ✓ Punch lists
v2_punch_list_items
v2_punch_list_photos
v2_permits               ✓ Permits
v2_permit_documents
v2_permit_inspections
v2_warranties            ✓ Warranties
v2_warranty_claims
v2_rfis                  ✓ Requests for Info
v2_rfi_responses
v2_submittals            ✓ Submittals
v2_submittal_items
```

### Performance Intelligence (New - 10 tables)
```
v2_scope_categories      ✓ 27 work types
v2_scope_tracking        ✓ Performance tracking
v2_subcontractor_performance ✓ Vendor scores
v2_vendor_trade_scores   ✓ Trade-specific scores
v2_productivity_records  ✓ Productivity data
v2_cost_performance_history ✓ Cost tracking
v2_trade_performance_benchmarks ✓ Benchmarks
v2_quality_metrics       ✓ Quality scores
v2_historical_pricing    ✓ Price history
v2_price_confidence      ✓ Confidence scores
```

### Infrastructure (System - 10 tables)
```
v2_entity_locks          ✓ 5-min edit locks
v2_undo_queue            ✓ 30-sec undo
v2_approval_thresholds   ✓ Auto-approval rules
v2_ai_learning           ✓ AI corrections
v2_ai_feedback           ✓ User feedback
v2_notifications         ✓ User alerts
v2_notification_preferences ✓ Settings
v2_messages              ✓ Messaging
v2_communications        ✓ Email/SMS tracking
schema_migrations        ✓ Migration tracking
```

### Orphaned/Unused (40+ tables)
```
v2_business_plans, v2_category_benchmarks, v2_burden_classes,
v2_cost_pools, v2_crew_availability, v2_description_cost_mappings,
v2_extraction_templates, v2_external_sync, v2_financial_snapshots,
v2_job_overhead_allocations, v2_kpi_definitions, v2_master_items,
v2_naming_conventions, v2_optimized_orders, v2_overhead_rates,
v2_plan_actuals, v2_recurring_expenses, v2_revenue_categories,
v2_scope_templates, v2_system_health_metrics, v2_trade_metrics,
v2_verbal_purchase_orders, v2_waste_factors, and 20+ more...
```

---

## 1.2 API Endpoints by Domain

### Invoices (30 endpoints)
```
GET    /api/invoices                    List with filters
GET    /api/invoices/needs-review       Review queue
GET    /api/invoices/low-confidence     AI flagged
GET    /api/invoices/no-job             Unassigned
GET    /api/invoices/:id                Single invoice
GET    /api/invoices/:id/activity       Audit log
GET    /api/invoices/:id/allocations    Cost splits
GET    /api/invoices/:id/family         Parent + children
POST   /api/invoices/upload             Direct upload
POST   /api/invoices/process            AI extraction
POST   /api/invoices/process-batch      Batch AI
PATCH  /api/invoices/:id                Update
POST   /api/invoices/:id/allocate       Set allocations
POST   /api/invoices/:id/transition     Status change
POST   /api/invoices/:id/stamp          PDF approval
POST   /api/invoices/:id/split          Split invoice
POST   /api/invoices/:id/unsplit        Merge back
POST   /api/invoices/bulk/approve       Bulk approve
POST   /api/invoices/bulk/deny          Bulk deny
POST   /api/invoices/bulk/add-to-draw   Bulk add
DELETE /api/invoices/:id                Soft delete
```

### Purchase Orders (31 endpoints)
```
GET    /api/purchase-orders             List with filters
GET    /api/purchase-orders/stats       Status breakdown
GET    /api/purchase-orders/:id         Full PO detail
GET    /api/purchase-orders/:id/activity Audit log
GET    /api/purchase-orders/:id/invoices Linked invoices
GET    /api/purchase-orders/:id/attachments Documents
POST   /api/purchase-orders             Create PO
PATCH  /api/purchase-orders/:id         Update PO
DELETE /api/purchase-orders/:id         Soft delete
POST   /api/purchase-orders/:id/submit  Submit for approval
POST   /api/purchase-orders/:id/approve Approve
POST   /api/purchase-orders/:id/reject  Reject
POST   /api/purchase-orders/:id/close   Close PO
POST   /api/purchase-orders/:id/reopen  Reopen
POST   /api/purchase-orders/:id/void    Void
POST   /api/purchase-orders/:id/send    Email to vendor
POST   /api/purchase-orders/:id/attachments Upload
GET    /api/purchase-orders/:id/change-orders CO list
POST   /api/purchase-orders/:id/change-orders Create CO
POST   /api/purchase-orders/:id/change-orders/:coId/approve
POST   /api/purchase-orders/:id/change-orders/:coId/reject
DELETE /api/purchase-orders/:poId/change-orders/:coId
```

### Draws (14 endpoints)
```
GET    /api/draws                       List all
GET    /api/draws/:id                   With G702/G703
GET    /api/draws/:id/activity          Audit log
GET    /api/draws/:id/validate          Pre-submit check
PATCH  /api/draws/:id                   Update
POST   /api/draws/:id/add-invoices      Add invoices
POST   /api/draws/:id/remove-invoice    Remove invoice
PATCH  /api/draws/:id/submit            Submit
POST   /api/draws/:id/unsubmit          Unsubmit
PATCH  /api/draws/:id/fund              Mark funded
DELETE /api/draws/:id                   Delete
POST   /api/draws/:id/recalculate       Force recalc
POST   /api/draws/:id/repair-allocations Fix orphans
POST   /api/jobs/:id/draws              Create draw
```

### Jobs (28 endpoints)
```
GET    /api/jobs                        List all
GET    /api/jobs/:id                    Job detail
POST   /api/jobs                        Create
PATCH  /api/jobs/:id                    Update
DELETE /api/jobs/:id                    Soft delete
GET    /api/jobs/:id/activity           Audit log
GET    /api/jobs/:id/budget             Budget vs actual
GET    /api/jobs/:id/metrics            Key metrics
GET    /api/jobs/:id/stats              Counts and totals
GET    /api/jobs/:id/hub                Overview
GET    /api/jobs/:id/purchase-orders    POs for job
GET    /api/jobs/:id/draws              Draws for job
GET    /api/jobs/:id/milestones         Milestones
POST   /api/jobs/:id/milestones         Create milestone
PATCH  /api/jobs/milestones/:id         Update milestone
POST   /api/jobs/milestones/:id/complete Complete
DELETE /api/jobs/milestones/:id         Delete
POST   /api/jobs/:id/milestones/bulk    Bulk create
GET    /api/jobs/:id/specs              Specifications
PATCH  /api/jobs/:id/specs              Update specs
POST   /api/jobs/extract-specs          AI extraction
GET    /api/jobs/:id/scope-estimates    Scope estimates
```

### Bids (45 endpoints)
```
Bid Packages: GET, POST, PATCH, DELETE /api/bids/*
Documents: GET, POST, DELETE /api/bids/:id/documents/*
Invites: GET, POST, DELETE /api/bids/:id/invites/*
Submissions: GET, POST, PATCH, DELETE /api/bids/:id/submissions/*
Extraction: POST /api/bids/:id/extract-from-document
Templates: Full CRUD /api/bids/templates/*
Awards: POST /api/bids/:id/award, /api/bids/:id/convert-to-po
```

### Estimates (55 endpoints)
```
Core: GET, POST, PATCH, DELETE /api/estimates/*
Sections: Full CRUD + reorder
Lines: Full CRUD + reorder
Assemblies: Full CRUD + toggle
Workflow: submit, approve, reject, new-version
Conversion: convert-to-budget, from-selections, import-from-bid
AI: analyze-scope, duplicate
```

### Selections (65 endpoints)
```
Selections: Full CRUD
Categories: Full CRUD
Allowances: Full CRUD
Catalog: Full CRUD + images + trades + dependencies + knowledge
Items: Full CRUD + status + approval
Bundles: Full CRUD + use
Favorites: Full CRUD
Stats, popular, featured, new
```

### Other Domains
```
Vendors:       20+ endpoints (CRUD, scorecard, reviews, incidents)
Cost Codes:    7 endpoints (CRUD, trade mappings)
Daily Logs:    20+ endpoints (CRUD, crew, photos, AI analysis)
Schedules:     35+ endpoints (CRUD, tasks, Gantt, critical path)
Reports:       20+ endpoints (job-cost, vendor-spend, performance)
Leads:         20+ endpoints (CRUD, pipeline, convert)
Crew:          22+ endpoints (members, requests, schedules)
Permits:       15+ endpoints (CRUD, inspections)
Punch Lists:   16+ endpoints (CRUD, items, verify)
Timesheets:    16+ endpoints (CRUD, batches, bulk)
```

---

## 1.3 Frontend Pages & Components

### Fully Implemented Pages (19)
```
Dashboard        ✓ KPIs, charts, recent activity
Invoices         ✓ List, upload, AI processing, approval
PurchaseOrders   ✓ List, detail, line items, COs
Draws            ✓ List, G702/G703, funding
ChangeOrders     ✓ List, detail, approval
Jobs             ✓ List, detail, budget
Estimates        ✓ Builder, sections, versioning
Bids             ✓ Packages, submissions, comparison
Vendors          ✓ Directory, CRUD
CostCodes        ✓ CRUD
Selections       ✓ Catalog, items, approval
Leads            ✓ Kanban board, pipeline
Employees        ✓ CRUD
Schedule         ✓ Calendar, list, Gantt views
DailyLogs        ✓ List, entries, photos
Budget           ✓ Dashboard, by cost code
LienReleases     ✓ List (download TODO)
Proposals        ✓ Basic implementation
JobDetails       ✓ Full job dashboard
```

### Partially Implemented Pages (8)
```
Expenses         ⚠ Placeholder
Permits          ⚠ Placeholder
Tasks            ⚠ Placeholder
Files            ⚠ Placeholder
Contracts        ⚠ Placeholder
Warranties       ⚠ Placeholder
FinalDocs        ⚠ Placeholder
Profitability    ⚠ Placeholder
```

### Key Components by Domain

**Invoices (8 components)**
- InvoiceDetailDialog (500+ lines)
- AIConfidenceBadge
- ReviewFlagsBadges
- CostCodeSuggestions
- AIMatchedEntityCard
- PaymentStatusBadge
- BulkInvoiceUploadDialog
- RecordPaymentDialog

**Purchase Orders (9 components)**
- PODetailPanel (tabs: Overview, Lines, Invoices, COs, Activity)
- POFormDialog (with scope tracking)
- POTable, POStats
- POLineItemsEditor
- POEditableField
- SendPOEmailDialog
- POUploadDialog

**Draws (7 components)**
- DrawDetailPanel (G702/G703 tabs)
- DrawFormDialog
- DrawTable, DrawStats
- FundDrawDialog
- COInvoicesDialog

**Estimates (14 components)**
- EstimateBuilder (500+ lines)
- DBEstimateBuilder
- EstimateDetailDialog
- EstimateFormDialog
- EnhancedSectionManager
- HierarchicalSectionManager
- LineItemForm
- SaveAsTemplateDialog
- DraggableLineItem

**UI Library (50+ shadcn/ui components)**
- Button, Input, Select, Textarea
- Dialog, Drawer, Sheet
- Tabs, Table, Card
- Badge, Alert, Tooltip
- Dropdown, Combobox
- Calendar, DatePicker
- Skeleton, Progress

---

## 1.4 Data Hooks Inventory

### Primary Hooks (30 total)
```
useFinancialData.ts     618 LOC - Jobs, vendors, invoices, POs, draws, COs, budget
useBidPackages.ts       913 LOC - Full bid management
useBudget.ts            140 LOC - Budget lines, summaries
useInvoiceAI.ts         260 LOC - AI extraction
useInvoiceStamping.ts   218 LOC - PDF stamping
useDrawMutations.ts     243 LOC - Draw operations
useChangeOrders.ts      161 LOC - CO CRUD
useJobs.ts              134 LOC - Job CRUD (DUPLICATE)
useVendors.ts           112 LOC - Vendor CRUD (DUPLICATE)
useCostCodes.ts         52 LOC  - Cost code fetching
useEstimates.ts         281 LOC - Local state estimates (NO SERVER SYNC)
useEstimateHierarchy.ts 503 LOC - Complex hierarchy (NO SERVER SYNC)
useAILearning.ts        135 LOC - AI corrections
useBulkInvoiceUpload.ts 183 LOC - Batch upload queue
useDailyLogs.ts         531 LOC - Daily log entries
useDBEstimates.ts       272 LOC - DB-backed estimates
useDBLeads.ts           176 LOC - Lead management
useLienReleases.ts      161 LOC - Lien releases
usePermits.ts           144 LOC - Permits
useEmployees.ts         124 LOC - Employees
useExpenses.ts          155 LOC - Expenses
useScheduleTasks.ts     260 LOC - Schedule tasks
usePricing.ts           457 LOC - Pricing models
useSelections.ts        253 LOC - Selections
useScopeTracking.ts     79 LOC  - Scope categories
```

---

# PART 2: CRITICAL ISSUES

## 2.1 Security Issues (CRITICAL)

### No Authentication System
```sql
-- MISSING: v2_users table
-- All "user" references are TEXT strings, not foreign keys

-- Every audit trail has:
approved_by TEXT  -- "Jake Ross" not UUID
created_by TEXT   -- Hardcoded string
```

### Zero Authorization
```javascript
// NO routes check user permissions:
router.delete('/:id', async (req, res) => {
  // Anyone can delete any invoice
  await supabase.from('v2_invoices').delete().eq('id', req.params.id);
});

// Should be:
router.delete('/:id', requireAuth, requireRole(['admin', 'manager']), async (req, res) => {
  // Now secured
});
```

**Impact**: Any user can approve invoices, fund draws, delete records.

---

## 2.2 Data Integrity Issues (CRITICAL)

### No Database Transactions
```javascript
// CURRENT: Multi-step operations can fail mid-way
async function splitInvoice(invoiceId, splits) {
  await updateInvoice(invoiceId, { is_parent: true }); // Step 1
  // IF THIS FAILS: Parent marked but no children created
  for (const split of splits) {
    await createInvoice(split); // Step 2, 3, 4...
  }
}

// SHOULD BE:
await supabase.rpc('split_invoice_atomic', { invoiceId, splits });
```

**Affected Operations**:
- Invoice approval + PDF stamping
- Invoice splitting
- Draw funding
- PO approval + notifications
- Change order creation

### Status Enum Chaos
```
INVOICES:  received → needs_approval → approved → in_draw → paid
BIDS:      draft → issued → receiving → evaluating → awarded
POS:       open/closed (deprecated) vs pending/approved/active/closed
ESTIMATES: draft → submitted → approved → rejected → converted
DRAWS:     draft → submitted → funded
```

**No centralized status management. Each domain has its own patterns.**

### Missing Foreign Keys
```sql
-- Trade is TEXT, not FK:
v2_schedule_tasks.trade = 'Framing'  -- No referential integrity
v2_daily_log_crew.trade = 'framing'  -- Different case!

-- Should be:
trade_id UUID REFERENCES v2_trades(id)
```

---

## 2.3 Performance Issues (HIGH)

### No Pagination
```javascript
// CURRENT: Returns ALL records
GET /api/invoices → 10,000 invoices loaded

// Frontend filters in memory
const filtered = invoices.filter(i => i.status === 'needs_approval');

// SHOULD BE:
GET /api/invoices?status=needs_approval&limit=50&offset=0
```

**Only ~15% of endpoints support pagination.**

### No Caching Strategy
```typescript
// ALL hooks have staleTime = 0 (default)
// Every component mount triggers refetch

useQuery({
  queryKey: ['invoices'],
  queryFn: fetchInvoices,
  // Missing: staleTime: 5 * 60 * 1000
});
```

### N+1 Query Patterns
```typescript
// CURRENT: Fetch cost codes 3 times
useCostCodes()         // All codes
useBaseCostCodes()     // Same fetch, filtered
useChangeCostCodes()   // Same fetch, filtered differently

// 3 separate API calls for same data
```

---

## 2.4 Code Quality Issues (MEDIUM)

### Duplicate Hooks
```typescript
// useJobs.ts
export function useJobs() { ... }  // Returns Job[]

// useFinancialData.ts
export function useDBJobs() { ... }  // Returns DBJob[]

// Different types, different implementations, same concept
```

### Incomplete Features
```typescript
// 6 TODO comments in codebase:
// - Estimates.tsx: "Create dedicated template editor"
// - InvoiceDetailDialog.tsx: "Get actual user"
// - Leads.tsx: "Navigate to estimate creation"
// - LeadKanbanBoard.tsx: "Create Estimate"
// - LienReleases.tsx: "Download"
// - UserContext.tsx: "Replace mockUser with actual authenticated user"
```

### Missing Form Validation
```typescript
// CURRENT: No validation
<Input value={email} onChange={setEmail} />
<Button onClick={handleSubmit}>Save</Button>

// SHOULD BE:
const schema = z.object({
  email: z.string().email(),
  phone: z.string().regex(/^\d{10}$/),
  amount: z.number().positive(),
});
```

---

# PART 3: WHAT'S MISSING

## 3.1 Missing Database Infrastructure

### Users & Authentication
```sql
CREATE TABLE v2_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, manager, approver, viewer
  password_hash TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Then update ALL activity tables:
ALTER TABLE v2_invoice_activity
  ADD COLUMN user_id UUID REFERENCES v2_users(id);
```

### Unified Status System
```sql
CREATE TABLE v2_entity_statuses (
  id UUID PRIMARY KEY,
  entity_type TEXT NOT NULL, -- invoice, po, draw, estimate
  status_code TEXT NOT NULL,
  status_label TEXT NOT NULL,
  sort_order INTEGER,
  next_statuses TEXT[], -- Valid transitions
  UNIQUE(entity_type, status_code)
);
```

### Activity Audit Improvements
```sql
-- Current: Only stores action type
-- Missing: old_value, new_value for audit

ALTER TABLE v2_invoice_activity
  ADD COLUMN old_values JSONB,
  ADD COLUMN new_values JSONB,
  ADD COLUMN changed_fields TEXT[];
```

---

## 3.2 Missing API Features

### Authorization Middleware
```javascript
// server/middleware/auth.js
const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};
```

### Transaction Wrapper
```javascript
// Use Supabase RPC for atomic operations
CREATE OR REPLACE FUNCTION split_invoice_atomic(
  p_invoice_id UUID,
  p_splits JSONB
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- All operations in single transaction
  -- If any fails, all roll back
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Webhook Infrastructure
```javascript
// server/core/events.js
async function emit(eventType, data) {
  // Log event
  await supabase.from('v2_events').insert({
    event_type: eventType,
    payload: data,
    created_at: new Date()
  });

  // Call webhooks
  const { data: webhooks } = await supabase
    .from('v2_webhooks')
    .select('*')
    .contains('events', [eventType]);

  for (const webhook of webhooks) {
    await queueWebhookCall(webhook, eventType, data);
  }
}
```

### Missing Endpoints
```
Search:
- GET /api/invoices/search
- GET /api/purchase-orders/search
- GET /api/global/search

Bulk Operations:
- POST /api/purchase-orders/bulk/approve
- POST /api/change-orders/bulk/approve
- POST /api/tasks/bulk/complete

Reports:
- GET /api/invoices/aging-report
- GET /api/purchase-orders/utilization
- GET /api/jobs/:id/cash-flow-forecast

Export:
- GET /api/draws/:id/export/excel
- GET /api/draws/:id/export/pdf
- GET /api/reports/export/:type
```

---

## 3.3 Missing Frontend Components

### Form Infrastructure
```typescript
// components/ui/form-field.tsx
interface FormFieldProps {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ name, label, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Shared Components Needed
```
StatusBadge          - Unified status display with colors
EmptyState           - No data placeholder with action
DataTable            - Sortable, filterable table
PageFilters          - Filter bar component
ConfirmDialog        - Confirmation dialogs
LoadingOverlay       - Full-page loading
ErrorBoundary        - Error handling
FormDialog           - Standard form dialog wrapper
```

### Missing Feature Components
```
Invoice:
- InvoiceManualFormDialog (create without PDF)
- InvoiceAllocationEditor (visual allocation)
- InvoiceSplitDialog (split invoice)

Budget:
- BudgetLineFormDialog (manual budget entry)
- BudgetAdjustmentDialog (mid-project changes)
- BudgetVarianceChart (visual variance)

Selections:
- SelectionFormDialog (create/edit)
- AllowanceFormDialog (manage allowances)
- SelectionApprovalWorkflow (approval process)

Client Portal:
- ClientDashboard
- ClientDrawApproval
- ClientSelectionApproval
- ClientScheduleView
```

---

## 3.4 Missing Hooks

### Required Hooks
```typescript
// Invoice Operations
useInvoiceAllocations(invoiceId)   - Manage cost code splits
useSplitInvoice()                  - Split invoice mutation
useInvoiceFamily(invoiceId)        - Get parent + children

// Entity Locking
useEntityLock(entityType, entityId) - Acquire/check lock
useReleaseLock()                   - Release lock

// Undo System
useUndo()                          - Trigger undo action

// Real-time
useRealtimeSync(entityType)        - SSE subscription

// Draw Operations
useDrawG702(drawId)                - G702 calculation
useDrawG703(drawId)                - G703 calculation
useDrawExport(drawId)              - Excel/PDF export

// Search
useGlobalSearch(query)             - Cross-entity search

// Vendor
useVendorDuplicates()              - Find duplicates
useVendorScorecard(vendorId)       - Performance data
```

---

# PART 4: EXPANSION ARCHITECTURE

## 4.1 Scalable Patterns to Implement

### Domain-Driven Structure
```
server/
├── domains/
│   ├── invoices/
│   │   ├── routes.js
│   │   ├── service.js
│   │   ├── validators.js
│   │   └── events.js
│   ├── purchase-orders/
│   ├── draws/
│   ├── bids/
│   └── ...
├── shared/
│   ├── middleware/
│   ├── validators/
│   ├── events/
│   └── utils/
└── infrastructure/
    ├── database/
    ├── storage/
    └── queue/
```

### Event-Driven Architecture
```javascript
// Every state change emits event
async function approveInvoice(id) {
  await updateInvoice(id, { status: 'approved' });

  await emit('invoice.approved', {
    invoiceId: id,
    timestamp: new Date(),
    actor: currentUser.id,
  });
}

// Other systems react to events
eventBus.on('invoice.approved', async (data) => {
  await stampPDF(data.invoiceId);
  await notifyApprover(data.invoiceId);
  await updateBudget(data.invoiceId);
});
```

### API Versioning
```javascript
// Support multiple API versions
router.use('/api/v1/invoices', v1InvoiceRoutes);
router.use('/api/v2/invoices', v2InvoiceRoutes);

// Deprecation headers
app.use('/api/v1/*', (req, res, next) => {
  res.set('Deprecation', 'true');
  res.set('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  next();
});
```

### Plugin Architecture
```javascript
// Allow feature modules to register themselves
const featureRegistry = new Map();

function registerFeature(name, config) {
  featureRegistry.set(name, {
    routes: config.routes,
    hooks: config.hooks,
    events: config.events,
    migrations: config.migrations,
  });
}

// Load all features
for (const [name, feature] of featureRegistry) {
  app.use(`/api/${name}`, feature.routes);
}
```

---

## 4.2 Data Architecture for Scale

### Read/Write Separation
```javascript
// Write operations hit primary
const writeClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Read operations can use replica (future)
const readClient = createClient(SUPABASE_REPLICA_URL, ANON_KEY);

// Route based on operation
async function getInvoices(filters) {
  return readClient.from('v2_invoices').select('*');
}

async function updateInvoice(id, data) {
  return writeClient.from('v2_invoices').update(data).eq('id', id);
}
```

### Caching Layer
```javascript
// Redis or in-memory cache for reference data
const cache = new Map();

async function getCostCodes() {
  if (cache.has('cost-codes')) {
    return cache.get('cost-codes');
  }

  const { data } = await supabase.from('v2_cost_codes').select('*');
  cache.set('cost-codes', data);

  // Expire after 30 minutes
  setTimeout(() => cache.delete('cost-codes'), 30 * 60 * 1000);

  return data;
}
```

### Materialized Views for Reports
```sql
-- Pre-compute expensive aggregations
CREATE MATERIALIZED VIEW mv_job_financial_summary AS
SELECT
  j.id as job_id,
  j.name as job_name,
  j.contract_amount,
  COALESCE(SUM(bl.budgeted_amount), 0) as total_budgeted,
  COALESCE(SUM(bl.committed_amount), 0) as total_committed,
  COALESCE(SUM(bl.billed_amount), 0) as total_billed,
  COALESCE(SUM(bl.paid_amount), 0) as total_paid
FROM v2_jobs j
LEFT JOIN v2_budget_lines bl ON j.id = bl.job_id
WHERE j.deleted_at IS NULL
GROUP BY j.id, j.name, j.contract_amount;

-- Refresh nightly
REFRESH MATERIALIZED VIEW mv_job_financial_summary;
```

---

## 4.3 Feature Expansion Roadmap

### Phase 1: Core Stability (Months 1-2)
```
Week 1-2: Security
- Add users table and auth system
- Implement authorization middleware
- Add role-based access control

Week 3-4: Data Integrity
- Add database transactions
- Fix cascading updates
- Standardize status enums

Week 5-6: Performance
- Add pagination to all endpoints
- Implement caching strategy
- Add missing indexes

Week 7-8: Quality
- Add form validation
- Fix duplicate hooks
- Complete TODO items
```

### Phase 2: Feature Completion (Months 3-4)
```
Week 9-10: CRUD Completion
- Selection forms
- Budget editing
- Daily log updates
- Draw delete/archive

Week 11-12: Relationships
- PO line item management
- Invoice allocation UI
- Draw bulk operations
- Bid scoring matrix

Week 13-14: Missing Pages
- Expenses, Permits, Tasks
- Files, Contracts, Warranties
- Profitability, Reports

Week 15-16: Intelligence
- Vendor scorecards
- Budget variance alerts
- Schedule intelligence
- Cash flow forecasting
```

### Phase 3: Advanced Features (Months 5-6)
```
Week 17-18: Client Portal
- Client user management
- Selection approval
- Change order approval
- Draw visibility

Week 19-20: Mobile Experience
- Responsive dialogs
- Mobile-optimized tables
- Photo capture
- Offline support

Week 21-22: Integrations
- Webhook infrastructure
- Email notifications
- Document export (PDF/Excel)
- Calendar sync

Week 23-24: Analytics
- Custom report builder
- Dashboard customization
- KPI tracking
- Performance benchmarks
```

### Phase 4: Enterprise Features (Months 7+)
```
- Multi-company support
- Advanced permissions (field-level)
- API rate limiting
- Audit log exports
- Data archival
- Disaster recovery
- SSO/SAML integration
- Advanced workflow automation
```

---

# PART 5: IMPLEMENTATION PRIORITIES

## Priority Matrix

| Issue | Impact | Effort | Priority |
|-------|--------|--------|----------|
| Add authentication | Critical | High | P0 |
| Add authorization | Critical | Medium | P0 |
| Add transactions | Critical | Medium | P0 |
| Add pagination | High | Medium | P1 |
| Fix duplicate hooks | High | Low | P1 |
| Add form validation | High | Medium | P1 |
| Complete selection forms | High | Low | P1 |
| Add budget editing | High | Medium | P1 |
| Fix caching strategy | Medium | Medium | P2 |
| Add missing endpoints | Medium | Medium | P2 |
| Complete placeholder pages | Medium | High | P2 |
| Add client portal | Medium | High | P3 |
| Add webhook infrastructure | Medium | Medium | P3 |
| Add analytics/reports | Low | High | P3 |

## Immediate Action Items

### This Week
1. [ ] Create v2_users table with basic schema
2. [ ] Add auth middleware (JWT or session)
3. [ ] Apply auth to DELETE and approval endpoints
4. [ ] Add Zod validation to invoice/PO forms
5. [ ] Consolidate duplicate hooks (useJobs, useVendors)

### This Month
1. [ ] Complete Phase 1 CRUD fixes
2. [ ] Add pagination to top 10 endpoints
3. [ ] Implement staleTime in all hooks
4. [ ] Build SelectionFormDialog
5. [ ] Build BudgetLineFormDialog
6. [ ] Enable daily log editing

### This Quarter
1. [ ] Complete all placeholder pages
2. [ ] Add webhook/event infrastructure
3. [ ] Build client portal MVP
4. [ ] Implement full vendor scorecards
5. [ ] Add cash flow forecasting
6. [ ] Complete mobile responsiveness

---

# SUMMARY

## System Strengths
- Comprehensive data model (227+ tables)
- Good AI integration (invoice processing)
- Strong financial workflows (invoice → PO → draw)
- Modern tech stack (React, TypeScript, Supabase)
- Extensive component library (shadcn/ui)

## Critical Gaps
- No authentication/authorization
- No database transactions
- No pagination/caching
- Incomplete CRUD operations
- Duplicate code patterns

## Strategic Recommendations
1. **Security First**: Add auth before any new features
2. **Data Integrity**: Implement transactions for multi-step operations
3. **Performance**: Add pagination and caching immediately
4. **Code Quality**: Consolidate duplicates, add validation
5. **Feature Completion**: Finish existing features before adding new ones
6. **Scalability**: Design for multi-company, plugin architecture

## Success Metrics
- [ ] 100% endpoints have authorization
- [ ] 100% list endpoints have pagination
- [ ] 0 duplicate hook implementations
- [ ] 100% forms have validation
- [ ] 0 placeholder pages
- [ ] <2s page load time
- [ ] <100ms API response time

---

**This document serves as the definitive reference for system improvement. Update as changes are implemented.**
