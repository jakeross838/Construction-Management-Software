# IMPLEMENTATION PHASES
## Complete CRUD & Data Management Overhaul

---

# OVERVIEW

This document breaks down all improvements into **8 implementable phases**. Each phase is self-contained with clear deliverables.

**Total Estimated Effort**: 12-16 weeks
**Approach**: Fix critical gaps first, then enhance existing features, then add new capabilities

---

# PHASE 1: CRITICAL CRUD FIXES
## Duration: 1 week
## Priority: MUST DO FIRST

These are broken features that prevent basic operations.

### 1.1 Selections - Build Missing Forms

**Problem**: API exists but no UI forms for create/edit/delete

**Files to Create/Modify**:
```
client/src/components/selections/
├── SelectionFormDialog.tsx      # NEW - Create/Edit form
├── SelectionDetailDialog.tsx    # NEW - View details
├── AllowanceFormDialog.tsx      # NEW - Manage allowances
└── SelectionCard.tsx            # NEW - Card for list view

client/src/hooks/
└── useSelections.ts             # UPDATE - Add mutations

client/src/pages/
└── Selections.tsx               # UPDATE - Wire up dialogs
```

**Form Fields for SelectionFormDialog**:
```typescript
interface SelectionFormData {
  job_id: string;           // Required - which job
  allowance_id: string;     // Required - which allowance category
  category: string;         // e.g., "Flooring", "Lighting"
  item_name: string;        // What was selected
  description: string;
  vendor_id?: string;       // Where to buy
  unit_cost: number;
  quantity: number;
  total_cost: number;       // Calculated
  status: 'pending' | 'selected' | 'ordered' | 'installed';
  client_approved: boolean;
  client_approved_at?: Date;
  notes: string;
  internal_notes: string;   // Hidden from client
}
```

**Form Fields for AllowanceFormDialog**:
```typescript
interface AllowanceFormData {
  job_id: string;
  category: string;         // "Flooring", "Lighting", "Plumbing Fixtures"
  budget_amount: number;    // What's allocated
  description: string;
  notes: string;
}
```

**Deliverables**:
- [ ] SelectionFormDialog with all fields
- [ ] AllowanceFormDialog for budget categories
- [ ] SelectionDetailDialog for viewing
- [ ] useSelections hook with create/update/delete mutations
- [ ] Selections page wired to dialogs
- [ ] Delete confirmation with soft delete

---

### 1.2 Budget Lines - Manual Edit Capability

**Problem**: Cannot manually set or adjust budget amounts

**Files to Create/Modify**:
```
client/src/components/budgets/
├── BudgetLineFormDialog.tsx     # NEW - Create/Edit budget line
├── BudgetImportDialog.tsx       # NEW - Import from CSV/estimate
└── BudgetAdjustmentDialog.tsx   # NEW - Mid-project adjustments

server/routes/
└── budgets.js                   # NEW - Dedicated budget routes

client/src/hooks/
└── useBudget.ts                 # UPDATE - Add mutations
```

**API Endpoints to Add**:
```javascript
// Create budget line manually
POST /api/jobs/:jobId/budget-lines
{
  cost_code_id: string,
  budgeted_amount: number,
  notes: string
}

// Update budget line
PATCH /api/jobs/:jobId/budget-lines/:lineId
{
  budgeted_amount: number,
  notes: string
}

// Bulk update (for import)
POST /api/jobs/:jobId/budget-lines/bulk
{
  lines: [{ cost_code_id, budgeted_amount, notes }]
}

// Adjustment with reason tracking
POST /api/jobs/:jobId/budget-lines/:lineId/adjust
{
  adjustment_amount: number,  // Can be positive or negative
  reason: string,
  effective_date: Date
}
```

**Form Fields for BudgetLineFormDialog**:
```typescript
interface BudgetLineFormData {
  cost_code_id: string;     // Select from cost codes
  budgeted_amount: number;
  notes: string;
}
```

**Form Fields for BudgetAdjustmentDialog**:
```typescript
interface BudgetAdjustmentData {
  adjustment_amount: number;  // +/- amount
  reason: string;             // Why adjusting
  effective_date: Date;
}
```

**Deliverables**:
- [ ] BudgetLineFormDialog for create/edit
- [ ] BudgetAdjustmentDialog for mid-project changes
- [ ] New API endpoints for budget management
- [ ] Activity log for all budget changes
- [ ] Budget import from CSV

---

### 1.3 Daily Logs - Enable Updates & Deletes

**Problem**: Cannot edit or delete daily logs after creation

**Files to Modify**:
```
server/routes/
└── daily-logs.js               # ADD PATCH and DELETE endpoints

client/src/components/daily-logs/
└── DailyLogFormDialog.tsx      # UPDATE - Support edit mode

client/src/hooks/
└── useDailyLogs.ts             # UPDATE - Add update/delete mutations
```

**API Endpoints to Add**:
```javascript
// Update daily log
PATCH /api/daily-logs/:id
{
  log_date: Date,
  weather_condition: string,
  temperature: number,
  notes: string,
  // Crew entries handled separately
}

// Delete daily log (soft delete)
DELETE /api/daily-logs/:id

// Update crew entry
PATCH /api/daily-logs/:logId/crew/:crewId
{
  vendor_id: string,
  headcount: number,
  hours: number,
  work_performed: string,
  scope_category_id: string,
  quantity_completed: number,
  work_quality: string,
  ready_for_next_trade: boolean
}

// Delete crew entry
DELETE /api/daily-logs/:logId/crew/:crewId

// Delete photo
DELETE /api/daily-logs/:logId/photos/:photoId
```

**Deliverables**:
- [ ] PATCH endpoint for daily logs
- [ ] DELETE endpoint for daily logs (soft delete)
- [ ] PATCH/DELETE for crew entries
- [ ] DELETE for photos
- [ ] Edit mode in DailyLogFormDialog
- [ ] Delete confirmation dialogs

---

### 1.4 Draws - Enable Delete/Archive

**Problem**: Cannot delete or archive draws

**Files to Modify**:
```
server/routes/
└── draws.js                    # ADD DELETE endpoint

client/src/components/draws/
└── DrawDetailPanel.tsx         # ADD delete button

client/src/hooks/
└── useDraws.ts                 # ADD delete mutation
```

**API Endpoints to Add**:
```javascript
// Delete draw (only if draft status)
DELETE /api/draws/:id
// Returns error if status !== 'draft'

// Archive draw (for any status)
PATCH /api/draws/:id/archive
// Sets archived_at timestamp, hides from main list

// Unarchive
PATCH /api/draws/:id/unarchive
```

**Database Migration**:
```sql
ALTER TABLE v2_draws
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN deleted_at TIMESTAMPTZ;
```

**Deliverables**:
- [ ] DELETE endpoint (draft only)
- [ ] Archive/unarchive endpoints
- [ ] Migration for new columns
- [ ] UI buttons with confirmation
- [ ] Filter to hide archived draws

---

# PHASE 2: FORM COMPLETENESS
## Duration: 1.5 weeks
## Priority: HIGH

Ensure all existing forms have complete field coverage.

### 2.1 Jobs - Specification Fields Form

**Problem**: 200+ spec fields in database but only 5 in form

**Files to Create**:
```
client/src/components/jobs/
├── JobSpecsFormDialog.tsx       # NEW - Full specs form
├── JobSpecsSection.tsx          # NEW - Collapsible section
└── specs/
    ├── StructuralSpecs.tsx      # Section component
    ├── ExteriorSpecs.tsx
    ├── InteriorSpecs.tsx
    ├── PlumbingSpecs.tsx
    ├── ElectricalSpecs.tsx
    ├── HVACSpecs.tsx
    ├── ApplianceSpecs.tsx
    └── SpecFieldGroup.tsx       # Reusable field group
```

**Form Organization** (collapsible sections):
```
JOB SPECIFICATIONS
├── Basic Info
│   ├── square_footage
│   ├── bedrooms, bathrooms, half_baths
│   ├── stories, garage_spaces
│   ├── construction_type
│   └── architectural_style
│
├── Structural
│   ├── foundation_type
│   ├── framing_type
│   ├── roof_type, roof_pitch
│   ├── exterior_walls
│   └── insulation_specs
│
├── Exterior
│   ├── siding_type, siding_material
│   ├── window_type, window_brand
│   ├── door_specs
│   ├── garage_door_specs
│   └── landscaping_scope
│
├── Interior
│   ├── flooring_types (by room)
│   ├── cabinet_style, cabinet_brand
│   ├── countertop_material
│   ├── trim_style
│   └── paint_specs
│
├── Plumbing
│   ├── fixture_grade
│   ├── water_heater_type
│   ├── plumbing_fixtures_allowance
│   └── special_features (steam shower, etc.)
│
├── Electrical
│   ├── panel_size
│   ├── outlet_count
│   ├── lighting_allowance
│   ├── smart_home_features
│   └── generator_specs
│
├── HVAC
│   ├── system_type
│   ├── zones
│   ├── brand
│   └── efficiency_rating
│
└── Appliances
    ├── kitchen_appliances
    ├── laundry
    └── specialty_appliances
```

**Deliverables**:
- [ ] JobSpecsFormDialog with tabbed/accordion sections
- [ ] All 200+ fields organized logically
- [ ] Auto-save as user fills out
- [ ] Specs accessible from Job Detail page
- [ ] Print-friendly specs summary

---

### 2.2 Purchase Orders - Complete Edit Form

**Problem**: Cannot change vendor/job after creation, limited field access

**Files to Modify**:
```
client/src/components/purchase-orders/
└── POFormDialog.tsx             # UPDATE - Add all fields

server/routes/
└── purchase-orders.js           # UPDATE - Allow more edits
```

**Additional Fields to Add**:
```typescript
interface POFormData {
  // Existing fields...

  // ADD these fields:
  payment_terms: string;         // "Net 30", "Due on Receipt"
  delivery_date: Date;
  delivery_address: string;      // If different from job
  warranty_period: string;
  insurance_required: boolean;
  insurance_verified: boolean;
  contact_name: string;          // Vendor contact for this PO
  contact_phone: string;
  contact_email: string;

  // Scope tracking (already added, ensure in form)
  scope_category_id: string;
  scope_quantity: number;
  estimated_days: number;
}
```

**Allow Editing** (with audit trail):
- [ ] Vendor change (if no invoices linked)
- [ ] Job change (if no invoices linked)
- [ ] PO number change (admin only)

**Deliverables**:
- [ ] Complete POFormDialog with all fields
- [ ] Conditional editing (vendor/job if no invoices)
- [ ] Audit trail for sensitive changes
- [ ] Payment terms management

---

### 2.3 Invoices - Manual Creation Form

**Problem**: Can only create invoices via PDF upload

**Files to Create**:
```
client/src/components/invoices/
└── InvoiceManualFormDialog.tsx  # NEW - Manual entry form
```

**Form Fields**:
```typescript
interface InvoiceManualFormData {
  vendor_id: string;
  job_id: string;
  po_id?: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  amount: number;
  description: string;
  notes: string;

  // Line items
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    cost_code_id?: string;
  }>;

  // Optional PDF
  pdf_file?: File;
}
```

**Deliverables**:
- [ ] InvoiceManualFormDialog with line items
- [ ] Option to attach PDF later
- [ ] Auto-calculate totals from line items
- [ ] Quick-fill from PO line items

---

### 2.4 Change Orders - Revision Tracking

**Problem**: No revision history, can't request revisions

**Files to Create/Modify**:
```
server/routes/
└── change-orders.js             # ADD revision endpoints

client/src/components/change-orders/
├── COFormDialog.tsx             # UPDATE - Add revision fields
└── CORevisionHistory.tsx        # NEW - Show revision history
```

**Database Migration**:
```sql
ALTER TABLE v2_change_orders
ADD COLUMN revision_number INTEGER DEFAULT 1,
ADD COLUMN previous_revision_id UUID REFERENCES v2_change_orders(id);

CREATE TABLE v2_change_order_revisions (
  id UUID PRIMARY KEY,
  change_order_id UUID REFERENCES v2_change_orders(id),
  revision_number INTEGER,
  amount_change DECIMAL(12,2),
  description TEXT,
  reason_for_revision TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES v2_users(id)
);
```

**Workflow**:
```
CO Created (Rev 1) → Submitted → Rejected with comments
                                      ↓
                              Create Revision (Rev 2)
                                      ↓
                              Resubmit → Approved
```

**Deliverables**:
- [ ] Revision tracking in database
- [ ] "Request Revision" action instead of just reject
- [ ] Revision history panel
- [ ] Compare revisions side-by-side

---

# PHASE 3: RELATIONSHIP MANAGEMENT
## Duration: 1.5 weeks
## Priority: HIGH

Enable proper management of related entities.

### 3.1 PO Line Items - Full Management UI

**Problem**: Line items editable but UI is clunky

**Files to Create**:
```
client/src/components/purchase-orders/
├── POLineItemsEditor.tsx        # NEW - Full line item manager
├── POLineItemRow.tsx            # NEW - Editable row
└── POLineItemTemplates.tsx      # NEW - Import from templates
```

**Features**:
- [ ] Inline editing of line items
- [ ] Drag-to-reorder
- [ ] Bulk add from cost code template
- [ ] Import from estimate
- [ ] Running total display
- [ ] Over-budget warnings

**Deliverables**:
- [ ] POLineItemsEditor component
- [ ] Template selection dialog
- [ ] Import from estimate functionality
- [ ] Reorder API endpoint

---

### 3.2 Invoice Allocations - Improved UI

**Problem**: Allocation management is buried in detail dialog

**Files to Create**:
```
client/src/components/invoices/
├── AllocationEditor.tsx         # NEW - Standalone allocation editor
├── AllocationSuggestions.tsx    # NEW - AI suggestions display
└── AllocationSplitHelper.tsx    # NEW - Equal split tool
```

**Features**:
- [ ] Visual allocation bar (shows % allocated)
- [ ] AI suggestions with one-click accept
- [ ] Split equally across cost codes
- [ ] Split proportionally based on PO
- [ ] Warning if over-allocating
- [ ] Remaining amount display

**Deliverables**:
- [ ] AllocationEditor with visual feedback
- [ ] AI suggestion integration
- [ ] Quick-split tools
- [ ] Validation to prevent over-allocation

---

### 3.3 Draw Invoice Management - Bulk Operations

**Problem**: Can only add/remove one invoice at a time

**Files to Modify**:
```
client/src/components/draws/
├── DrawInvoiceSelector.tsx      # UPDATE - Multi-select
└── DrawBulkActions.tsx          # NEW - Bulk operations
```

**Features**:
- [ ] Multi-select invoices to add
- [ ] Filter available invoices (by job, vendor, date range)
- [ ] Bulk remove invoices
- [ ] "Add all approved" quick action
- [ ] Invoice reordering within draw

**API Endpoints**:
```javascript
// Already exists, ensure supports arrays
POST /api/draws/:id/add-invoices
{ invoice_ids: string[] }  // Array instead of single

// Bulk remove
POST /api/draws/:id/remove-invoices
{ invoice_ids: string[] }

// Reorder invoices in draw
POST /api/draws/:id/reorder-invoices
{ invoice_ids: string[] }  // In desired order
```

**Deliverables**:
- [ ] Multi-select invoice picker
- [ ] Bulk add/remove operations
- [ ] "Add all approved for job" button
- [ ] Invoice reordering

---

### 3.4 Bid Submissions - Complete Workflow

**Problem**: Can't properly manage bid submission lifecycle

**Files to Create/Modify**:
```
client/src/components/bids/
├── BidSubmissionManager.tsx     # NEW - Manage all submissions
├── BidScoringMatrix.tsx         # NEW - Score/compare bids
└── BidAwardDialog.tsx           # UPDATE - Include scoring
```

**Features**:
- [ ] View all submissions for a package
- [ ] Score each submission on criteria
- [ ] Auto-calculate weighted scores
- [ ] Side-by-side comparison
- [ ] Award with scoring justification

**Scoring System**:
```typescript
interface BidScoringCriteria {
  criteria: Array<{
    name: string;           // "Price", "Schedule", "Experience"
    weight: number;         // 0-100, total = 100
    score: number;          // 1-5
  }>;
  total_score: number;      // Weighted average
  notes: string;
  recommended: boolean;
}
```

**Deliverables**:
- [ ] BidScoringMatrix component
- [ ] Scoring criteria configuration
- [ ] Weighted score calculation
- [ ] Comparison view with scores
- [ ] Award justification field

---

# PHASE 4: CASCADING UPDATES
## Duration: 1 week
## Priority: HIGH

Ensure changes propagate correctly across related entities.

### 4.1 PO ↔ Budget Sync

**Problem**: PO changes don't always update budget

**Implementation**:
```javascript
// server/services/budget-sync.js

async function syncPOToBudget(poId) {
  const po = await getPO(poId);
  const lineItems = await getPOLineItems(poId);

  for (const line of lineItems) {
    await updateBudgetLine(po.job_id, line.cost_code_id, {
      committed_amount: await calculateCommittedForCostCode(po.job_id, line.cost_code_id)
    });
  }
}

// Trigger on:
// - PO create
// - PO line item add/edit/delete
// - PO status change (cancelled removes commitment)
// - Change order approval
```

**Deliverables**:
- [ ] Budget sync service
- [ ] Triggers on all PO changes
- [ ] Handles cancelled POs (removes commitment)
- [ ] Handles change orders

---

### 4.2 Invoice ↔ PO Sync

**Problem**: Invoice allocation doesn't always update PO billed amount

**Implementation**:
```javascript
// server/services/invoice-sync.js

async function syncInvoiceToPO(invoiceId) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice.po_id) return;

  const allocations = await getInvoiceAllocations(invoiceId);

  for (const alloc of allocations) {
    // Find matching PO line item
    const poLine = await findPOLineByJob(invoice.po_id, alloc.cost_code_id);
    if (poLine) {
      const totalBilled = await calculateTotalBilledForPOLine(poLine.id);
      await updatePOLine(poLine.id, { invoiced_amount: totalBilled });
    }
  }

  // Update PO total billed
  await recalculatePOBilled(invoice.po_id);
}

// Trigger on:
// - Invoice allocation created
// - Invoice allocation updated
// - Invoice allocation deleted
// - Invoice approved/denied
// - Invoice deleted
```

**Deliverables**:
- [ ] Invoice sync service
- [ ] PO line item billed_amount updates
- [ ] PO total billed recalculation
- [ ] Handles invoice deletion

---

### 4.3 Change Order ↔ Budget Sync

**Problem**: COs don't update budget cost codes

**Implementation**:
```javascript
// server/services/co-sync.js

async function syncCOToBudget(coId) {
  const co = await getChangeOrder(coId);
  const coLines = await getCOLineItems(coId);
  const po = await getPO(co.po_id);

  for (const line of coLines) {
    await updateBudgetLine(po.job_id, line.cost_code_id, {
      change_order_amount: await calculateCOTotalForCostCode(po.job_id, line.cost_code_id)
    });
  }
}

// Also update PO total
async function syncCOToPO(coId) {
  const co = await getChangeOrder(coId);
  const po = await getPO(co.po_id);

  const allCOs = await getApprovedCOsForPO(po.id);
  const coTotal = allCOs.reduce((sum, co) => sum + co.amount_change, 0);

  await updatePO(po.id, {
    change_order_total: coTotal,
    total_amount: po.original_amount + coTotal
  });
}
```

**Database Migration**:
```sql
ALTER TABLE v2_budget_lines
ADD COLUMN change_order_amount DECIMAL(12,2) DEFAULT 0;

-- Total commitment = committed + change_orders
```

**Deliverables**:
- [ ] CO sync to budget
- [ ] CO sync to PO totals
- [ ] Migration for change_order_amount
- [ ] Budget shows: Original + COs = Total

---

### 4.4 Daily Logs ↔ Schedule Sync

**Problem**: Daily logs don't update schedule progress

**Implementation**:
```javascript
// server/services/schedule-sync.js

async function syncDailyLogToSchedule(dailyLogId) {
  const log = await getDailyLog(dailyLogId);
  const crewEntries = await getCrewEntries(dailyLogId);

  for (const crew of crewEntries) {
    if (crew.schedule_task_id) {
      const task = await getScheduleTask(crew.schedule_task_id);
      const totalHours = await getTotalHoursForTask(crew.schedule_task_id);
      const estimatedHours = task.estimated_days * 8;

      const percentComplete = Math.min(100, Math.round((totalHours / estimatedHours) * 100));

      await updateScheduleTask(crew.schedule_task_id, {
        percent_complete: percentComplete,
        actual_start: task.actual_start || log.log_date,
        actual_hours: totalHours
      });
    }
  }
}
```

**Deliverables**:
- [ ] Schedule sync service
- [ ] % complete auto-calculation
- [ ] Actual start date from first log
- [ ] Total hours tracking

---

# PHASE 5: SCHEDULE SYSTEM
## Duration: 2 weeks
## Priority: MEDIUM-HIGH

Build complete schedule management (currently unclear/incomplete).

### 5.1 Schedule Data Model Clarification

**Current State**: Unclear - may be milestones only

**Target State**: Full project scheduling with:
- Tasks with dependencies
- Gantt chart visualization
- Critical path calculation
- Resource assignment
- Progress tracking from daily logs

**Database Tables** (verify/create):
```sql
-- Main schedule table
CREATE TABLE IF NOT EXISTS v2_schedules (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES v2_jobs(id),
  name TEXT DEFAULT 'Master Schedule',
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule tasks
CREATE TABLE IF NOT EXISTS v2_schedule_tasks (
  id UUID PRIMARY KEY,
  schedule_id UUID REFERENCES v2_schedules(id),
  name TEXT NOT NULL,
  description TEXT,

  -- Timing
  start_date DATE,
  end_date DATE,
  estimated_days DECIMAL(6,1),
  actual_start DATE,
  actual_end DATE,

  -- Progress
  percent_complete INTEGER DEFAULT 0,
  actual_hours DECIMAL(8,1),

  -- Relationships
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  scope_category_id UUID REFERENCES v2_scope_categories(id),
  assigned_vendor_id UUID REFERENCES v2_vendors(id),
  po_id UUID REFERENCES v2_purchase_orders(id),

  -- Hierarchy
  parent_task_id UUID REFERENCES v2_schedule_tasks(id),
  sort_order INTEGER,

  -- Status
  status TEXT DEFAULT 'not_started', -- not_started, in_progress, complete, on_hold

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dependencies
CREATE TABLE IF NOT EXISTS v2_schedule_dependencies (
  id UUID PRIMARY KEY,
  predecessor_id UUID REFERENCES v2_schedule_tasks(id),
  successor_id UUID REFERENCES v2_schedule_tasks(id),
  dependency_type TEXT DEFAULT 'finish_to_start', -- FS, SS, FF, SF
  lag_days INTEGER DEFAULT 0
);
```

---

### 5.2 Schedule UI Components

**Files to Create**:
```
client/src/components/schedule/
├── ScheduleView.tsx             # Main schedule page
├── ScheduleGantt.tsx            # Gantt chart view
├── ScheduleList.tsx             # List/table view
├── ScheduleCalendar.tsx         # Calendar view
├── TaskFormDialog.tsx           # Create/edit task
├── TaskDetailPanel.tsx          # Task details
├── DependencyEditor.tsx         # Manage dependencies
├── CriticalPathView.tsx         # Highlight critical path
└── ScheduleTemplates.tsx        # Apply templates
```

**Deliverables**:
- [ ] Schedule CRUD operations
- [ ] Task CRUD with dependencies
- [ ] Gantt chart visualization
- [ ] List and calendar views
- [ ] Critical path calculation
- [ ] Template system

---

### 5.3 Schedule ↔ Other Entities

**Integrations to Build**:

```
Schedule Task ←→ PO
- When PO created, can link to task
- Task shows PO status and billing progress

Schedule Task ←→ Daily Logs
- Daily log crew entry links to task
- Hours auto-calculate % complete

Schedule Task ←→ Scope Categories
- Task can have scope type
- Duration calculated from scope quantity

Schedule Task ←→ Vendor
- Task assigned to vendor
- Vendor dashboard shows tasks

Schedule Task ←→ Inspections (future)
- Inspection blocks next task
- Shows inspection status on task
```

**Deliverables**:
- [ ] PO link field in task form
- [ ] Daily log → task sync
- [ ] Scope-based duration calculation
- [ ] Vendor assignment
- [ ] Job Schedule dashboard widget

---

# PHASE 6: MISSING ENTITIES
## Duration: 2 weeks
## Priority: MEDIUM

Add completely missing features.

### 6.1 RFIs (Requests for Information)

**Files to Create**:
```
client/src/components/rfis/
├── RFIFormDialog.tsx
├── RFIDetailDialog.tsx
├── RFIList.tsx
└── RFICard.tsx

client/src/hooks/
└── useRFIs.ts

client/src/pages/
└── RFIs.tsx

server/routes/
└── rfis.js
```

**Database Migration**:
```sql
CREATE TABLE v2_rfis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  rfi_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,

  -- Submission
  submitted_by UUID REFERENCES v2_users(id),
  submitted_to TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  -- Response
  response TEXT,
  responded_by TEXT,
  responded_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  due_date DATE,

  -- Impact
  cost_impact DECIMAL(12,2),
  schedule_impact_days INTEGER,

  -- Links
  related_schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  related_co_id UUID REFERENCES v2_change_orders(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE v2_rfi_attachments (
  id UUID PRIMARY KEY,
  rfi_id UUID REFERENCES v2_rfis(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Deliverables**:
- [ ] Full RFI CRUD
- [ ] File attachments
- [ ] Status workflow
- [ ] Impact tracking
- [ ] Link to schedule/CO

---

### 6.2 Submittals

**Files to Create**:
```
client/src/components/submittals/
├── SubmittalFormDialog.tsx
├── SubmittalDetailDialog.tsx
├── SubmittalList.tsx
└── SubmittalStatusBadge.tsx

client/src/hooks/
└── useSubmittals.ts

client/src/pages/
└── Submittals.tsx

server/routes/
└── submittals.js
```

**Database Migration**:
```sql
CREATE TABLE v2_submittals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  submittal_number TEXT NOT NULL,
  spec_section TEXT,
  description TEXT NOT NULL,

  -- Submission
  submitted_by_vendor_id UUID REFERENCES v2_vendors(id),
  submitted_at TIMESTAMPTZ,

  -- Review
  status TEXT DEFAULT 'pending',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT,

  -- Timing
  required_by DATE,
  lead_time_days INTEGER,

  -- Links
  po_id UUID REFERENCES v2_purchase_orders(id),
  selection_id UUID REFERENCES v2_selections(id),
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE v2_submittal_attachments (
  id UUID PRIMARY KEY,
  submittal_id UUID REFERENCES v2_submittals(id),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  revision_number INTEGER DEFAULT 1,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Deliverables**:
- [ ] Full Submittal CRUD
- [ ] Multi-revision support
- [ ] Review workflow (approve, reject, revise)
- [ ] Schedule blocking integration
- [ ] Lead time calculations

---

### 6.3 Inspections

**Files to Create**:
```
client/src/components/inspections/
├── InspectionFormDialog.tsx
├── InspectionDetailDialog.tsx
├── InspectionCalendar.tsx
└── InspectionChecklist.tsx

client/src/hooks/
└── useInspections.ts

server/routes/
└── inspections.js
```

**Database Migration**:
```sql
CREATE TABLE v2_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  inspection_type TEXT NOT NULL,
  description TEXT,

  -- Scheduling
  requested_date DATE,
  scheduled_date DATE,
  scheduled_time TIME,
  inspector_name TEXT,
  inspector_phone TEXT,

  -- Result
  status TEXT DEFAULT 'pending',
  inspected_at TIMESTAMPTZ,
  result TEXT,
  result_notes TEXT,
  corrections_required TEXT[],

  -- Links
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  permit_id UUID REFERENCES v2_permits(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Inspection Types**:
- Footing
- Foundation/Slab
- Framing
- Rough Electrical
- Rough Plumbing
- Rough HVAC
- Insulation
- Drywall
- Final

**Deliverables**:
- [ ] Full Inspection CRUD
- [ ] Calendar view
- [ ] Schedule blocking (task can't proceed until passed)
- [ ] Correction tracking
- [ ] Integration with permits

---

### 6.4 Photos System

**Files to Create**:
```
client/src/components/photos/
├── PhotoUploader.tsx
├── PhotoGallery.tsx
├── PhotoDetail.tsx
├── PhotoTimeline.tsx
└── PhotoCategories.tsx

client/src/hooks/
└── usePhotos.ts

server/routes/
└── photos.js
```

**Database Migration**:
```sql
CREATE TABLE v2_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  taken_by UUID REFERENCES v2_users(id),

  -- Location
  location_description TEXT,

  -- Links (optional)
  daily_log_id UUID REFERENCES v2_daily_logs(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  punch_item_id UUID,
  rfi_id UUID REFERENCES v2_rfis(id),

  -- Categorization
  category TEXT,
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features**:
- [ ] Multi-photo upload
- [ ] Auto-generate thumbnails
- [ ] Link to any entity
- [ ] Timeline view by date
- [ ] Gallery view by category
- [ ] Before/after comparison

---

# PHASE 7: BULK OPERATIONS
## Duration: 1 week
## Priority: MEDIUM

Add efficiency features for managing multiple records.

### 7.1 Bulk Invoice Operations

**Features**:
- [ ] Select multiple invoices
- [ ] Bulk approve (with same approver)
- [ ] Bulk add to draw
- [ ] Bulk allocate (same cost code split)
- [ ] Bulk export to CSV

**Files to Create**:
```
client/src/components/invoices/
├── InvoiceBulkActions.tsx
├── InvoiceMultiSelect.tsx
└── BulkAllocationDialog.tsx
```

---

### 7.2 Bulk PO Operations

**Features**:
- [ ] Select multiple POs
- [ ] Bulk status change
- [ ] Bulk export
- [ ] Bulk print

---

### 7.3 Data Import/Export

**Features**:
- [ ] Import cost codes from CSV
- [ ] Import budget from CSV/Excel
- [ ] Import vendors from CSV
- [ ] Export any list to CSV/Excel

**Files to Create**:
```
client/src/components/import-export/
├── CSVImportDialog.tsx
├── CSVMappingStep.tsx
├── ImportPreview.tsx
└── ExportButton.tsx

server/routes/
└── import-export.js
```

---

# PHASE 8: VALIDATION & POLISH
## Duration: 1 week
## Priority: MEDIUM

Add validation rules and improve UX.

### 8.1 Form Validation Rules

**Implement across all forms**:
```typescript
// Validation rules
const validationRules = {
  // Prevent over-allocation
  invoiceAllocation: (total, allocations) => {
    const allocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    if (allocated > total) {
      return 'Allocations cannot exceed invoice total';
    }
  },

  // Prevent over-billing PO
  poBilling: (poLine, newAmount) => {
    if (poLine.invoiced_amount + newAmount > poLine.amount) {
      return `Cannot bill more than PO line amount ($${poLine.amount})`;
    }
  },

  // Budget warnings
  budgetCommitment: (budgetLine, newCommitment) => {
    if (newCommitment > budgetLine.budgeted_amount) {
      return 'Warning: This exceeds the budgeted amount';
    }
  },

  // Date validations
  drawPeriod: (draw, invoice) => {
    if (invoice.invoice_date > draw.period_end) {
      return 'Invoice date is after draw period end';
    }
  }
};
```

---

### 8.2 Confirmation Dialogs

**Add confirmations for**:
- [ ] Delete operations (all entities)
- [ ] Status changes that can't be undone
- [ ] Bulk operations
- [ ] Actions with financial impact

**Component**:
```
client/src/components/ui/
└── ConfirmDialog.tsx
```

---

### 8.3 Undo Capabilities

**Existing**: 30-second undo queue

**Enhance**:
- [ ] Show undo toast after destructive actions
- [ ] Extend window to 60 seconds
- [ ] Support undo for more operations
- [ ] Visual countdown timer

---

### 8.4 Error Handling

**Improve**:
- [ ] User-friendly error messages
- [ ] Specific guidance for common errors
- [ ] Retry buttons for network errors
- [ ] Form field highlighting for validation errors

---

# SUMMARY: IMPLEMENTATION ORDER

| Phase | Name | Duration | Dependencies |
|-------|------|----------|--------------|
| 1 | Critical CRUD Fixes | 1 week | None |
| 2 | Form Completeness | 1.5 weeks | Phase 1 |
| 3 | Relationship Management | 1.5 weeks | Phase 1 |
| 4 | Cascading Updates | 1 week | Phases 1-3 |
| 5 | Schedule System | 2 weeks | Phase 4 |
| 6 | Missing Entities | 2 weeks | Phase 4 |
| 7 | Bulk Operations | 1 week | Phases 1-3 |
| 8 | Validation & Polish | 1 week | All phases |

**Total**: 11.5 weeks (approximately 3 months)

---

# QUICK START: PHASE 1

To begin Phase 1 immediately, start with:

1. **Selection Forms** (highest impact)
   - Create `SelectionFormDialog.tsx`
   - Create `AllowanceFormDialog.tsx`
   - Wire up to Selections page

2. **Budget Editing** (critical for usability)
   - Create budget API endpoints
   - Create `BudgetLineFormDialog.tsx`

3. **Daily Log Updates** (frequently requested)
   - Add PATCH endpoint to `daily-logs.js`
   - Enable edit mode in form

4. **Draw Delete** (quick win)
   - Add DELETE endpoint to `draws.js`
   - Add migration for archived_at column

---

Ready to start Phase 1?
