# Architecture Research: v3.0 Smart Catalog & Estimation Engine

**Project:** Ross Built CMS v3.0
**Researched:** 2026-01-20
**Confidence:** HIGH (based on existing schema analysis + industry patterns)

## System Overview

v3.0 extends the existing Ross Built CMS with intelligent estimation, scheduling, and document processing capabilities. The architecture builds on existing core entities (jobs, vendors, cost codes, invoices, POs) while adding new layers for catalog enhancement, trade performance tracking, AI document intelligence, and feedback loops.

```
                                    +------------------------------------------+
                                    |         DOCUMENT INTELLIGENCE           |
                                    |  (AI parsing: specs, quotes, invoices)  |
                                    +-------------------+----------------------+
                                                        |
                    +-----------------------------------+-----------------------------------+
                    |                                   |                                   |
                    v                                   v                                   v
+-------------------+-------+     +-------------------+-------+     +-------------------+-------+
|   ENHANCED CATALOG        |     |   ESTIMATE BUILDER        |     |   SCHEDULE GENERATOR      |
| - Labor hours/rates       |     | - Selection -> Cost lines |     | - Selection -> Tasks      |
| - Duration estimates      |     | - Assembly templates      |     | - CPM calculation         |
| - Lead times              |     | - Trade bid integration   |     | - Resource leveling       |
| - Dependencies            |     | - Budget generation       |     | - Permit integration      |
+-----------+---------------+     +-----------+---------------+     +-----------+---------------+
            |                                 |                                 |
            +----------------+----------------+                                 |
                             |                                                  |
                             v                                                  |
               +-------------+---------------+                                  |
               |   EXISTING CMS CORE         |<---------------------------------+
               | - Jobs, Vendors, Cost Codes |
               | - Invoices, POs, Draws      |
               | - Selections, Allowances    |
               | - Schedules, Permits        |
               | - Price Intelligence        |
               +-------------+---------------+
                             |
                             v
               +-------------+---------------+
               |   TRADE SCORECARDS          |
               | - Quality metrics           |
               | - Speed metrics             |
               | - Reliability metrics       |
               | - Price competitiveness     |
               +-------------+---------------+
                             |
                             v
               +-------------+---------------+
               |   FEEDBACK LOOPS            |
               | - Actuals vs Estimates      |
               | - Duration variance         |
               | - Price variance            |
               | - Scorecard updates         |
               +-----------------------------+
```

## Data Model

### New Tables

#### 1. Enhanced Catalog Tables

```sql
-- Labor catalog: extends selection_catalog with construction data
CREATE TABLE v2_labor_catalog (
  id UUID PRIMARY KEY,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  category_id UUID REFERENCES v2_selection_categories(id),

  -- Identity
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,                    -- 'each', 'sqft', 'lnft', 'opening'

  -- Labor data
  labor_hours_per_unit DECIMAL(8,3),     -- Hours to complete 1 unit
  labor_rate_low DECIMAL(10,2),          -- $/hr low estimate
  labor_rate_mid DECIMAL(10,2),          -- $/hr typical estimate
  labor_rate_high DECIMAL(10,2),         -- $/hr premium estimate
  crew_size_typical INTEGER DEFAULT 1,   -- Typical crew size

  -- Duration data
  duration_days_per_unit DECIMAL(8,3),   -- Calendar days per unit
  duration_minimum_days INTEGER,         -- Minimum days regardless of quantity
  duration_setup_hours DECIMAL(6,2),     -- One-time setup/mobilization

  -- Lead time data
  lead_time_days INTEGER,                -- Days from order to delivery
  lead_time_rush_days INTEGER,           -- Rush delivery option
  lead_time_rush_premium DECIMAL(5,2),   -- % premium for rush

  -- Dependencies (JSON array of cost_code_ids that must complete first)
  prerequisite_cost_codes UUID[],
  successor_cost_codes UUID[],

  -- Scheduling hints
  can_overlap_with UUID[],               -- Cost codes this can run concurrent with
  weather_sensitive BOOLEAN DEFAULT false,
  inspection_required BOOLEAN DEFAULT false,
  permit_type TEXT,                       -- 'building', 'electrical', 'plumbing', etc.

  -- Metadata
  source TEXT,                           -- 'manual', 'rsmeans', 'historical', 'ai_extracted'
  confidence_score DECIMAL(5,4),
  sample_count INTEGER DEFAULT 0,        -- How many projects this is based on
  last_updated_from UUID,                -- Job ID of last update source

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Assembly templates: pre-built groupings of catalog items
CREATE TABLE v2_assemblies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,                         -- 'kitchen', 'bathroom', 'bedroom', etc.
  assembly_type TEXT,                    -- 'room', 'system', 'phase'

  -- Calculated totals (updated by trigger)
  total_labor_hours DECIMAL(10,2),
  total_material_cost DECIMAL(12,2),
  total_labor_cost DECIMAL(12,2),
  total_duration_days INTEGER,

  -- Usage tracking
  times_used INTEGER DEFAULT 0,
  last_used_job_id UUID REFERENCES v2_jobs(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assembly line items: what's in each assembly
CREATE TABLE v2_assembly_items (
  id UUID PRIMARY KEY,
  assembly_id UUID REFERENCES v2_assemblies(id) ON DELETE CASCADE,

  -- Can reference either labor catalog or selection catalog
  labor_catalog_id UUID REFERENCES v2_labor_catalog(id),
  selection_catalog_id UUID REFERENCES v2_selection_catalog(id),

  quantity_default DECIMAL(10,2) DEFAULT 1,
  quantity_formula TEXT,                 -- 'sqft * 1.1', 'openings * 2', etc.
  is_optional BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  notes TEXT
);
```

#### 2. Trade Scorecard Tables

```sql
-- Trade scorecards: aggregated performance metrics per vendor per trade
CREATE TABLE v2_trade_scorecards (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id),
  trade TEXT NOT NULL,                   -- 'Framing', 'Electrical', 'Plumbing', etc.

  -- Quality metrics (0-100 scale)
  quality_score DECIMAL(5,2),
  quality_punch_rate DECIMAL(5,2),       -- % of work requiring punch list
  quality_rework_rate DECIMAL(5,2),      -- % requiring rework
  quality_inspection_pass_rate DECIMAL(5,2),

  -- Speed metrics
  speed_score DECIMAL(5,2),
  speed_avg_variance_percent DECIMAL(6,2), -- Actual vs estimated duration
  speed_on_time_rate DECIMAL(5,2),       -- % completed on/before schedule

  -- Reliability metrics
  reliability_score DECIMAL(5,2),
  reliability_show_rate DECIMAL(5,2),    -- % of scheduled days they show
  reliability_response_hours DECIMAL(6,2), -- Avg hours to respond
  reliability_callback_rate DECIMAL(5,2), -- % of jobs with callbacks

  -- Price metrics
  price_score DECIMAL(5,2),
  price_vs_market DECIMAL(6,2),          -- % above/below market average
  price_bid_accuracy DECIMAL(5,2),       -- % of bids within 10% of final

  -- Overall composite
  overall_score DECIMAL(5,2),
  tier TEXT,                             -- 'preferred', 'approved', 'probation', 'inactive'

  -- Data quality
  job_count INTEGER DEFAULT 0,
  po_count INTEGER DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  last_job_id UUID REFERENCES v2_jobs(id),
  last_calculated_at TIMESTAMPTZ,

  -- Manual overrides
  manual_notes TEXT,
  manual_tier_override TEXT,
  manual_override_reason TEXT,
  manual_override_by TEXT,
  manual_override_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, trade)
);

-- Scorecard events: individual data points that feed scorecards
CREATE TABLE v2_scorecard_events (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id),
  trade TEXT NOT NULL,
  job_id UUID REFERENCES v2_jobs(id),

  -- Event type and source
  event_type TEXT NOT NULL,              -- 'punch_item', 'inspection', 'schedule_variance', 'callback', etc.
  source_type TEXT,                      -- 'punch_list', 'permit_inspection', 'schedule_task', 'invoice'
  source_id UUID,

  -- Metrics (populate what's relevant)
  quality_impact DECIMAL(5,2),           -- Positive = good, negative = bad
  speed_impact DECIMAL(5,2),
  reliability_impact DECIMAL(5,2),
  price_impact DECIMAL(5,2),

  -- Context
  description TEXT,
  details JSONB,                         -- Flexible storage for event-specific data

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scorecard history: track changes over time
CREATE TABLE v2_scorecard_history (
  id UUID PRIMARY KEY,
  scorecard_id UUID REFERENCES v2_trade_scorecards(id),

  snapshot_date DATE NOT NULL,
  overall_score DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  speed_score DECIMAL(5,2),
  reliability_score DECIMAL(5,2),
  price_score DECIMAL(5,2),
  tier TEXT,
  job_count INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Document Intelligence Tables

```sql
-- Document processing queue
CREATE TABLE v2_document_queue (
  id UUID PRIMARY KEY,

  -- Document info
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,                        -- 'invoice', 'quote', 'spec', 'plan', 'permit', 'warranty'
  mime_type TEXT,
  file_size INTEGER,

  -- Processing state
  status TEXT DEFAULT 'pending',         -- 'pending', 'processing', 'completed', 'failed', 'manual_review'
  priority INTEGER DEFAULT 0,            -- Higher = process first
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  error_message TEXT,

  -- AI extraction results
  extracted_data JSONB,                  -- Raw AI extraction
  extraction_confidence DECIMAL(5,4),
  extraction_model TEXT,                 -- Which model processed it

  -- Destination routing
  target_entity_type TEXT,               -- 'invoice', 'catalog', 'schedule', 'permit', 'warranty'
  target_entity_id UUID,                 -- If updating existing record
  created_entity_id UUID,                -- If created new record

  -- Manual review
  needs_review BOOLEAN DEFAULT false,
  review_flags TEXT[],
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,

  -- Context
  job_id UUID REFERENCES v2_jobs(id),
  vendor_id UUID REFERENCES v2_vendors(id),
  uploaded_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Document extraction rules: teach the AI what to look for
CREATE TABLE v2_extraction_rules (
  id UUID PRIMARY KEY,

  document_type TEXT NOT NULL,           -- 'invoice', 'quote', 'spec'
  vendor_id UUID REFERENCES v2_vendors(id), -- NULL = applies to all

  -- Field mapping rules
  field_name TEXT NOT NULL,              -- 'invoice_number', 'unit_price', 'labor_hours'
  extraction_method TEXT,                -- 'regex', 'keyword', 'position', 'ai'
  extraction_pattern TEXT,               -- Regex or keyword list
  extraction_prompt TEXT,                -- AI prompt for extraction

  -- Validation
  validation_type TEXT,                  -- 'number', 'date', 'text', 'currency'
  validation_min DECIMAL(12,2),
  validation_max DECIMAL(12,2),
  validation_pattern TEXT,

  -- Learning
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  last_success_at TIMESTAMPTZ,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document destinations: where extracted data should go
CREATE TABLE v2_document_destinations (
  id UUID PRIMARY KEY,
  document_queue_id UUID REFERENCES v2_document_queue(id),

  destination_table TEXT NOT NULL,       -- 'v2_labor_catalog', 'v2_price_history', etc.
  destination_field TEXT NOT NULL,
  extracted_value TEXT,
  applied BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 4. Feedback Loop Tables

```sql
-- Estimate vs Actuals tracking
CREATE TABLE v2_estimate_actuals (
  id UUID PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  estimate_id UUID REFERENCES v2_estimates(id),

  -- Cost code level tracking
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Estimated values (captured at job start)
  estimated_labor_hours DECIMAL(10,2),
  estimated_labor_cost DECIMAL(12,2),
  estimated_material_cost DECIMAL(12,2),
  estimated_duration_days INTEGER,
  estimated_total DECIMAL(12,2),

  -- Actual values (calculated from invoices, time tracking, schedule)
  actual_labor_hours DECIMAL(10,2),
  actual_labor_cost DECIMAL(12,2),
  actual_material_cost DECIMAL(12,2),
  actual_duration_days INTEGER,
  actual_total DECIMAL(12,2),

  -- Variance calculations
  labor_hours_variance DECIMAL(10,2),
  labor_cost_variance DECIMAL(12,2),
  material_cost_variance DECIMAL(12,2),
  duration_variance_days INTEGER,
  total_variance DECIMAL(12,2),
  variance_percent DECIMAL(6,2),

  -- Root cause analysis
  variance_reasons TEXT[],               -- ['scope_change', 'weather', 'material_price', 'labor_productivity']
  notes TEXT,

  -- Feedback application
  feedback_applied BOOLEAN DEFAULT false,
  feedback_applied_at TIMESTAMPTZ,
  catalog_items_updated UUID[],          -- Labor catalog items that were updated

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Schedule variance tracking
CREATE TABLE v2_schedule_actuals (
  id UUID PRIMARY KEY,
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  job_id UUID REFERENCES v2_jobs(id),

  -- Original plan
  planned_start DATE,
  planned_end DATE,
  planned_duration_days INTEGER,

  -- Actual execution
  actual_start DATE,
  actual_end DATE,
  actual_duration_days INTEGER,

  -- Variance
  start_variance_days INTEGER,
  end_variance_days INTEGER,
  duration_variance_days INTEGER,

  -- Contributing factors
  delay_reasons TEXT[],                  -- ['predecessor_delay', 'weather', 'resource', 'permit', 'material']
  weather_days INTEGER DEFAULT 0,

  -- Feedback application
  feedback_applied BOOLEAN DEFAULT false,
  catalog_items_updated UUID[],

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price variance tracking (extends existing price intelligence)
CREATE TABLE v2_price_actuals (
  id UUID PRIMARY KEY,
  master_item_id UUID REFERENCES v2_master_items(id),
  vendor_id UUID REFERENCES v2_vendors(id),
  job_id UUID REFERENCES v2_jobs(id),

  -- Estimated at PO creation
  estimated_unit_price DECIMAL(12,4),
  estimated_quantity DECIMAL(12,4),
  estimated_total DECIMAL(12,2),
  source_estimate_id UUID REFERENCES v2_estimates(id),

  -- Actual from invoices
  actual_unit_price DECIMAL(12,4),
  actual_quantity DECIMAL(12,4),
  actual_total DECIMAL(12,2),
  source_invoice_id UUID REFERENCES v2_invoices(id),

  -- Variance
  unit_price_variance DECIMAL(12,4),
  quantity_variance DECIMAL(12,4),
  total_variance DECIMAL(12,2),
  variance_percent DECIMAL(6,2),

  -- Feedback
  price_history_updated BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback rules: what triggers catalog updates
CREATE TABLE v2_feedback_rules (
  id UUID PRIMARY KEY,

  rule_type TEXT NOT NULL,               -- 'labor_hours', 'duration', 'material_price', 'scorecard'
  target_table TEXT NOT NULL,            -- Table to update
  target_field TEXT NOT NULL,            -- Field to update

  -- Trigger conditions
  min_sample_count INTEGER DEFAULT 3,    -- Minimum data points before applying
  max_variance_percent DECIMAL(5,2),     -- Ignore outliers beyond this
  recency_weight DECIMAL(5,4) DEFAULT 0.3, -- Weight given to recent data

  -- Update behavior
  update_method TEXT DEFAULT 'weighted_average', -- 'weighted_average', 'rolling_average', 'latest'
  auto_apply BOOLEAN DEFAULT false,      -- Auto-apply or require review
  requires_approval BOOLEAN DEFAULT true,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback application log
CREATE TABLE v2_feedback_log (
  id UUID PRIMARY KEY,

  rule_id UUID REFERENCES v2_feedback_rules(id),
  source_table TEXT,
  source_id UUID,
  target_table TEXT,
  target_id UUID,
  target_field TEXT,

  old_value DECIMAL(12,4),
  new_value DECIMAL(12,4),
  sample_count INTEGER,
  confidence DECIMAL(5,4),

  applied_by TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  reverted_at TIMESTAMPTZ,
  reverted_by TEXT
);
```

### Table Modifications

#### Existing Tables to Extend

```sql
-- v2_selection_catalog: Add construction data links
ALTER TABLE v2_selection_catalog
ADD COLUMN labor_catalog_id UUID REFERENCES v2_labor_catalog(id),
ADD COLUMN lead_time_days INTEGER,
ADD COLUMN typical_labor_hours DECIMAL(8,3),
ADD COLUMN installation_notes TEXT;

-- v2_vendors: Add scorecard summary
ALTER TABLE v2_vendors
ADD COLUMN overall_score DECIMAL(5,2),
ADD COLUMN preferred_trades TEXT[],
ADD COLUMN tier TEXT DEFAULT 'approved',
ADD COLUMN scorecard_updated_at TIMESTAMPTZ;

-- v2_invoices: Add feedback tracking
ALTER TABLE v2_invoices
ADD COLUMN feedback_extracted BOOLEAN DEFAULT false,
ADD COLUMN feedback_extracted_at TIMESTAMPTZ,
ADD COLUMN scorecard_events_created UUID[];

-- v2_schedule_tasks: Add actual tracking link
ALTER TABLE v2_schedule_tasks
ADD COLUMN labor_catalog_id UUID REFERENCES v2_labor_catalog(id),
ADD COLUMN estimated_labor_hours DECIMAL(8,2),
ADD COLUMN actual_labor_hours DECIMAL(8,2);

-- v2_estimates: Add assembly support
ALTER TABLE v2_estimates
ADD COLUMN uses_assemblies BOOLEAN DEFAULT false,
ADD COLUMN assembly_ids UUID[],
ADD COLUMN generated_schedule_id UUID REFERENCES v2_schedules(id);

-- v2_estimate_lines: Add catalog links
ALTER TABLE v2_estimate_lines
ADD COLUMN labor_catalog_id UUID REFERENCES v2_labor_catalog(id),
ADD COLUMN selection_id UUID REFERENCES v2_selections(id),
ADD COLUMN labor_hours DECIMAL(8,2),
ADD COLUMN duration_days INTEGER;

-- v2_bids: Add scorecard context
ALTER TABLE v2_bids
ADD COLUMN vendor_score_at_bid DECIMAL(5,2),
ADD COLUMN bid_vs_estimate DECIMAL(12,2),
ADD COLUMN price_per_unit DECIMAL(12,4);

-- v2_purchase_orders: Add estimate/schedule links
ALTER TABLE v2_purchase_orders
ADD COLUMN source_estimate_id UUID REFERENCES v2_estimates(id),
ADD COLUMN linked_schedule_task_id UUID REFERENCES v2_schedule_tasks(id);

-- v2_punch_list_items: Add scorecard event trigger
ALTER TABLE v2_punch_list_items
ADD COLUMN scorecard_event_created BOOLEAN DEFAULT false,
ADD COLUMN scorecard_event_id UUID;

-- v2_permit_inspections: Add scorecard event trigger
ALTER TABLE v2_permit_inspections
ADD COLUMN scorecard_event_created BOOLEAN DEFAULT false,
ADD COLUMN scorecard_event_id UUID;
```

### Key Relationships

```
                    +-------------------+
                    | v2_labor_catalog  |
                    +--------+----------+
                             |
          +------------------+------------------+
          |                  |                  |
          v                  v                  v
+-------------------+ +-------------+ +-------------------+
| v2_selection_     | | v2_assembly_| | v2_estimate_      |
| catalog           | | items       | | lines             |
+-------------------+ +-------------+ +-------------------+
          |                  |                  |
          |                  v                  |
          |          +-------------+            |
          +--------->| v2_estimates|<-----------+
                     +------+------+
                            |
                            v
                     +------+------+
                     | v2_schedules|
                     +------+------+
                            |
                            v
              +-------------+-------------+
              |                           |
              v                           v
    +-------------------+       +-------------------+
    | v2_schedule_tasks |       | v2_purchase_      |
    +-------------------+       | orders            |
              |                 +-------------------+
              |                           |
              v                           v
    +-------------------+       +-------------------+
    | v2_schedule_      |       | v2_invoices       |
    | actuals           |       +-------------------+
    +-------------------+                 |
              |                           v
              +-------------+-------------+
                            |
                            v
                   +--------+--------+
                   | v2_estimate_    |
                   | actuals         |
                   +-----------------+
                            |
                            v
                   +--------+--------+
                   | v2_feedback_log |
                   +-----------------+
                            |
                            v
                   +--------+--------+
                   | v2_labor_catalog|
                   | (updated)       |
                   +-----------------+
```

## Data Flow

### Document Upload Flow

```
1. User uploads document (invoice, quote, spec sheet, warranty)
   |
   v
2. Document stored in Supabase Storage
   - Path: documents/{job_id}/{document_type}/{filename}
   |
   v
3. Record created in v2_document_queue
   - status: 'pending'
   - file_type detected from content/extension
   |
   v
4. Background processor picks up document
   |
   v
5. AI extraction (Claude Vision/Sonnet)
   - OCR if scanned
   - Extract structured data based on document_type
   - Apply v2_extraction_rules for vendor-specific patterns
   |
   v
6. Validation and confidence scoring
   - Compare against expected patterns
   - Flag low-confidence extractions
   |
   v
7. Routing based on document type:

   INVOICE:
   - Create v2_invoices record (or match existing)
   - Extract line items
   - Update v2_price_history
   - Create v2_scorecard_events (if variance detected)

   QUOTE:
   - Create v2_bids record (or update existing)
   - Extract line items
   - Update v2_price_history with quote prices

   SPEC SHEET:
   - Extract product specifications
   - Update v2_selection_catalog.specs
   - Extract labor hours if mentioned
   - Update v2_labor_catalog if labor data found

   WARRANTY:
   - Create/update v2_warranties record
   - Extract coverage details
   - Set reminder dates

   PERMIT:
   - Create/update v2_permits record
   - Extract inspection requirements
   - Add to schedule if applicable
   |
   v
8. Update v2_document_queue
   - status: 'completed' or 'manual_review'
   - Store created_entity_id
```

### Estimate Creation Flow

```
1. User starts new estimate for job
   |
   v
2. Option A: Start from selections
   - Load v2_selections for job
   - Map to v2_labor_catalog via category/selection_catalog
   |
   Option B: Start from assembly template
   - Load v2_assemblies
   - Expand v2_assembly_items
   |
   Option C: Manual line items
   - Direct entry with cost code
   |
   v
3. For each line item, system looks up:
   - v2_labor_catalog for labor hours/duration
   - v2_current_prices for material costs
   - v2_trade_scorecards for vendor recommendations
   |
   v
4. Calculate estimate totals:
   - Labor: hours * rate (by trade tier)
   - Materials: quantity * unit price (best vendor or specified)
   - Duration: sum of task durations (accounting for dependencies)
   |
   v
5. Save estimate:
   - v2_estimates record
   - v2_estimate_lines (one per cost code/item)
   |
   v
6. Optional: Generate schedule
   - Create v2_schedules record
   - Create v2_schedule_tasks from estimate lines
   - Set dependencies from v2_labor_catalog
   - Run CPM to calculate dates
   |
   v
7. Optional: Convert to budget
   - Create/update v2_budget_lines from estimate
   - Mark estimate as 'converted'
```

### Schedule Generation Flow

```
1. Trigger: Estimate approved OR manual schedule creation
   |
   v
2. Load estimate lines with labor catalog data
   |
   v
3. For each line with duration data:
   - Create v2_schedule_tasks record
   - Set planned_duration from v2_labor_catalog.duration_days_per_unit * quantity
   - Set dependencies from v2_labor_catalog.prerequisite_cost_codes
   |
   v
4. Set task ordering:
   a. Group by construction phase (foundation, framing, MEP, etc.)
   b. Within phase, order by dependencies
   c. Apply prerequisite constraints
   |
   v
5. Run CPM calculation:
   - Forward pass: earliest start/finish
   - Backward pass: latest start/finish
   - Calculate float for each task
   - Identify critical path
   |
   v
6. Resource leveling (optional):
   - Load v2_crew_availability
   - Check for over-allocation
   - Adjust non-critical tasks to smooth resources
   |
   v
7. Permit integration:
   - Check v2_labor_catalog.permit_type for each task
   - Create v2_permits if needed
   - Schedule v2_permit_inspections based on task completion
   |
   v
8. Save schedule:
   - v2_schedules record
   - v2_schedule_tasks with dates
   - Link back to v2_estimates.generated_schedule_id
```

### Feedback Loop Flow

```
INVOICE FEEDBACK (after payment):

1. Invoice marked as paid
   |
   v
2. Compare invoice data to estimate:
   - Unit prices vs estimated
   - Quantities vs estimated
   - Total vs budget line
   |
   v
3. Create v2_price_actuals record
   |
   v
4. If variance > threshold:
   - Update v2_price_history with actual price
   - Trigger v2_current_prices refresh
   |
   v
5. Create v2_scorecard_events for vendor


SCHEDULE FEEDBACK (task completion):

1. Task marked complete with actual dates
   |
   v
2. Calculate variances:
   - Duration: actual - planned
   - Start: actual - planned
   |
   v
3. Create v2_schedule_actuals record
   |
   v
4. If sufficient samples (min 3 jobs):
   - Calculate weighted average duration
   - Compare to v2_labor_catalog.duration_days_per_unit
   - Propose update if significant variance
   |
   v
5. Create v2_scorecard_events for vendor (speed metrics)


PUNCH LIST FEEDBACK:

1. Punch list item created
   |
   v
2. Create v2_scorecard_events:
   - quality_impact: negative based on severity
   - Link to vendor via PO/task
   |
   v
3. Recalculate v2_trade_scorecards.quality_score


INSPECTION FEEDBACK:

1. Inspection completed (pass/fail)
   |
   v
2. Create v2_scorecard_events:
   - quality_impact: positive for pass, negative for fail
   - reliability_impact: based on scheduling accuracy
   |
   v
3. Recalculate relevant scorecard metrics


SCORECARD RECALCULATION (nightly or on-demand):

1. For each vendor/trade combination:
   |
   v
2. Aggregate recent v2_scorecard_events (configurable window)
   |
   v
3. Calculate component scores:
   - Quality: weighted by recency and severity
   - Speed: average variance from estimates
   - Reliability: show rate, response time, callbacks
   - Price: position vs market, bid accuracy
   |
   v
4. Calculate overall_score:
   - Weighted average of components
   - Apply manual overrides if present
   |
   v
5. Determine tier:
   - preferred: score >= 85
   - approved: score >= 70
   - probation: score >= 50
   - inactive: score < 50
   |
   v
6. Save v2_scorecard_history snapshot
   |
   v
7. Update v2_vendors summary fields
```

## Integration Points

### Enhanced Catalog -> Existing Systems

| New Component | Existing System | Integration |
|---------------|-----------------|-------------|
| v2_labor_catalog | v2_cost_codes | FK: labor_catalog.cost_code_id |
| v2_labor_catalog | v2_selection_categories | FK: labor_catalog.category_id |
| v2_labor_catalog | v2_selection_catalog | FK: selection_catalog.labor_catalog_id |
| v2_assemblies | v2_selection_catalog | Via v2_assembly_items.selection_catalog_id |
| v2_assemblies | v2_labor_catalog | Via v2_assembly_items.labor_catalog_id |

### Estimate Builder -> Existing Systems

| New Component | Existing System | Integration |
|---------------|-----------------|-------------|
| Estimate generation | v2_selections | Read selections to auto-populate estimate |
| Estimate lines | v2_estimate_lines | Extended with labor_catalog_id, duration |
| Budget conversion | v2_budget_lines | Creates budget from approved estimate |
| Schedule generation | v2_schedules | Creates schedule from estimate lines |
| PO creation | v2_purchase_orders | Link via source_estimate_id |

### Schedule Generator -> Existing Systems

| New Component | Existing System | Integration |
|---------------|-----------------|-------------|
| Schedule tasks | v2_crew_schedules | Resource assignment |
| Schedule tasks | v2_permits | Auto-create permits for tasks requiring inspection |
| CPM calculation | v2_schedule_tasks.depends_on | Use existing dependency array |
| Permit scheduling | v2_permit_inspections | Schedule based on task completion |

### Document Intelligence -> ALL Systems

| Document Type | Target Systems |
|---------------|----------------|
| Invoice | v2_invoices, v2_price_history, v2_scorecard_events |
| Quote | v2_bids, v2_price_history |
| Spec Sheet | v2_selection_catalog, v2_labor_catalog |
| Warranty | v2_warranties (new), v2_selection_catalog |
| Permit | v2_permits, v2_permit_inspections |
| Plan/Drawing | v2_labor_catalog (quantities), v2_assemblies |

### Trade Scorecards -> Existing Systems

| Data Source | Scorecard Metric |
|-------------|------------------|
| v2_punch_list_items | quality_punch_rate, quality_rework_rate |
| v2_permit_inspections | quality_inspection_pass_rate |
| v2_schedule_tasks (actuals) | speed_avg_variance_percent, speed_on_time_rate |
| v2_daily_log_crew | reliability_show_rate |
| v2_invoices vs v2_bids | price_bid_accuracy |
| v2_price_history | price_vs_market |
| v2_warranties (callbacks) | reliability_callback_rate |

### Feedback Loops -> Source Data

| Feedback Source | Updates To |
|-----------------|------------|
| v2_price_actuals | v2_price_history, v2_current_prices |
| v2_schedule_actuals | v2_labor_catalog.duration_days_per_unit |
| v2_estimate_actuals | v2_labor_catalog.labor_hours_per_unit |
| v2_scorecard_events | v2_trade_scorecards, v2_vendors |

## API Design

### New Endpoints

```
LABOR CATALOG
-------------
GET    /api/labor-catalog                    # List with filters
GET    /api/labor-catalog/:id                # Get with related data
POST   /api/labor-catalog                    # Create item
PATCH  /api/labor-catalog/:id                # Update item
DELETE /api/labor-catalog/:id                # Soft delete
GET    /api/labor-catalog/by-cost-code/:id   # Get by cost code
GET    /api/labor-catalog/by-category/:id    # Get by category
POST   /api/labor-catalog/import             # Bulk import (RSMeans, etc.)

ASSEMBLIES
----------
GET    /api/assemblies                       # List with filters
GET    /api/assemblies/:id                   # Get with items
POST   /api/assemblies                       # Create assembly
PATCH  /api/assemblies/:id                   # Update assembly
DELETE /api/assemblies/:id                   # Delete assembly
POST   /api/assemblies/:id/items             # Add item to assembly
PATCH  /api/assemblies/:id/items/:itemId     # Update assembly item
DELETE /api/assemblies/:id/items/:itemId     # Remove item from assembly
POST   /api/assemblies/:id/duplicate         # Clone assembly

ESTIMATE BUILDER (extends existing)
-----------------------------------
POST   /api/estimates/:id/from-selections    # Generate from job selections
POST   /api/estimates/:id/from-assembly      # Generate from assembly template
POST   /api/estimates/:id/generate-schedule  # Generate schedule from estimate
GET    /api/estimates/:id/labor-summary      # Get labor hours/cost breakdown
GET    /api/estimates/:id/duration-summary   # Get duration/timeline breakdown

SCHEDULE GENERATOR (extends existing)
-------------------------------------
POST   /api/schedules/:id/calculate-cpm      # Run CPM calculation
GET    /api/schedules/:id/critical-path      # Get critical path tasks
POST   /api/schedules/:id/level-resources    # Run resource leveling
POST   /api/schedules/:id/link-permits       # Create required permits
GET    /api/schedules/:id/dependencies-graph # Get dependency visualization data

DOCUMENT INTELLIGENCE
---------------------
POST   /api/documents/upload                 # Upload for processing
GET    /api/documents/queue                  # List queue with status
GET    /api/documents/:id                    # Get processing result
POST   /api/documents/:id/process            # Trigger reprocessing
PATCH  /api/documents/:id/review             # Submit manual review
GET    /api/documents/rules                  # List extraction rules
POST   /api/documents/rules                  # Create extraction rule
PATCH  /api/documents/rules/:id              # Update extraction rule

TRADE SCORECARDS
----------------
GET    /api/scorecards                       # List all scorecards
GET    /api/scorecards/vendor/:vendorId      # Get all trades for vendor
GET    /api/scorecards/trade/:trade          # Get all vendors for trade
GET    /api/scorecards/:vendorId/:trade      # Get specific scorecard
PATCH  /api/scorecards/:id/override          # Manual override
POST   /api/scorecards/recalculate           # Trigger recalculation
GET    /api/scorecards/:id/history           # Get historical scores
GET    /api/scorecards/:id/events            # Get contributing events

FEEDBACK LOOPS
--------------
GET    /api/feedback/estimate-actuals/:jobId # Get variances for job
GET    /api/feedback/schedule-actuals/:jobId # Get schedule variances
GET    /api/feedback/price-actuals/:jobId    # Get price variances
GET    /api/feedback/pending                 # Get pending feedback items
POST   /api/feedback/:id/apply               # Apply feedback to catalog
POST   /api/feedback/:id/reject              # Reject feedback
GET    /api/feedback/rules                   # List feedback rules
PATCH  /api/feedback/rules/:id               # Update feedback rule
GET    /api/feedback/log                     # Get application log
```

## Build Order

Based on dependencies between components, here is the recommended implementation sequence:

### Phase 1: Enhanced Catalog Foundation

**Why first:** Everything else depends on the labor catalog being populated.

1. **Labor Catalog Tables** - Create v2_labor_catalog and v2_assemblies tables
2. **Catalog API** - CRUD endpoints for labor catalog
3. **Catalog UI** - Admin interface to manage labor items
4. **Selection Catalog Link** - Add labor_catalog_id to v2_selection_catalog
5. **Initial Data Import** - Seed with RSMeans or manual data for common items

**Deliverable:** Working labor catalog that can store hours, durations, dependencies.

### Phase 2: Estimate Builder Enhancement

**Why second:** Uses labor catalog to calculate estimates.

1. **Estimate Lines Extension** - Add labor/duration fields to v2_estimate_lines
2. **Selection-to-Estimate API** - Auto-generate estimate from selections
3. **Assembly Templates** - Build reusable assemblies
4. **Labor/Duration Calculation** - Calculate totals from catalog data
5. **Estimate UI Enhancement** - Show labor hours, duration in estimate modal

**Deliverable:** Estimates auto-populated from selections with labor/duration data.

### Phase 3: Schedule Generator

**Why third:** Builds on estimate lines and catalog dependencies.

1. **Schedule Task Extensions** - Add labor_catalog_id, dependencies
2. **Estimate-to-Schedule API** - Generate tasks from estimate lines
3. **CPM Engine** - Forward/backward pass, critical path
4. **Permit Integration** - Auto-create permits from task requirements
5. **Gantt Enhancement** - Show critical path, dependencies

**Deliverable:** Schedules auto-generated from estimates with CPM calculation.

### Phase 4: Trade Scorecards

**Why fourth:** Uses existing PO, invoice, punch list data. Independent of estimate/schedule.

1. **Scorecard Tables** - Create scorecard and event tables
2. **Event Triggers** - Auto-create events from punch lists, inspections
3. **Scorecard Calculation** - Aggregate events into scores
4. **Scorecard UI** - Vendor detail page with scorecard
5. **Bid Integration** - Show scorecard in bid comparison

**Deliverable:** Vendors have performance scores visible during bid review.

### Phase 5: Document Intelligence

**Why fifth:** Can operate independently but more valuable with scorecards.

1. **Document Queue Tables** - Create processing infrastructure
2. **AI Extraction Engine** - Claude integration for document parsing
3. **Invoice Processing** - Extract and route invoice data
4. **Quote Processing** - Extract and route quote data
5. **Spec Sheet Processing** - Update catalog from spec sheets
6. **Processing UI** - Queue management, manual review interface

**Deliverable:** Documents automatically parsed and routed to appropriate systems.

### Phase 6: Feedback Loops

**Why last:** Requires all other systems to have data flowing through them.

1. **Actuals Tables** - Create variance tracking tables
2. **Invoice Feedback** - Compare invoices to estimates
3. **Schedule Feedback** - Compare actuals to planned
4. **Catalog Update Engine** - Apply feedback to labor catalog
5. **Scorecard Update** - Auto-update from feedback events
6. **Feedback Dashboard** - Visualize variances, pending updates

**Deliverable:** Closed loop where actuals improve future estimates.

## Key Architectural Decisions

### Decision 1: Separate Labor Catalog from Selection Catalog

**Rationale:** Selection catalog is client-facing (products they choose). Labor catalog is builder-facing (how long things take). They need different data structures and update cycles.

**Trade-off:** More tables to maintain, but cleaner separation of concerns.

### Decision 2: Event-Sourced Scorecard Metrics

**Rationale:** Scorecards need auditability (why is this vendor low-rated?). Event sourcing provides full history and enables recalculation with different weights.

**Trade-off:** More storage, but full transparency and flexibility.

### Decision 3: Document Queue with Background Processing

**Rationale:** AI extraction is slow (2-5 seconds per document). Queue allows async processing without blocking uploads.

**Trade-off:** Eventual consistency - document data not immediately available.

### Decision 4: Feedback Rules Table (Not Hard-Coded)

**Rationale:** Different builders may want different thresholds and update behaviors. Configurable rules allow customization.

**Trade-off:** More complexity, but accommodates future requirements.

### Decision 5: Extend Existing Tables vs. New Tables

**Rationale:** Adding columns to existing tables (v2_selection_catalog, v2_estimate_lines) keeps data together and avoids joins. New tables only when fundamentally different entity.

**Trade-off:** Existing tables get larger, but queries stay simpler.

### Decision 6: UUID Arrays for Dependencies

**Rationale:** PostgreSQL UUID arrays are efficient and supported. Allows flexible many-to-many without junction tables for simple relationships.

**Trade-off:** Can't enforce FK constraints on array elements, but simpler schema.

### Decision 7: JSONB for Flexible Extraction Data

**Rationale:** Document extraction yields varying structures. JSONB accommodates this without schema changes per document type.

**Trade-off:** Less type safety, but more flexibility for AI outputs.

## Sources

- [RSMeans Data](https://www.rsmeans.com/) - Construction cost database structure patterns
- [Autodesk Construction Cloud AI](https://construction.autodesk.com/workflows/artificial-intelligence-construction/) - AI document processing patterns
- [ServiceChannel Contractor Scorecard](https://servicechannel.com/learning-channel/new-contractor-scorecard/) - Trade scorecard methodology
- [AI Field Feedback](https://drawer.ai/blog/ai-field-feedback-compare-estimated-vs-actual-labor-productivity) - Estimate vs actual feedback patterns
- [Microsoft CQRS Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) - Event sourcing patterns
- [CPM Schedule Construction](https://www.autodesk.com/blogs/construction/cpm-schedule-construction-critical-path-method/) - Critical path methodology
