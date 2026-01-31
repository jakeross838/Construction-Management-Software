# Performance Intelligence System - Complete Architecture

## Overview

This system transforms daily logs into predictive intelligence for:
1. **Sub Selection** - Data-driven vendor comparison
2. **Auto-Scheduling** - Generate schedules from historical performance
3. **Accurate Estimating** - Price jobs based on actual data
4. **Progress Tracking** - Real-time PO burn rate

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │    JOBS      │    │     POs      │    │ DAILY LOGS   │    │  SCHEDULE    │  │
│  │              │    │              │    │              │    │              │  │
│  │ • Name       │    │ • Vendor     │    │ • Crew       │    │ • Tasks      │  │
│  │ • Address    │    │ • Amount     │    │ • Hours      │    │ • Durations  │  │
│  │ • Contract   │    │ • Scope      │    │ • Progress   │    │ • Deps       │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │                   │           │
│         ▼                   ▼                   ▼                   ▼           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   JOB SPECS  │    │SCOPE CATEGORY│    │CREW W/ SCOPE │    │TASK W/ SCOPE │  │
│  │   (NEW)      │    │   (NEW)      │    │   (ENHANCED) │    │  (ENHANCED)  │  │
│  │              │    │              │    │              │    │              │  │
│  │ • SF totals  │    │ • Trade      │    │ • Scope link │    │ • Scope link │  │
│  │ • Room counts│    │ • Unit       │    │ • Qty done   │    │ • Est. days  │  │
│  │ • Complexity │    │ • Rate       │    │ • Quality    │    │ • Vendor     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │                   │           │
│         └───────────────────┴─────────┬─────────┴───────────────────┘           │
│                                       │                                          │
│                                       ▼                                          │
│                          ┌────────────────────────┐                             │
│                          │   SCOPE PERFORMANCE    │                             │
│                          │      (CALCULATED)      │                             │
│                          │                        │                             │
│                          │ • Days per unit        │                             │
│                          │ • Cost per unit        │                             │
│                          │ • Hours per unit       │                             │
│                          │ • Variance vs baseline │                             │
│                          └───────────┬────────────┘                             │
│                                      │                                           │
│                    ┌─────────────────┴─────────────────┐                        │
│                    ▼                                   ▼                         │
│         ┌───────────────────┐              ┌───────────────────┐                │
│         │CATEGORY BENCHMARKS│              │VENDOR BENCHMARKS  │                │
│         │                   │              │                   │                │
│         │ • Avg rate        │              │ • Vendor rate     │                │
│         │ • P25/P50/P75     │              │ • vs Category     │                │
│         │ • Sample count    │              │ • Quality score   │                │
│         └─────────┬─────────┘              └─────────┬─────────┘                │
│                   │                                  │                           │
│                   └──────────────┬───────────────────┘                          │
│                                  ▼                                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                              OUTPUTS                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   AUTO       │    │   VENDOR     │    │   ACCURATE   │    │   PROGRESS   │  │
│  │  SCHEDULE    │    │  SELECTION   │    │  ESTIMATES   │    │  TRACKING    │  │
│  │              │    │              │    │              │    │              │  │
│  │ Input specs  │    │ Compare subs │    │ SF × Rate    │    │ Real-time    │  │
│  │ Get rates    │    │ by trade     │    │ = Days       │    │ burn rate    │  │
│  │ Generate     │    │ Pick best    │    │ Price jobs   │    │ vs estimate  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: New Tables & Their Purpose

### 1.1 Job Specifications (`v2_job_specifications`)
**Purpose:** Store measurable attributes of each job for normalization

| Field | Type | Example | Used For |
|-------|------|---------|----------|
| total_sf | INT | 2500 | Framing, drywall, paint calculations |
| tile_sf | INT | 450 | Tile duration estimates |
| bathroom_count | INT | 3 | Plumbing, cabinet estimates |
| plumbing_fixture_count | INT | 12 | Plumbing duration |
| window_count | INT | 24 | Window install estimates |
| complexity_rating | TEXT | 'standard' | Adjust estimates for difficulty |

**Where data comes from:**
- Manual entry when job is created
- Could pull from takeoff/estimating software
- Could calculate from plans (future AI feature)

**Where data goes to:**
- Scope estimates view (multiply SF × rate = days)
- Schedule generator (auto-create tasks with durations)
- Estimating (price = days × daily cost)

### 1.2 Scope Categories (`v2_scope_categories`)
**Purpose:** Master list of work types with measurement units

| Field | Type | Example | Used For |
|-------|------|---------|----------|
| code | TEXT | 'TILE' | Linking everywhere |
| name | TEXT | 'Tile Installation' | Display |
| trade | TEXT | 'Tile' | Group vendors by trade |
| primary_unit | TEXT | 'SF' | Measurement (SF, LF, EA) |
| job_spec_field | TEXT | 'tile_sf' | Auto-pull quantity from job specs |
| baseline_days_per_unit | DECIMAL | 0.015 | Default rate until we have data |

**Pre-populated with:**
- 25+ standard scope categories
- Industry baseline rates
- Links to cost codes

### 1.3 Scope Performance (`v2_scope_performance`)
**Purpose:** Record of completed work with calculated metrics

| Field | Type | Example | Source |
|-------|------|---------|--------|
| scope_quantity | DECIMAL | 450 | PO scope_quantity |
| working_days | INT | 7 | Count from daily logs |
| days_per_unit | DECIMAL | 0.0155 | working_days / scope_quantity |
| cost_per_unit | DECIMAL | 15.50 | po_amount / scope_quantity |
| variance_percent | DECIMAL | +3.3% | (actual - baseline) / baseline |

**Triggered by:**
- PO marked as complete
- Or manual "close scope" action

### 1.4 Category Benchmarks (`v2_category_benchmarks`)
**Purpose:** Aggregated averages across all vendors for a scope type

| Field | Example | Meaning |
|-------|---------|---------|
| avg_days_per_unit | 0.014 | Average across all tile jobs |
| p25_days_per_unit | 0.010 | Optimistic estimate (fast subs) |
| p50_days_per_unit | 0.014 | Expected estimate (median) |
| p75_days_per_unit | 0.018 | Conservative estimate (slow subs) |
| sample_count | 23 | Number of completed tile jobs |

**Calculated by:**
- Nightly job that aggregates v2_scope_performance
- Or triggered when new performance record added

### 1.5 Vendor Benchmarks (`v2_vendor_benchmarks`)
**Purpose:** Per-vendor performance for each scope type

| Field | Example | Meaning |
|-------|---------|---------|
| avg_days_per_unit | 0.012 | This vendor's tile rate |
| speed_vs_category | +14% | 14% faster than average |
| cost_vs_category | -5% | 5% more expensive than average |
| quality_score | 92 | Based on inspections, rework |
| sample_count | 8 | Jobs completed for this vendor |

**Used for:**
- Vendor comparison when awarding bids
- Recommending vendors for schedule
- Performance reviews

---

## Part 2: Changes to Existing Tables

### 2.1 Purchase Orders (`v2_purchase_orders`)

**Add columns:**

| New Column | Type | Purpose |
|------------|------|---------|
| scope_category_id | UUID FK | Link to scope type (TILE, FRAMING, etc.) |
| scope_quantity | DECIMAL | How much (450 SF, 12 fixtures, etc.) |
| scope_unit | TEXT | Unit (SF, EA, FIXTURE) |
| estimated_days | INT | Based on historical rate |
| actual_start_date | DATE | First day crew worked |
| actual_end_date | DATE | Last day crew worked |
| actual_working_days | INT | Total work days (from logs) |

**Data flow:**
```
PO Created
    ↓
Link to scope category (e.g., TILE)
    ↓
Enter scope_quantity (450 SF)
    ↓
System calculates estimated_days (450 × 0.014 = 6.3 days)
    ↓
Daily logs track actual work days
    ↓
When PO complete → calculate actual_working_days → update performance
```

### 2.2 Daily Log Crew (`v2_daily_log_crew`)

**Add columns:**

| New Column | Type | Purpose |
|------------|------|---------|
| scope_category_id | UUID FK | What type of work |
| quantity_completed | DECIMAL | How much done today (50 SF) |
| quantity_unit | TEXT | Unit (SF, LF, EA) |
| is_work_day | BOOLEAN | Count toward duration? |
| expected_workers | INT | How many were scheduled |
| work_quality | TEXT | 'good'/'acceptable'/'needs_rework' |
| ready_for_next_trade | BOOLEAN | Can next trade start? |

**Data flow:**
```
PM enters daily log
    ↓
Selects vendor + PO
    ↓
Scope category auto-fills from PO
    ↓
Enters: 4 workers, 8 hours, 50 SF completed
    ↓
On log complete → aggregate to PO actual_working_days
    ↓
On PO complete → calculate performance metrics
```

### 2.3 Schedule Tasks (`v2_schedule_tasks`)

**Add columns:**

| New Column | Type | Purpose |
|------------|------|---------|
| scope_category_id | UUID FK | Link to scope type |
| scope_quantity | DECIMAL | How much for this task |
| estimated_days | INT | Based on rate × quantity |
| assigned_vendor_id | UUID FK | Which sub is doing it |
| estimated_from_benchmark | BOOLEAN | Was estimate auto-calculated? |

**Data flow:**
```
Auto-generate schedule from job specs
    ↓
For each scope category in job:
    Get quantity from job_specifications
    Get rate from category_benchmarks
    Create task with estimated_days = quantity × rate
    ↓
Optionally assign vendor
    ↓
If vendor assigned, use vendor_benchmark rate instead
```

---

## Part 3: Data Entry Points

### 3.1 Job Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATE NEW JOB                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Basic Info:                                                      │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Job Name: [Drummond - 501 74th St                         ] │ │
│ │ Address:  [501 74th St, Holmes Beach, FL                  ] │ │
│ │ Client:   [John Drummond                                  ] │ │
│ │ Contract: [$1,250,000                                     ] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Job Specifications: (for scheduling & estimating)               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ GENERAL                          FLOORING                   │ │
│ │ Total SF:        [2,500]         Tile SF:      [450]       │ │
│ │ Stories:         [2    ]         Hardwood SF:  [800]       │ │
│ │ Complexity:      [Standard ▼]    Carpet SF:    [400]       │ │
│ │                                                             │ │
│ │ ROOMS                            EXTERIOR                   │ │
│ │ Bedrooms:        [4    ]         Roofing Sq:   [32 ]       │ │
│ │ Bathrooms:       [3    ]         Siding SF:    [2,200]     │ │
│ │ Half Baths:      [1    ]         Windows:      [24 ]       │ │
│ │                                  Ext. Doors:   [3  ]       │ │
│ │ PLUMBING                                                    │ │
│ │ Fixtures:        [14   ]         ELECTRICAL                 │ │
│ │                                  Outlets:      [85 ]       │ │
│ │ HVAC                             Switches:     [32 ]       │ │
│ │ Tonnage:         [4    ]         Fixtures:     [28 ]       │ │
│ │ Zones:           [2    ]                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [  ] Auto-generate schedule from specifications             │ │
│ │ [  ] Copy specs from similar job: [Select job...       ▼]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│                              [Cancel]    [Create Job]            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 PO Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CREATE PURCHASE ORDER                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Job:     [Drummond - 501 74th St                            ▼] │
│ Vendor:  [ABC Tile & Stone                                  ▼] │
│                                                                  │
│ Scope:                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Category: [Tile Installation                              ▼]│ │
│ │                                                             │ │
│ │ Quantity: [450    ] SF   (Job has 450 SF tile)             │ │
│ │                                                             │ │
│ │ ┌─────────────────────────────────────────────────────────┐│ │
│ │ │ 📊 ESTIMATE BASED ON HISTORICAL DATA                    ││ │
│ │ │                                                          ││ │
│ │ │ Category Average:  0.014 days/SF  →  6.3 days           ││ │
│ │ │ ABC Tile Average:  0.012 days/SF  →  5.4 days           ││ │
│ │ │                                                          ││ │
│ │ │ ABC Tile is 14% FASTER than average                     ││ │
│ │ │ ABC Tile quality score: 94/100                          ││ │
│ │ │ ABC Tile jobs completed: 8                              ││ │
│ │ └─────────────────────────────────────────────────────────┘│ │
│ │                                                             │ │
│ │ Estimated Days: [6] (using vendor rate: 5.4, rounded up)   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Amount:  [$6,975.00    ]   ($15.50/SF based on vendor history) │
│ Description: [Tile installation - all bathrooms + laundry    ] │
│                                                                  │
│                              [Cancel]    [Create PO]            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Daily Log Crew Entry

```
┌─────────────────────────────────────────────────────────────────┐
│ CREW ENTRY                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Vendor:  [ABC Tile & Stone                                  ▼] │
│ PO:      [PO-Drummond-005: Tile Installation ($6,975)       ▼] │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Scope: Tile Installation (450 SF)                          │ │
│ │ Progress: ████████████░░░░░░░░  60% → [75]%               │ │
│ │                                                             │ │
│ │ Quantity today: [67.5] SF  (auto: 15% of 450)              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Workers: [2] of [2] expected     Hours: [8  ]                   │
│                                                                  │
│ Work Area: [Master bathroom - floor tile complete         ]     │
│                                                                  │
│ Quality:  ● Good  ○ Acceptable  ○ Needs Rework                  │
│                                                                  │
│ ☑ Ready for next trade (grout can start)                       │
│                                                                  │
│ Notes: [Completed floor, starting shower walls tomorrow   ]     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Calculation Triggers

### 4.1 When Daily Log is Completed

```javascript
async function onDailyLogComplete(logId) {
  const log = await getDailyLog(logId);

  for (const crew of log.crew) {
    if (crew.po_id) {
      // Update PO progress
      const po = await getPO(crew.po_id);

      // Count working days on this PO
      const workingDays = await countWorkingDays(crew.po_id);

      // Check if first day of work
      if (!po.actual_start_date) {
        await updatePO(po.id, { actual_start_date: log.log_date });
      }

      // Update working days count
      await updatePO(po.id, { actual_working_days: workingDays });
    }
  }
}
```

### 4.2 When PO is Marked Complete

```javascript
async function onPOComplete(poId) {
  const po = await getPO(poId);

  // Set end date
  await updatePO(poId, { actual_end_date: new Date() });

  // Calculate performance metrics
  await calculateScopePerformance(poId);

  // Recalculate benchmarks
  await recalculateCategoryBenchmarks(po.scope_category_id);
  await recalculateVendorBenchmarks(po.vendor_id);
}

async function calculateScopePerformance(poId) {
  const po = await getPO(poId);

  // Count actual working days from daily logs
  const workingDays = await db.query(`
    SELECT COUNT(DISTINCT dl.log_date)
    FROM v2_daily_logs dl
    JOIN v2_daily_log_crew dlc ON dlc.daily_log_id = dl.id
    WHERE dlc.po_id = $1
      AND dlc.is_work_day = true
      AND dl.deleted_at IS NULL
  `, [poId]);

  // Get labor hours
  const laborData = await db.query(`
    SELECT
      SUM(dlc.worker_count * COALESCE(dlc.hours_worked, 8)) as total_hours,
      AVG(dlc.worker_count) as avg_workers
    FROM v2_daily_log_crew dlc
    JOIN v2_daily_logs dl ON dl.id = dlc.daily_log_id
    WHERE dlc.po_id = $1 AND dl.deleted_at IS NULL
  `, [poId]);

  // Calculate metrics
  const daysPerUnit = workingDays / po.scope_quantity;
  const costPerUnit = po.total_amount / po.scope_quantity;
  const hoursPerUnit = laborData.total_hours / po.scope_quantity;

  // Get baseline for comparison
  const baseline = await getBaselineRate(po.scope_category_id);
  const baselineDays = po.scope_quantity * baseline;
  const variancePercent = ((workingDays - baselineDays) / baselineDays) * 100;

  // Store performance record
  await db.insert('v2_scope_performance', {
    job_id: po.job_id,
    po_id: poId,
    vendor_id: po.vendor_id,
    scope_category_id: po.scope_category_id,
    scope_quantity: po.scope_quantity,
    scope_unit: po.scope_unit,
    start_date: po.actual_start_date,
    end_date: po.actual_end_date,
    working_days: workingDays,
    avg_workers: laborData.avg_workers,
    total_labor_hours: laborData.total_hours,
    po_amount: po.total_amount,
    days_per_unit: daysPerUnit,
    cost_per_unit: costPerUnit,
    hours_per_unit: hoursPerUnit,
    baseline_days: baselineDays,
    variance_days: workingDays - baselineDays,
    variance_percent: variancePercent
  });
}
```

### 4.3 Nightly Benchmark Recalculation

```javascript
// Run nightly at 2 AM
async function recalculateAllBenchmarks() {
  // Category benchmarks (all scopes aggregated)
  await db.query(`SELECT recalculate_category_benchmarks(NULL)`);

  // Vendor benchmarks (per vendor per scope)
  await db.query(`SELECT recalculate_vendor_benchmarks(NULL)`);

  console.log('Benchmarks recalculated');
}
```

---

## Part 5: Output Features

### 5.1 Auto-Generate Schedule

```javascript
async function generateSchedule(jobId) {
  const job = await getJob(jobId);
  const specs = await getJobSpecifications(jobId);

  // Get all scope categories with quantities
  const scopes = await db.query(`
    SELECT * FROM v2_scope_estimates WHERE job_id = $1
  `, [jobId]);

  const tasks = [];
  let currentDate = job.start_date;

  // Sort by phase
  const phaseOrder = { sitework: 1, rough: 2, finish: 3 };
  scopes.sort((a, b) => phaseOrder[a.phase] - phaseOrder[b.phase]);

  for (const scope of scopes) {
    if (scope.scope_quantity > 0) {
      tasks.push({
        job_id: jobId,
        name: scope.scope_name,
        scope_category_id: scope.scope_category_id,
        scope_quantity: scope.scope_quantity,
        estimated_days: Math.ceil(scope.estimated_days),
        start_date: currentDate,
        end_date: addWorkingDays(currentDate, scope.estimated_days),
        estimated_from_benchmark: true
      });

      // Next task starts after this one (simplified - should use dependencies)
      currentDate = addWorkingDays(currentDate, scope.estimated_days);
    }
  }

  return tasks;
}
```

**UI:**

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTO-GENERATE SCHEDULE                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Job: Drummond - 501 74th St                                     │
│ Start Date: [02/15/2026]                                        │
│                                                                  │
│ Estimated Schedule (based on 23 historical data points):        │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Phase    │ Scope              │ Qty    │ Days │ Dates       │ │
│ ├──────────┼────────────────────┼────────┼──────┼─────────────│ │
│ │ Sitework │ Foundation         │ 2500 SF│ 8    │ 02/15-02/26 │ │
│ │ Rough    │ Framing Complete   │ 2500 SF│ 20   │ 02/27-03/26 │ │
│ │ Rough    │ Plumbing Rough     │ 14 fix │ 7    │ 03/27-04/04 │ │
│ │ Rough    │ Electrical Rough   │ 2500 SF│ 5    │ 03/27-04/02 │ │
│ │ Rough    │ HVAC Rough         │ 4 ton  │ 4    │ 03/27-04/01 │ │
│ │ Rough    │ Roofing            │ 32 sq  │ 5    │ 04/05-04/11 │ │
│ │ Finish   │ Drywall            │ 6000 SF│ 18   │ 04/12-05/07 │ │
│ │ Finish   │ Tile               │ 450 SF │ 7    │ 05/08-05/18 │ │
│ │ Finish   │ Paint Interior     │ 8000 SF│ 8    │ 05/19-05/29 │ │
│ │ Finish   │ Trim Carpentry     │ 800 LF │ 8    │ 05/30-06/10 │ │
│ │ Finish   │ Flooring           │ 1200 SF│ 6    │ 06/11-06/18 │ │
│ │ ...      │ ...                │ ...    │ ...  │ ...         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Total Estimated Duration: 125 working days                      │
│ Estimated Completion: 08/15/2026                                │
│                                                                  │
│ ☑ Include buffer days (10%)                                     │
│ ☐ Assign recommended vendors                                    │
│                                                                  │
│                     [Cancel]    [Generate Schedule]              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Vendor Comparison for Bidding

```
┌─────────────────────────────────────────────────────────────────┐
│ VENDOR COMPARISON: Tile Installation                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Job: Drummond - 501 74th St                                     │
│ Scope: 450 SF tile                                              │
│                                                                  │
│ Category Average: 0.014 days/SF = 6.3 days | $15.50/SF          │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ VENDOR         │ RATE    │ DAYS │ SPEED │ COST  │ QUALITY │ │
│ ├────────────────┼─────────┼──────┼───────┼───────┼─────────│ │
│ │ ABC Tile ⭐    │ 0.012/SF│ 5.4  │ +14%  │ +5%   │ 94/100  │ │
│ │ XYZ Flooring   │ 0.015/SF│ 6.8  │ -7%   │ -10%  │ 88/100  │ │
│ │ Premium Tile   │ 0.011/SF│ 5.0  │ +21%  │ +25%  │ 97/100  │ │
│ │ Budget Floors  │ 0.018/SF│ 8.1  │ -29%  │ -20%  │ 72/100  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ⭐ RECOMMENDED: ABC Tile                                        │
│    Best balance of speed, cost, and quality                     │
│    8 jobs completed, 94% quality score, 14% faster than avg     │
│                                                                  │
│ 📊 ABC Tile History:                                            │
│ • Clark job: 380 SF in 5 days (0.013/SF)                       │
│ • Smith job: 520 SF in 6 days (0.012/SF)                       │
│ • Jones job: 290 SF in 3 days (0.010/SF)                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Estimating Integration

```javascript
async function estimateJob(specs) {
  const estimate = {
    scopes: [],
    totalDays: 0,
    totalCost: 0
  };

  for (const [scopeCode, quantity] of Object.entries(specs)) {
    const benchmark = await getCategoryBenchmark(scopeCode);

    const days = quantity * benchmark.p50_days_per_unit;
    const cost = quantity * benchmark.avg_cost_per_unit;

    estimate.scopes.push({
      code: scopeCode,
      quantity,
      unit: benchmark.primary_unit,
      days: Math.ceil(days),
      cost: Math.round(cost),
      dataPoints: benchmark.sample_count
    });

    estimate.totalDays += days;
    estimate.totalCost += cost;
  }

  return estimate;
}

// Example usage:
const estimate = await estimateJob({
  FRAMING_COMPLETE: 2500,  // 2500 SF
  PLUMBING_ROUGH: 14,      // 14 fixtures
  TILE: 450,               // 450 SF
  // ... etc
});

// Returns:
// {
//   scopes: [
//     { code: 'FRAMING_COMPLETE', quantity: 2500, unit: 'SF', days: 20, cost: 45000, dataPoints: 15 },
//     { code: 'PLUMBING_ROUGH', quantity: 14, unit: 'FIXTURE', days: 7, cost: 8400, dataPoints: 23 },
//     { code: 'TILE', quantity: 450, unit: 'SF', days: 7, cost: 6975, dataPoints: 18 },
//   ],
//   totalDays: 125,
//   totalCost: 892000
// }
```

---

## Part 6: Implementation Checklist

### Phase 1: Database Setup
- [ ] Run migration-131 to create all tables
- [ ] Verify scope categories populated correctly
- [ ] Add job specifications to existing jobs (manual entry)
- [ ] Link existing POs to scope categories

### Phase 2: PO Enhancements
- [ ] Add scope_category_id dropdown to PO form
- [ ] Add scope_quantity and scope_unit fields
- [ ] Show estimated days based on benchmark
- [ ] Show vendor comparison when selecting vendor

### Phase 3: Daily Log Enhancements
- [ ] Add scope tracking fields to crew entry
- [ ] Show PO scope progress bar
- [ ] Auto-calculate quantity from progress %
- [ ] Quality rating field
- [ ] Ready for next trade checkbox

### Phase 4: Calculation Engine
- [ ] Trigger on daily log complete → update PO working days
- [ ] Trigger on PO complete → calculate performance
- [ ] Nightly job to recalculate benchmarks
- [ ] API endpoints for benchmark data

### Phase 5: Output Features
- [ ] Schedule generator UI
- [ ] Vendor comparison component
- [ ] Estimating integration
- [ ] Performance dashboards

### Phase 6: Reports
- [ ] Category benchmark report
- [ ] Vendor scorecard report
- [ ] Job performance vs estimate report
- [ ] Trend charts over time

---

## Part 7: API Endpoints Needed

```
# Job Specifications
GET    /api/jobs/:id/specifications
POST   /api/jobs/:id/specifications
PATCH  /api/jobs/:id/specifications

# Scope Categories
GET    /api/scope-categories
GET    /api/scope-categories/:code

# Benchmarks
GET    /api/benchmarks/categories
GET    /api/benchmarks/categories/:scopeId
GET    /api/benchmarks/vendors/:vendorId
GET    /api/benchmarks/vendors/:vendorId/scope/:scopeId

# Vendor Comparison
GET    /api/vendors/compare?scope=TILE&job_id=xxx

# Schedule Generation
POST   /api/jobs/:id/generate-schedule

# Estimates
POST   /api/estimate
```

---

## Summary

This system creates a **feedback loop**:

```
1. Enter job specs (SF, rooms, etc.)
        ↓
2. Create POs with scope categories + quantities
        ↓
3. Daily logs track actual work days
        ↓
4. PO completion triggers performance calculation
        ↓
5. Benchmarks updated with new data
        ↓
6. Better estimates for next job
        ↓
[Return to step 1]
```

After 10-20 completed jobs, you'll have:
- **Accurate duration estimates** by scope type
- **Vendor performance rankings** by trade
- **Auto-generated schedules** based on real data
- **Pricing intelligence** from actual costs

The more jobs completed, the more accurate the system becomes.
