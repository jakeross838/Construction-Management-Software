# MASTER IMPROVEMENT PLAN
## Ross Built Construction Management Software
## Complete System Integration & Enhancement Roadmap

---

# EXECUTIVE SUMMARY

The current system has **excellent data modeling** (130+ migrations, 50+ tables) but suffers from **fragmented integration**. Data exists but doesn't flow between modules. This plan addresses:

1. **35 identified gaps** in current integrations
2. **12 missing features** essential for construction management
3. **Full system integration** so everything syncs automatically
4. **Intelligence layer** that learns and improves over time

**Goal**: Every action in one module automatically updates all related modules.

---

# PART 1: THE INTEGRATED VISION

## How Everything Should Connect

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT RELATIONSHIP                                │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐                │
│  │  LEAD   │ →  │ PROPOSAL │ →  │ CONTRACT │ →  │   JOB   │                │
│  └─────────┘    └──────────┘    └──────────┘    └─────────┘                │
│       │              │               │               │                      │
│       ▼              ▼               ▼               ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        SELECTIONS & ALLOWANCES                       │   │
│  │   Client picks finishes, fixtures, materials → Creates Allowances   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PLANNING PHASE                                  │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │  ESTIMATE   │ ←─────→ │   BUDGET    │ ←─────→ │  SCHEDULE   │           │
│  │             │         │             │         │             │           │
│  │ What it     │         │ Allocated   │         │ When work   │           │
│  │ should cost │         │ by cost code│         │ happens     │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        ↑                       ↑                       ↑                    │
│        │                       │                       │                    │
│        └───────────────────────┼───────────────────────┘                    │
│                                │                                            │
│                    ALL THREE SYNC AUTOMATICALLY                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             PROCUREMENT PHASE                                │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ BID PACKAGE │ ───────→│ AWARD BID   │ ───────→│  CREATE PO  │           │
│  │             │         │             │         │             │           │
│  │ Specs +     │         │ Best vendor │         │ Commitment  │           │
│  │ Drawings    │         │ selected    │         │ created     │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AUTO-UPDATES:                                │   │
│  │  • Budget.committed_amount increases                                 │   │
│  │  • Schedule tasks linked to PO                                       │   │
│  │  • Vendor performance history considered                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             EXECUTION PHASE                                  │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ DAILY LOGS  │ ───────→│  SCHEDULE   │ ───────→│   BUDGET    │           │
│  │             │         │             │         │             │           │
│  │ Who worked  │         │ % complete  │         │ Actual      │           │
│  │ What done   │         │ updates     │         │ labor cost  │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      PERFORMANCE TRACKING:                           │   │
│  │  • Scope completed (SF, LF, EA) recorded                            │   │
│  │  • Productivity calculated (days per unit)                          │   │
│  │  • Quality rated                                                     │   │
│  │  • Feeds into vendor scorecards                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BILLING PHASE                                   │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │  INVOICES   │ ───────→│ ALLOCATIONS │ ───────→│    DRAWS    │           │
│  │             │         │             │         │             │           │
│  │ Vendor      │         │ Split to    │         │ G702/G703   │           │
│  │ bills us    │         │ cost codes  │         │ to client   │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         AUTO-UPDATES:                                │   │
│  │  • PO.invoiced_amount increases                                     │   │
│  │  • Budget.billed_amount increases                                   │   │
│  │  • Schedule task marked if PO fully billed                          │   │
│  │  • Invoice.status changes through workflow                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOSEOUT PHASE                                  │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ PUNCH LIST  │ ───────→│   LIEN      │ ───────→│  WARRANTY   │           │
│  │             │         │  RELEASES   │         │             │           │
│  │ Final items │         │ Before final│         │ Post-close  │           │
│  │ to fix      │         │ payment     │         │ issues      │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      CLOSEOUT REPORT:                                │   │
│  │  • Estimated vs Actual by cost code                                 │   │
│  │  • Schedule variance analysis                                        │   │
│  │  • Vendor performance summary                                        │   │
│  │  • Lessons learned → Feeds future estimates                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTELLIGENCE LAYER                                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │                     LEARNS FROM EVERY PROJECT                          │ │
│  │                                                                         │ │
│  │  • Actual vs Estimated costs by scope → Better future estimates       │ │
│  │  • Actual vs Estimated days by scope → Better future schedules        │ │
│  │  • Vendor productivity by trade → Smarter bid evaluation              │ │
│  │  • Change order patterns → Better contingency planning                │ │
│  │  • Weather delays → Seasonal scheduling adjustments                   │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 2: CRITICAL FIXES (Must Do First)

These are broken connections that cause data integrity issues.

## Fix #1: Bids → Purchase Orders Link

**Problem**: When a bid is awarded, the PO doesn't know it came from that bid.

**Current State**:
```
Bid Package: "Electrical" awarded to ABC Electric for $45,000
PO Created: "PO-Job123-0012" for ABC Electric, $45,000
Link: ❌ NONE - Can't trace PO back to bid
```

**Solution**:
```sql
-- Migration: Add source_bid_id to purchase orders
ALTER TABLE v2_purchase_orders
ADD COLUMN source_bid_id UUID REFERENCES v2_bids(id);

-- When awarding bid, set the link
UPDATE v2_purchase_orders SET source_bid_id = :bidId WHERE id = :poId;
```

**Benefits**:
- "Show all POs created from bids" report
- Trace committed dollars back to bid evaluation
- Compare bid amount vs actual PO spend

---

## Fix #2: Cost Codes Everywhere

**Problem**: Budget uses cost codes, but Schedule and Daily Logs use text "trade" field.

**Current State**:
```
Budget Line:     cost_code_id = "06100" (Rough Carpentry)
Schedule Task:   trade = "Framing" (text, no FK)
Daily Log Crew:  trade = "framing" (text, different case!)
```

**Solution**:
```sql
-- Add cost_code_id to schedule tasks
ALTER TABLE v2_schedule_tasks
ADD COLUMN cost_code_id UUID REFERENCES v2_cost_codes(id);

-- Add cost_code_id to daily log crew
ALTER TABLE v2_daily_log_crew
ADD COLUMN cost_code_id UUID REFERENCES v2_cost_codes(id);

-- Backfill from trade text where possible
UPDATE v2_schedule_tasks st
SET cost_code_id = cc.id
FROM v2_cost_codes cc
WHERE LOWER(st.trade) LIKE '%' || LOWER(cc.name) || '%';
```

**Benefits**:
- Query: "Show all actuals for cost code 06100 across budget, invoices, schedule, daily logs"
- Consistent reporting
- Automatic rollup calculations

---

## Fix #3: Change Orders → Budget Impact

**Problem**: Change orders exist on POs but don't update budget cost codes.

**Current State**:
```
CO #1: Add drywall in office, +$500
Budget: ❌ Doesn't know about this
Report: Can't explain why Drywall is over budget
```

**Solution**:
```sql
-- Add cost code breakdown to change orders
CREATE TABLE v2_change_order_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_order_id UUID REFERENCES v2_change_orders(id),
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT,
  amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update budget when CO is approved
-- Trigger or API logic to:
-- UPDATE v2_budget_lines SET committed_amount = committed_amount + :coAmount
-- WHERE job_id = :jobId AND cost_code_id = :costCodeId
```

**Benefits**:
- Budget shows: Original $4,500 + CO $500 = $5,000 committed
- Variance reports explain overages
- Change order impact visible in G703

---

## Fix #4: Daily Logs → Budget Actuals

**Problem**: Daily logs track labor hours but don't update budget actual costs.

**Current State**:
```
Daily Log: Framing crew, 4 workers, 8 hours each = 32 hours
Budget:    ❌ No labor cost recorded
```

**Solution**:
```sql
-- Add labor rate to daily log crew (or pull from PO)
ALTER TABLE v2_daily_log_crew
ADD COLUMN hourly_rate DECIMAL(10,2),
ADD COLUMN labor_cost DECIMAL(12,2) GENERATED ALWAYS AS (hours * headcount * COALESCE(hourly_rate, 0)) STORED;

-- API endpoint to sync to budget
POST /api/daily-logs/:id/sync-to-budget
-- Aggregates labor_cost by cost_code_id
-- Updates v2_budget_lines.actual_labor_cost
```

**Benefits**:
- Real-time labor cost tracking
- Budget shows: Material cost + Labor cost = Total actual
- Compare: PO amount vs (invoices + labor)

---

## Fix #5: Schedule ↔ Daily Logs Sync

**Problem**: Daily logs don't update schedule progress.

**Current State**:
```
Schedule Task: "Framing" - 0% complete (manual)
Daily Logs:    4 days of framing logged
Reality:       Task is ~60% done based on hours
```

**Solution**:
```javascript
// When daily log is saved, update schedule task
async function syncDailyLogToSchedule(dailyLog) {
  for (const crew of dailyLog.crew_entries) {
    if (crew.schedule_task_id) {
      const task = await getScheduleTask(crew.schedule_task_id);
      const totalHoursLogged = await getTotalHoursForTask(crew.schedule_task_id);
      const estimatedHours = task.estimated_days * 8; // Assume 8-hour days

      const percentComplete = Math.min(100, (totalHoursLogged / estimatedHours) * 100);

      await updateScheduleTask(crew.schedule_task_id, {
        percent_complete: percentComplete,
        actual_start: task.actual_start || dailyLog.log_date,
      });
    }
  }
}
```

**Benefits**:
- Schedule auto-updates from field data
- No manual % complete entry
- Accurate project progress tracking

---

# PART 3: MISSING FEATURES (Must Add)

## Feature #1: RFIs (Requests for Information)

**Why Needed**: Every construction project has questions that need answers before work proceeds.

**Data Model**:
```sql
CREATE TABLE v2_rfis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  rfi_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  submitted_by UUID REFERENCES v2_users(id),
  submitted_to TEXT, -- Architect, Engineer, Owner
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  response TEXT,
  responded_by TEXT,
  responded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'open', -- open, answered, closed

  -- Impact tracking
  cost_impact DECIMAL(12,2),
  schedule_impact_days INTEGER,
  affected_cost_codes UUID[], -- Array of cost code IDs
  affected_schedule_tasks UUID[], -- Array of task IDs

  -- Links
  related_po_id UUID REFERENCES v2_purchase_orders(id),
  related_co_id UUID REFERENCES v2_change_orders(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE v2_rfi_attachments (
  id UUID PRIMARY KEY,
  rfi_id UUID REFERENCES v2_rfis(id),
  file_url TEXT,
  file_name TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration Points**:
- Links to schedule tasks (delays)
- Links to change orders (cost impact)
- Links to POs (affected work)
- Shows in job dashboard

---

## Feature #2: Submittals

**Why Needed**: Material/product approvals before installation.

**Data Model**:
```sql
CREATE TABLE v2_submittals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  submittal_number TEXT NOT NULL,
  spec_section TEXT, -- "09300 - Tile"
  description TEXT NOT NULL,

  -- Submission
  submitted_by_vendor_id UUID REFERENCES v2_vendors(id),
  submitted_at TIMESTAMPTZ,

  -- Review
  status TEXT DEFAULT 'pending', -- pending, approved, approved_as_noted, revise_resubmit, rejected
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT,

  -- Links
  po_id UUID REFERENCES v2_purchase_orders(id),
  selection_id UUID REFERENCES v2_selections(id),
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),

  -- Schedule impact
  required_by DATE, -- When approval needed to stay on schedule
  lead_time_days INTEGER, -- How long to get material after approval

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration Points**:
- Blocks schedule task until approved
- Links to selection (if client-chosen item)
- Links to PO (procurement)
- Shows on vendor dashboard

---

## Feature #3: Photo Documentation

**Why Needed**: Visual record of progress, issues, conditions.

**Data Model**:
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
  location_description TEXT, -- "Master bathroom"
  gps_lat DECIMAL(10,8),
  gps_lng DECIMAL(11,8),

  -- Links (can have multiple)
  daily_log_id UUID REFERENCES v2_daily_logs(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  punch_item_id UUID REFERENCES v2_punch_items(id),
  rfi_id UUID REFERENCES v2_rfis(id),

  -- Categorization
  category TEXT, -- progress, issue, delivery, inspection, weather
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- AI-generated
  ai_description TEXT,
  ai_detected_trade TEXT,
  ai_detected_issues TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration Points**:
- Daily logs link to photos
- Schedule milestones have progress photos
- Punch items have before/after photos
- AI can analyze photos for progress

---

## Feature #4: Client Portal

**Why Needed**: Homeowners want visibility into their project.

**Data Model**:
```sql
CREATE TABLE v2_client_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'owner', -- owner, spouse, designer

  -- Permissions
  can_view_budget BOOLEAN DEFAULT false,
  can_view_schedule BOOLEAN DEFAULT true,
  can_view_photos BOOLEAN DEFAULT true,
  can_approve_selections BOOLEAN DEFAULT true,
  can_approve_change_orders BOOLEAN DEFAULT true,
  can_approve_draws BOOLEAN DEFAULT false,

  -- Auth
  password_hash TEXT,
  last_login TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE v2_client_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_user_id UUID REFERENCES v2_client_users(id),
  approval_type TEXT, -- selection, change_order, draw
  reference_id UUID, -- ID of the thing being approved
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_at TIMESTAMPTZ,
  comments TEXT,
  signature_url TEXT, -- Digital signature image
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Client Portal Features**:
- View schedule (simplified)
- View and approve selections
- View and approve change orders
- View draw requests
- View progress photos
- Message project manager

---

## Feature #5: Allowances & Selections Tracking

**Why Needed**: Track client allowances and what they've selected.

**Enhanced Data Model**:
```sql
-- Enhance existing v2_allowances
ALTER TABLE v2_allowances ADD COLUMN IF NOT EXISTS
  budget_amount DECIMAL(12,2),
  spent_amount DECIMAL(12,2) DEFAULT 0,
  variance DECIMAL(12,2) GENERATED ALWAYS AS (spent_amount - budget_amount) STORED,
  status TEXT DEFAULT 'open'; -- open, selected, ordered, installed

-- Enhance existing v2_selections
ALTER TABLE v2_selections ADD COLUMN IF NOT EXISTS
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  po_id UUID REFERENCES v2_purchase_orders(id),
  submittal_id UUID REFERENCES v2_submittals(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  lead_time_days INTEGER,
  order_by_date DATE GENERATED ALWAYS AS (
    (SELECT start_date - lead_time_days FROM v2_schedule_tasks WHERE id = schedule_task_id)
  ) STORED;
```

**Integration Points**:
- Selection → creates Submittal
- Selection approved → updates Allowance spent
- Selection → links to Schedule (lead time calculation)
- Selection → triggers PO creation
- Allowance variance → shows in Budget

---

## Feature #6: Cash Flow Forecasting

**Why Needed**: Know when money is needed and when it's coming.

**Data Model**:
```sql
CREATE TABLE v2_cash_flow_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  entry_date DATE NOT NULL,
  entry_type TEXT NOT NULL, -- inflow, outflow
  category TEXT, -- draw, invoice, retainage, deposit

  -- Source reference
  draw_id UUID REFERENCES v2_draws(id),
  invoice_id UUID REFERENCES v2_invoices(id),
  po_id UUID REFERENCES v2_purchase_orders(id),

  amount DECIMAL(12,2) NOT NULL,
  is_projected BOOLEAN DEFAULT true, -- false when actual
  confidence TEXT, -- high, medium, low
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- View for cash flow report
CREATE VIEW v2_cash_flow_summary AS
SELECT
  job_id,
  entry_date,
  SUM(CASE WHEN entry_type = 'inflow' THEN amount ELSE 0 END) as inflows,
  SUM(CASE WHEN entry_type = 'outflow' THEN amount ELSE 0 END) as outflows,
  SUM(CASE WHEN entry_type = 'inflow' THEN amount ELSE -amount END) as net
FROM v2_cash_flow_entries
GROUP BY job_id, entry_date
ORDER BY entry_date;
```

**Auto-Population**:
- When draw is created → projected inflow at expected fund date
- When PO is created → projected outflow at expected invoice dates
- When invoice arrives → actual outflow at due date
- When draw is funded → actual inflow

---

## Feature #7: Communications Log

**Why Needed**: Track all project communications for reference.

**Data Model**:
```sql
CREATE TABLE v2_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,

  -- Type
  comm_type TEXT NOT NULL, -- email, phone, meeting, text, site_visit
  direction TEXT, -- inbound, outbound, internal

  -- Parties
  from_user_id UUID REFERENCES v2_users(id),
  from_vendor_id UUID REFERENCES v2_vendors(id),
  from_client BOOLEAN DEFAULT false,
  to_parties TEXT[], -- Array of names/emails

  -- Content
  subject TEXT,
  summary TEXT NOT NULL,
  full_content TEXT, -- Email body, meeting notes

  -- Links
  related_rfi_id UUID REFERENCES v2_rfis(id),
  related_co_id UUID REFERENCES v2_change_orders(id),
  related_invoice_id UUID REFERENCES v2_invoices(id),
  related_schedule_task_id UUID REFERENCES v2_schedule_tasks(id),

  -- Metadata
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  logged_by UUID REFERENCES v2_users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration Points**:
- Link to RFIs, COs, Invoices
- Show in job timeline
- Search across all communications
- Email integration (future)

---

## Feature #8: Inspection Tracking

**Why Needed**: Track building inspections and their results.

**Data Model**:
```sql
CREATE TABLE v2_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,

  -- Type
  inspection_type TEXT NOT NULL, -- footing, slab, framing, rough_electric, rough_plumbing, insulation, drywall, final
  description TEXT,

  -- Scheduling
  requested_date DATE,
  scheduled_date DATE,
  inspector_name TEXT,

  -- Result
  status TEXT DEFAULT 'pending', -- pending, scheduled, passed, failed, partial
  inspected_at TIMESTAMPTZ,
  result_notes TEXT,
  corrections_required TEXT[],

  -- Links
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id), -- What task this enables
  blocking_tasks UUID[], -- Tasks that can't start until this passes

  -- Documents
  permit_id UUID REFERENCES v2_permits(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Integration Points**:
- Schedule tasks blocked until inspection passes
- Failed inspection creates RFI or punch items
- Links to permits
- Shows on job calendar

---

# PART 4: ENHANCED INTEGRATIONS

## Enhancement #1: Vendor Performance Scorecards

**Current**: Data exists in v2_vendor_trade_scores but not displayed.

**Enhancement**:
```javascript
// API: GET /api/vendors/:id/scorecard
{
  vendor: { id, name },
  overall_score: 4.2,
  by_trade: [
    {
      trade: "Framing",
      jobs_completed: 12,
      avg_quality: 4.5,
      on_time_percent: 85,
      cost_variance_percent: +3.2, // Typically 3.2% over bid
      productivity: {
        baseline_days_per_sf: 0.002,
        actual_days_per_sf: 0.0019, // 5% faster than baseline
      }
    }
  ],
  recent_projects: [
    { job_name, trade, quality_rating, on_time, cost_variance }
  ]
}

// Show in:
// 1. Vendor detail page
// 2. Bid comparison view (next to each bid)
// 3. PO creation (warning if vendor has issues)
```

**UI**: Add "Performance" tab to Vendor detail and show scorecard when evaluating bids.

---

## Enhancement #2: AI-Powered Invoice Allocation

**Current**: User manually allocates invoice to cost codes.

**Enhancement**:
```javascript
// When invoice is processed, AI suggests allocation
POST /api/invoices/:id/suggest-allocation

// AI analyzes:
// 1. Invoice line items ("Framing labor", "2x4 lumber")
// 2. Linked PO cost codes
// 3. Historical allocation patterns for this vendor

// Returns:
{
  suggestions: [
    {
      cost_code_id: "06100",
      cost_code_name: "Rough Carpentry",
      amount: 12500,
      confidence: 0.95,
      reason: "Invoice mentions 'framing' and linked PO is for framing"
    },
    {
      cost_code_id: "06200",
      cost_code_name: "Finish Carpentry",
      amount: 2500,
      confidence: 0.75,
      reason: "Line item 'trim work' matches finish carpentry"
    }
  ]
}
```

---

## Enhancement #3: Schedule Intelligence

**Current**: Schedule has tasks with manual dates and dependencies.

**Enhancement**:
```javascript
// Automatic duration calculation from scope
POST /api/schedules/:id/calculate-durations

// For each task:
// 1. Get linked scope category (e.g., "Tile Installation")
// 2. Get job scope quantity (e.g., 1500 SF)
// 3. Get baseline productivity (0.015 days/SF)
// 4. Check vendor history (if assigned)
// 5. Calculate: 1500 * 0.015 = 22.5 days

// Also considers:
// - Crew size adjustments
// - Weather patterns for time of year
// - Historical job data for similar scope

// Returns adjusted schedule with:
{
  tasks: [
    {
      id: "task-123",
      name: "Tile Installation",
      original_days: 20,
      calculated_days: 23,
      factors: [
        "Scope: 1500 SF × 0.015 days/SF = 22.5 days",
        "Vendor ABC typically +5% slower: 23.6 days",
        "February in FL: no weather adjustment",
        "Rounded to 23 days"
      ]
    }
  ]
}
```

---

## Enhancement #4: Budget Variance Alerts

**Current**: Budget shows numbers but no proactive alerts.

**Enhancement**:
```javascript
// Real-time budget monitoring
GET /api/jobs/:id/budget/alerts

{
  alerts: [
    {
      type: "over_committed",
      severity: "warning",
      cost_code: "06100 Rough Carpentry",
      message: "Committed $52,000 exceeds budget of $50,000",
      variance: -2000,
      variance_percent: -4,
      related_pos: ["PO-123", "PO-124"]
    },
    {
      type: "change_order_impact",
      severity: "info",
      cost_code: "09250 Drywall",
      message: "3 change orders have added $8,500 to this cost code",
      original_budget: 25000,
      current_committed: 33500
    },
    {
      type: "trending_over",
      severity: "warning",
      cost_code: "26000 Electrical",
      message: "Based on 60% billed, projecting $45,000 final vs $40,000 budget",
      projected_final: 45000,
      budget: 40000
    }
  ]
}
```

**UI**: Show alerts on Job Dashboard and Budget page.

---

## Enhancement #5: Proposal → Contract → Job Flow

**Current**: Proposals, contracts, and jobs are separate.

**Enhancement**:
```javascript
// Proposal workflow
POST /api/proposals
// Creates proposal with scope, pricing

POST /api/proposals/:id/send-to-client
// Sends proposal, tracks views

POST /api/proposals/:id/accept
// Client accepts, creates contract

POST /api/contracts/:id/sign
// Both parties sign digitally

POST /api/contracts/:id/convert-to-job
// Creates job with:
// - Budget from proposal line items
// - Allowances from proposal allowances
// - Schedule template applied
// - Client portal account created
```

---

## Enhancement #6: Closeout Analysis

**Current**: Job closeout is manual.

**Enhancement**:
```javascript
// Generate closeout report
GET /api/jobs/:id/closeout-report

{
  summary: {
    contract_amount: 500000,
    change_orders: 25000,
    final_contract: 525000,
    total_cost: 512000,
    gross_profit: 13000,
    gross_margin_percent: 2.5
  },

  by_cost_code: [
    {
      code: "06100",
      name: "Rough Carpentry",
      estimated: 50000,
      actual: 52500,
      variance: -2500,
      variance_percent: -5,
      notes: "CO #3 added $2000 for header changes"
    }
  ],

  schedule_performance: {
    original_duration_days: 180,
    actual_duration_days: 195,
    variance_days: 15,
    delay_causes: [
      { cause: "Weather", days: 5 },
      { cause: "RFI delays", days: 7 },
      { cause: "Client changes", days: 3 }
    ]
  },

  vendor_performance: [
    {
      vendor: "ABC Framing",
      trade: "Framing",
      quality_rating: 4.5,
      on_time: true,
      cost_variance: +3
    }
  ],

  lessons_learned: [
    "Framing scope underestimated by 5% - update baseline",
    "Tile lead time was 6 weeks, not 4 - update templates"
  ]
}
```

---

# PART 5: IMPLEMENTATION PHASES

## Phase 1: Foundation Fixes (2-3 weeks)

**Goal**: Fix broken data connections

| Task | Priority | Effort |
|------|----------|--------|
| Add source_bid_id to v2_purchase_orders | Critical | 1 day |
| Add cost_code_id to v2_schedule_tasks | Critical | 1 day |
| Add cost_code_id to v2_daily_log_crew | Critical | 1 day |
| Create v2_change_order_lines table | Critical | 2 days |
| Daily logs → Budget sync endpoint | High | 3 days |
| Daily logs → Schedule sync endpoint | High | 3 days |
| Budget recalculation triggers | High | 2 days |

**Deliverable**: All core data properly linked.

---

## Phase 2: Missing Core Features (3-4 weeks)

**Goal**: Add essential construction management features

| Task | Priority | Effort |
|------|----------|--------|
| RFIs - full CRUD + UI | High | 4 days |
| Submittals - full CRUD + UI | High | 4 days |
| Photo documentation system | High | 3 days |
| Inspection tracking | High | 3 days |
| Allowance/Selection enhancements | Medium | 3 days |
| Communications log | Medium | 2 days |

**Deliverable**: Complete project management toolkit.

---

## Phase 3: Intelligence Layer (2-3 weeks)

**Goal**: Make system smart and predictive

| Task | Priority | Effort |
|------|----------|--------|
| Vendor scorecard API + UI | High | 3 days |
| AI invoice allocation | Medium | 4 days |
| Schedule duration calculator | Medium | 3 days |
| Budget variance alerts | High | 2 days |
| Cash flow forecasting | Medium | 4 days |

**Deliverable**: Proactive insights and recommendations.

---

## Phase 4: Client Experience (2 weeks)

**Goal**: Client portal and self-service

| Task | Priority | Effort |
|------|----------|--------|
| Client user management | High | 2 days |
| Client portal - view schedule | High | 2 days |
| Client portal - approve selections | High | 2 days |
| Client portal - approve change orders | High | 2 days |
| Client portal - view draws | Medium | 1 day |
| Digital signatures | Medium | 2 days |

**Deliverable**: Clients can self-serve and approve items.

---

## Phase 5: Workflow Automation (2 weeks)

**Goal**: Reduce manual work

| Task | Priority | Effort |
|------|----------|--------|
| Proposal → Contract → Job flow | High | 4 days |
| Auto-create PO from awarded bid | High | 2 days |
| Auto-update budget from PO changes | High | 2 days |
| Closeout report generator | Medium | 3 days |
| Email notifications | Medium | 2 days |

**Deliverable**: Automated workflows reduce clicks.

---

## Phase 6: Polish & Optimization (Ongoing)

**Goal**: Performance, UX, edge cases

| Task | Priority | Effort |
|------|----------|--------|
| Dashboard redesign with KPIs | Medium | 3 days |
| Bulk operations | Medium | 2 days |
| Advanced filtering | Medium | 2 days |
| Mobile responsiveness | Medium | 3 days |
| Report builder | Low | 5 days |

---

# PART 6: DASHBOARD REDESIGN

## Current Dashboard Issues

- Shows basic stats (count of jobs, invoices, etc.)
- No actionable insights
- No drill-down
- No alerts

## Proposed Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROSS BUILT DASHBOARD                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        ACTION ITEMS (5)                              │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ ⚠️  3 invoices need approval               [Review]                  │   │
│  │ ⚠️  2 selections awaiting client approval  [View]                    │   │
│  │ 🔴  Drummond job: Framing is 3 days behind [Schedule]                │   │
│  │ 📋  5 submittals need review               [Review]                  │   │
│  │ 💰  Draw #4 ready to submit                [Submit]                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐                      │
│  │    ACTIVE JOBS (4)    │  │   CASH FLOW (30 days) │                      │
│  ├───────────────────────┤  ├───────────────────────┤                      │
│  │ Drummond    78% ████░░│  │ Expected In:  $245,000│                      │
│  │ Crews       45% ███░░░│  │ Expected Out: $180,000│                      │
│  │ Johnson     12% █░░░░░│  │ Net:          +$65,000│                      │
│  │ Smith        5% ░░░░░░│  │ [View Forecast]       │                      │
│  │ [View All]            │  │                       │                      │
│  └───────────────────────┘  └───────────────────────┘                      │
│                                                                              │
│  ┌───────────────────────┐  ┌───────────────────────┐                      │
│  │  BUDGET ALERTS (3)    │  │  THIS WEEK            │                      │
│  ├───────────────────────┤  ├───────────────────────┤                      │
│  │ 🔴 Drummond Electrical │  │ Mon: Framing insp.    │                      │
│  │    $5K over committed │  │ Tue: Tile delivery    │                      │
│  │ 🟡 Crews Drywall      │  │ Wed: Client meeting   │                      │
│  │    Trending 8% over   │  │ Thu: Draw due         │                      │
│  │ 🟡 Johnson Cabinets   │  │ Fri: Final walkthrough│                      │
│  │    Selection pending  │  │                       │                      │
│  └───────────────────────┘  └───────────────────────┘                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        RECENT ACTIVITY                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ 10:32 AM  Invoice #4521 approved by Jake         [Drummond]          │   │
│  │ 10:15 AM  Daily log submitted                    [Crews]             │   │
│  │  9:45 AM  PO #0043 created for ABC Framing       [Johnson]           │   │
│  │  9:30 AM  Client approved kitchen selections     [Smith]             │   │
│  │  Yesterday  Draw #3 funded: $125,000             [Drummond]          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# PART 7: COMPLETE ENTITY RELATIONSHIP

## How Everything Links (Final State)

```
                                    ┌─────────────┐
                                    │    JOB      │
                                    └──────┬──────┘
                                           │
           ┌───────────────────────────────┼───────────────────────────────┐
           │                               │                               │
           ▼                               ▼                               ▼
    ┌─────────────┐                 ┌─────────────┐                 ┌─────────────┐
    │   BUDGET    │◄───────────────►│  SCHEDULE   │◄───────────────►│  ESTIMATE   │
    │             │   syncs          │             │   informs        │             │
    │ by cost code│                 │ with tasks  │                 │ by cost code│
    └──────┬──────┘                 └──────┬──────┘                 └──────┬──────┘
           │                               │                               │
           │ ┌─────────────────────────────┤                               │
           │ │                             │                               │
           ▼ ▼                             ▼                               │
    ┌─────────────┐                 ┌─────────────┐                        │
    │     PO      │────────────────►│ DAILY LOGS  │                        │
    │             │   worked on      │             │                        │
    │ committed $ │◄────────────────│ actual work │                        │
    └──────┬──────┘   updates %      └──────┬──────┘                        │
           │                               │                               │
           │                               │                               │
           ▼                               ▼                               │
    ┌─────────────┐                 ┌─────────────┐                        │
    │  INVOICES   │                 │   PHOTOS    │                        │
    │             │                 │             │                        │
    │ billed $    │                 │ progress    │                        │
    └──────┬──────┘                 └─────────────┘                        │
           │                                                               │
           ▼                                                               │
    ┌─────────────┐                 ┌─────────────┐                 ┌─────────────┐
    │   DRAWS     │                 │   CLIENT    │◄────────────────│ SELECTIONS  │
    │             │────────────────►│   PORTAL    │   approves      │             │
    │ G702/G703   │   client views  │             │                 │ allowances  │
    └─────────────┘                 └─────────────┘                 └──────┬──────┘
                                                                          │
                                                                          │
    ┌─────────────┐                 ┌─────────────┐                        │
    │    RFIS     │◄───────────────►│ SUBMITTALS  │◄───────────────────────┘
    │             │   may create    │             │   creates
    │ questions   │                 │ approvals   │
    └──────┬──────┘                 └─────────────┘
           │
           ▼
    ┌─────────────┐                 ┌─────────────┐
    │   CHANGE    │────────────────►│ PERFORMANCE │
    │   ORDERS    │   tracked       │ INTELLIGENCE│
    │             │                 │             │
    └─────────────┘                 │ learns from │
                                    │ every job   │
                                    └─────────────┘
```

---

# SUMMARY

## What This Plan Achieves

1. **No More Data Silos**: Everything connects and syncs automatically
2. **Proactive Alerts**: System tells you problems before they're disasters
3. **Intelligence**: Learns from every project to improve estimates, schedules, vendor selection
4. **Client Experience**: Homeowners have visibility and can approve items
5. **Reduced Manual Work**: Automated workflows for common processes
6. **Complete Audit Trail**: Every dollar, every decision, every change is tracked

## Key Metrics After Implementation

| Metric | Before | After |
|--------|--------|-------|
| Manual data entry points | 50+ | 15 |
| Budget accuracy | Manual | Auto-calculated |
| Schedule updates | Weekly manual | Daily automatic |
| Client communication | Email/phone | Portal + notifications |
| Vendor evaluation | Gut feel | Data-driven scorecards |
| Closeout reports | Manual Excel | Auto-generated |

## Next Steps

1. Review this plan and prioritize phases
2. Start with Phase 1 (Foundation Fixes) - 2-3 weeks
3. Build incrementally, testing integrations at each step
4. Get user feedback after each phase

---

*This document should be treated as a living roadmap. Update priorities based on business needs and user feedback.*
