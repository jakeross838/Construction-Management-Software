# Architecture Research: Financial Management Module

**Project:** Ross Built CMS - Financial Management Extension
**Researched:** 2026-01-20
**Domain:** Construction financial management, overhead allocation, job profitability

---

## System Overview

The Financial Management module extends Ross Built CMS to provide comprehensive job costing, expense tracking, overhead allocation, and profitability analysis. This architecture integrates with existing operational data (invoices, POs, draws) to create a complete financial picture.

```
+-----------------------------------------------------------------------------------+
|                           FINANCIAL MANAGEMENT LAYER                              |
+-----------------------------------------------------------------------------------+
|                                                                                   |
|  +-------------------+    +-------------------+    +-------------------+          |
|  |   EXPENSE MODULE  |    |   LABOR MODULE    |    |  EQUIPMENT MODULE |          |
|  | - Direct costs    |    | - Time entries    |    | - Usage tracking  |          |
|  | - Indirect costs  |    | - Burden rates    |    | - Depreciation    |          |
|  | - Categories/GL   |    | - Payroll alloc   |    | - Burden rates    |          |
|  +--------+----------+    +--------+----------+    +--------+----------+          |
|           |                        |                        |                     |
|           +------------------------+------------------------+                     |
|                                    |                                              |
|                                    v                                              |
|                    +---------------+---------------+                              |
|                    |      ALLOCATION ENGINE        |                              |
|                    | - Direct cost assignment      |                              |
|                    | - Indirect pool distribution  |                              |
|                    | - Overhead allocation         |                              |
|                    | - Period-based calculations   |                              |
|                    +---------------+---------------+                              |
|                                    |                                              |
|           +------------------------+------------------------+                     |
|           |                        |                        |                     |
|           v                        v                        v                     |
|  +--------+----------+    +--------+----------+    +--------+----------+          |
|  | JOB PROFITABILITY |    |   WIP REPORTING   |    | FINANCIAL REPORTS |          |
|  | - Gross margin    |    | - % Complete      |    | - P&L by job      |          |
|  | - Net margin      |    | - Over/under bill |    | - Cost variance   |          |
|  | - Variance anal.  |    | - Revenue recog.  |    | - Monthly close   |          |
|  +-------------------+    +-------------------+    +-------------------+          |
|                                                                                   |
+-----------------------------------------------------------------------------------+
                                        |
                                        v
+-----------------------------------------------------------------------------------+
|                          EXISTING ROSS BUILT CMS CORE                             |
+-----------------------------------------------------------------------------------+
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|  |  v2_jobs    |  | v2_invoices |  |   v2_pos    |  |  v2_draws   |               |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|  | v2_vendors  |  | v2_budget_  |  | v2_invoice_ |  | v2_cost_    |               |
|  |             |  |   lines     |  | allocations |  |   codes     |               |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
+-----------------------------------------------------------------------------------+
```

---

## Component Responsibilities

| Component | Responsibility | Key Tables |
|-----------|----------------|------------|
| **Expense Module** | Track all company expenses (direct & indirect), categorize by GL account and cost type | `v2_expenses`, `v2_expense_categories`, `v2_gl_accounts` |
| **Labor Module** | Track labor hours, calculate burden rates, allocate payroll to jobs | `v2_time_entries`, `v2_employees`, `v2_labor_burden_rates`, `v2_payroll_periods` |
| **Equipment Module** | Track equipment usage, calculate depreciation, allocate equipment costs | `v2_equipment`, `v2_equipment_usage`, `v2_equipment_burden_rates` |
| **Allocation Engine** | Distribute indirect costs to jobs using configurable methods | `v2_cost_pools`, `v2_allocation_rules`, `v2_job_allocations` |
| **Job Profitability** | Calculate job-level margins and analyze variances | `v2_job_financials`, `v2_job_profitability_snapshots` |
| **WIP Reporting** | Generate Work-in-Progress schedules, calculate % complete | `v2_wip_schedules`, `v2_wip_lines` |
| **Financial Reports** | Period-based financial statements, monthly close | `v2_financial_periods`, `v2_period_snapshots` |

---

## Recommended Project Structure

```
Construction-Management-Software/
├── server/
│   ├── routes/
│   │   ├── expenses.js           # Expense CRUD, categorization
│   │   ├── time-entries.js       # Labor time tracking
│   │   ├── equipment.js          # Equipment management & usage
│   │   ├── payroll.js            # Payroll periods & allocations
│   │   ├── allocations.js        # Cost pool & allocation APIs
│   │   ├── job-profitability.js  # Profitability calculations
│   │   ├── wip-reports.js        # WIP schedule generation
│   │   └── financial-periods.js  # Period close & reports
│   │
│   ├── services/
│   │   ├── laborBurdenCalculator.js    # Labor burden rate calculations
│   │   ├── equipmentBurdenCalculator.js # Equipment burden rates
│   │   ├── overheadAllocator.js        # Overhead allocation engine
│   │   ├── wipCalculator.js            # WIP & % complete calculations
│   │   ├── profitabilityCalculator.js  # Job margin calculations
│   │   └── periodCloseService.js       # Monthly close process
│   │
│   └── validators/
│       ├── expense-validator.js
│       ├── time-entry-validator.js
│       └── allocation-validator.js
│
├── public/
│   ├── financials.html           # Financial dashboard
│   ├── expenses.html             # Expense tracking page
│   ├── timesheets.html           # Time entry page
│   ├── equipment.html            # Equipment management
│   ├── job-profitability.html    # Profitability analysis
│   ├── wip-reports.html          # WIP schedule reports
│   │
│   └── js/
│       ├── financials.js
│       ├── expenses.js
│       ├── timesheets.js
│       ├── equipment.js
│       ├── profitability.js
│       └── wip-reports.js
│
├── database/
│   ├── migration-100-financial-core.sql      # GL accounts, expense categories
│   ├── migration-101-expense-tracking.sql    # Expense tables
│   ├── migration-102-labor-tracking.sql      # Time entries, burden rates
│   ├── migration-103-equipment-tracking.sql  # Equipment, usage, depreciation
│   ├── migration-104-cost-allocation.sql     # Pools, rules, allocations
│   ├── migration-105-job-profitability.sql   # Profitability calculations
│   ├── migration-106-wip-reporting.sql       # WIP schedules
│   └── migration-107-financial-periods.sql   # Period management
│
└── tests/
    ├── labor-burden.spec.js
    ├── overhead-allocation.spec.js
    ├── wip-calculation.spec.js
    └── profitability.spec.js
```

---

## Data Flow Diagrams

### 1. Time Entry to Job Cost Allocation

```
+------------------+     +------------------+     +------------------+
|   TIME ENTRY     |     | BURDEN RATE      |     | JOB COST         |
|   (Employee)     | --> | CALCULATION      | --> | ALLOCATION       |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
| v2_time_entries  |     | v2_labor_burden_ |     | v2_job_          |
| - employee_id    |     |   rates          |     |   allocations    |
| - job_id         |     | - base_rate      |     | - job_id         |
| - cost_code_id   |     | - burden_percent |     | - cost_code_id   |
| - hours_regular  |     | - payroll_taxes  |     | - labor_cost     |
| - hours_overtime |     | - benefits       |     | - burden_cost    |
| - date           |     | - insurance      |     | - total_cost     |
+------------------+     +------------------+     +------------------+
                                 |
                                 v
                         +------------------+
                         | FULLY BURDENED   |
                         | LABOR COST       |
                         |                  |
                         | = Base Wage      |
                         | + Payroll Taxes  |
                         | + Benefits       |
                         | + Insurance      |
                         | + Training       |
                         +------------------+
```

### 2. Overhead Allocation Flow

```
+------------------+     +------------------+     +------------------+
|   INDIRECT       |     |   COST POOLS     |     |   ALLOCATION     |
|   EXPENSES       | --> |   (Grouping)     | --> |   BASE           |
+------------------+     +------------------+     +------------------+
        |                        |                        |
        v                        v                        v
+------------------+     +------------------+     +------------------+
| v2_expenses      |     | v2_cost_pools    |     | Allocation       |
| - GL 6000-6999   |     | - pool_name      |     | Methods:         |
| - Indirect costs |     | - pool_type      |     |                  |
|   * Office rent  |     |   'labor_OH'     |     | - Labor hours    |
|   * Insurance    |     |   'equipment_OH' |     | - Labor dollars  |
|   * Admin salaries|    |   'G&A'         |     | - Direct costs   |
|   * Marketing    |     | - account_range  |     | - Square footage |
+------------------+     +------------------+     +------------------+
                                 |
                                 v
                    +---------------------------+
                    |   JOB ALLOCATION          |
                    |                           |
                    |  Rate = Pool Total        |
                    |         -----------       |
                    |         Alloc. Base       |
                    |                           |
                    |  Job Overhead =           |
                    |    Rate x Job's Base      |
                    +---------------------------+
                                 |
                                 v
                    +---------------------------+
                    |   v2_job_allocations      |
                    | - job_id                  |
                    | - period_id               |
                    | - pool_id                 |
                    | - allocated_amount        |
                    +---------------------------+
```

### 3. Job Profitability Calculation

```
+-------------------+     +-------------------+     +-------------------+
|   DIRECT COSTS    |     |   INDIRECT COSTS  |     |   REVENUE         |
+-------------------+     +-------------------+     +-------------------+
| v2_invoices       |     | v2_job_           |     | v2_draws          |
| (vendor invoices) |     | allocations       |     | (billed to owner) |
|                   |     |                   |     |                   |
| v2_time_entries   |     | - Labor burden    |     | v2_jobs           |
| (direct labor)    |     | - Equipment burden|     | (contract amount) |
|                   |     | - Overhead alloc  |     |                   |
| v2_equipment_     |     | - G&A allocation  |     | Change orders     |
| usage             |     |                   |     |                   |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                         |
         v                         v                         v
+------------------------------------------------------------------------+
|                       JOB PROFITABILITY CALCULATION                     |
+------------------------------------------------------------------------+
|                                                                         |
|  GROSS PROFIT = Revenue - Direct Costs (COGS)                          |
|                                                                         |
|  GROSS MARGIN % = (Gross Profit / Revenue) x 100                       |
|                                                                         |
|  NET PROFIT = Gross Profit - Indirect Costs (Overhead + G&A)           |
|                                                                         |
|  NET MARGIN % = (Net Profit / Revenue) x 100                           |
|                                                                         |
+------------------------------------------------------------------------+
                                 |
                                 v
+------------------------------------------------------------------------+
|                     v2_job_financials                                   |
| - job_id                   - direct_labor_cost                          |
| - period_id                - direct_material_cost                       |
| - contract_amount          - direct_equipment_cost                      |
| - billed_to_date           - direct_subcontract_cost                    |
| - collected_to_date        - indirect_labor_burden                      |
| - gross_profit             - indirect_equipment_burden                  |
| - gross_margin_pct         - overhead_allocation                        |
| - net_profit               - ga_allocation                              |
| - net_margin_pct           - total_cost                                 |
+------------------------------------------------------------------------+
```

### 4. WIP Report Generation

```
+-------------------+     +-------------------+     +-------------------+
|   CONTRACT DATA   |     |   COST DATA       |     |   BILLING DATA    |
+-------------------+     +-------------------+     +-------------------+
| v2_jobs           |     | v2_job_financials |     | v2_draws          |
| - contract_amount |     | - total_cost_     |     | - billed_amount   |
| - change_orders   |     |   to_date         |     | - status          |
+--------+----------+     +--------+----------+     +--------+----------+
         |                         |                         |
         v                         v                         v
+------------------------------------------------------------------------+
|                        WIP CALCULATION                                  |
+------------------------------------------------------------------------+
|                                                                         |
|  PERCENT COMPLETE = Costs to Date / Estimated Total Costs               |
|                                                                         |
|  EARNED REVENUE = Contract Amount x Percent Complete                    |
|                                                                         |
|  OVER/(UNDER) BILLING = Billings to Date - Earned Revenue               |
|                                                                         |
|  EST. GROSS PROFIT = Contract - Est. Total Costs                        |
|                                                                         |
|  PROFIT FADE/GAIN = Current Est. Profit - Original Est. Profit          |
|                                                                         |
+------------------------------------------------------------------------+
                                 |
                                 v
+------------------------------------------------------------------------+
|                      v2_wip_lines                                       |
| - job_id                    - percent_complete                          |
| - period_id                 - earned_revenue                            |
| - contract_amount           - billings_to_date                          |
| - costs_to_date             - over_under_billing                        |
| - est_costs_to_complete     - est_gross_profit                          |
| - est_total_costs           - profit_fade_gain                          |
+------------------------------------------------------------------------+
```

---

## Database Schema Suggestions

### Core Financial Tables

```sql
-- ============================================================
-- GENERAL LEDGER ACCOUNTS
-- Standard chart of accounts for construction companies
-- ============================================================

CREATE TABLE v2_gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT NOT NULL UNIQUE,      -- '1000', '5100', '6200'
  name TEXT NOT NULL,
  account_type TEXT NOT NULL,               -- 'asset', 'liability', 'equity', 'revenue', 'expense'
  category TEXT,                            -- 'current_asset', 'fixed_asset', 'job_cost', 'overhead', 'g&a'
  parent_account_id UUID REFERENCES v2_gl_accounts(id),
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  normal_balance TEXT DEFAULT 'debit',      -- 'debit' or 'credit'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- GL Account ranges (based on industry standards):
-- 1000-1999: Assets
-- 2000-2999: Liabilities
-- 3000-3999: Equity
-- 4000-4999: Revenue
-- 5000-5999: Job Costs (COGS/Direct)
-- 6000-6999: Overhead/Indirect
-- 7000-7999: Other Income
-- 8000-8999: Other Expense

-- ============================================================
-- EXPENSE CATEGORIES
-- Maps cost types to GL accounts for construction
-- ============================================================

CREATE TABLE v2_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,                -- 'MAT', 'LAB', 'EQP', 'SUB', 'OTH'
  gl_account_id UUID REFERENCES v2_gl_accounts(id),
  cost_type TEXT NOT NULL,                  -- 'direct', 'indirect', 'overhead', 'g&a'
  is_job_cost BOOLEAN DEFAULT true,         -- Can be allocated to jobs
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Standard expense categories:
-- M/MAT - Materials (Direct)
-- L/LAB - Labor (Direct)
-- E/EQP - Equipment (Direct)
-- S/SUB - Subcontractor (Direct)
-- O/OTH - Other Direct
-- OH - Overhead (Indirect)
-- GA - General & Administrative (Indirect)
```

### Expense Tracking Tables

```sql
-- ============================================================
-- EXPENSES
-- All company expenses, both direct and indirect
-- ============================================================

CREATE TABLE v2_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Classification
  expense_category_id UUID REFERENCES v2_expense_categories(id),
  gl_account_id UUID REFERENCES v2_gl_accounts(id),
  cost_type TEXT NOT NULL,                  -- 'direct', 'indirect', 'overhead', 'g&a'

  -- Job assignment (NULL for indirect costs)
  job_id UUID REFERENCES v2_jobs(id),
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  po_id UUID REFERENCES v2_purchase_orders(id),

  -- Expense details
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  quantity DECIMAL(12,4),
  unit_cost DECIMAL(12,4),

  -- Vendor/Payment info
  vendor_id UUID REFERENCES v2_vendors(id),
  invoice_id UUID REFERENCES v2_invoices(id),   -- Link to vendor invoice
  payment_method TEXT,                       -- 'check', 'credit_card', 'ach', 'cash'
  reference_number TEXT,                     -- Check #, CC last 4, etc.

  -- Dates
  expense_date DATE NOT NULL,
  period_id UUID REFERENCES v2_financial_periods(id),

  -- Allocation tracking (for indirect costs)
  is_allocated BOOLEAN DEFAULT false,
  allocated_at TIMESTAMPTZ,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_job ON v2_expenses(job_id);
CREATE INDEX idx_expenses_period ON v2_expenses(period_id);
CREATE INDEX idx_expenses_category ON v2_expenses(expense_category_id);
CREATE INDEX idx_expenses_date ON v2_expenses(expense_date);
```

### Labor Tracking Tables

```sql
-- ============================================================
-- EMPLOYEES
-- Employee master data for payroll and time tracking
-- ============================================================

CREATE TABLE v2_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Classification
  employee_type TEXT NOT NULL,              -- 'hourly', 'salary', 'contractor'
  department TEXT,                          -- 'field', 'office', 'management'
  trade TEXT,                               -- 'carpenter', 'electrician', etc.

  -- Pay rates
  base_hourly_rate DECIMAL(10,2),
  overtime_multiplier DECIMAL(4,2) DEFAULT 1.5,

  -- Burden components (can be overridden per employee)
  burden_rate_id UUID REFERENCES v2_labor_burden_rates(id),

  -- Status
  hire_date DATE,
  termination_date DATE,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LABOR BURDEN RATES
-- Components that add to base wage costs
-- ============================================================

CREATE TABLE v2_labor_burden_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                       -- 'Standard Field', 'Office', 'Union'

  -- Tax rates (as percentage of wages)
  fica_rate DECIMAL(6,4) DEFAULT 0.0765,    -- Social Security + Medicare (7.65%)
  futa_rate DECIMAL(6,4) DEFAULT 0.0060,    -- Federal Unemployment (0.6%)
  suta_rate DECIMAL(6,4) DEFAULT 0.0270,    -- State Unemployment (varies)

  -- Insurance (as percentage of wages)
  workers_comp_rate DECIMAL(6,4),           -- Workers comp (varies by trade)
  liability_rate DECIMAL(6,4),              -- General liability

  -- Benefits (as hourly amount or percentage)
  health_insurance_hourly DECIMAL(10,2),    -- $/hr or flat amount
  retirement_rate DECIMAL(6,4),             -- 401k match percentage

  -- Other (as percentage or hourly)
  vacation_rate DECIMAL(6,4),               -- Paid time off
  training_hourly DECIMAL(10,2),            -- Training costs
  small_tools_hourly DECIMAL(10,2),         -- Small tools/consumables

  -- Calculated total
  total_burden_rate DECIMAL(6,4),           -- Total as % of base wage

  -- Validity period
  effective_date DATE NOT NULL,
  end_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TIME ENTRIES
-- Individual time records for employees
-- ============================================================

CREATE TABLE v2_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES v2_employees(id),

  -- Job assignment
  job_id UUID REFERENCES v2_jobs(id),       -- NULL for indirect/overhead time
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Time data
  work_date DATE NOT NULL,
  hours_regular DECIMAL(6,2) DEFAULT 0,
  hours_overtime DECIMAL(6,2) DEFAULT 0,
  hours_double_time DECIMAL(6,2) DEFAULT 0,

  -- Cost calculation
  base_rate DECIMAL(10,2),                  -- Hourly rate at time of entry
  burden_rate_id UUID REFERENCES v2_labor_burden_rates(id),

  -- Calculated costs (populated on save)
  base_labor_cost DECIMAL(12,2),            -- Hours x Rate
  burden_cost DECIMAL(12,2),                -- Base x Burden %
  total_cost DECIMAL(12,2),                 -- Base + Burden

  -- Classification
  cost_type TEXT DEFAULT 'direct',          -- 'direct', 'indirect', 'overhead'

  -- Source
  timesheet_id UUID,                        -- Link to timesheet if grouped
  daily_log_id UUID,                        -- Link to daily log if from there

  -- Approval workflow
  status TEXT DEFAULT 'pending',            -- 'pending', 'approved', 'rejected'
  approved_by TEXT,
  approved_at TIMESTAMPTZ,

  -- Period
  period_id UUID REFERENCES v2_financial_periods(id),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_time_entries_employee ON v2_time_entries(employee_id);
CREATE INDEX idx_time_entries_job ON v2_time_entries(job_id);
CREATE INDEX idx_time_entries_date ON v2_time_entries(work_date);
CREATE INDEX idx_time_entries_period ON v2_time_entries(period_id);

-- ============================================================
-- PAYROLL PERIODS
-- Aggregated payroll data per period
-- ============================================================

CREATE TABLE v2_payroll_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE,

  -- Totals
  total_regular_hours DECIMAL(12,2),
  total_overtime_hours DECIMAL(12,2),
  total_gross_wages DECIMAL(12,2),
  total_burden DECIMAL(12,2),
  total_cost DECIMAL(12,2),

  -- Status
  status TEXT DEFAULT 'open',               -- 'open', 'processed', 'closed'
  processed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Equipment Tracking Tables

```sql
-- ============================================================
-- EQUIPMENT
-- Company-owned equipment for cost tracking
-- ============================================================

CREATE TABLE v2_equipment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_number TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,

  -- Classification
  equipment_type TEXT,                      -- 'vehicle', 'heavy_equipment', 'tool', 'trailer'
  category TEXT,                            -- For grouping

  -- Ownership data
  acquisition_date DATE,
  acquisition_cost DECIMAL(12,2),
  useful_life_years INTEGER,
  salvage_value DECIMAL(12,2),

  -- Depreciation
  depreciation_method TEXT DEFAULT 'straight_line',  -- 'straight_line', 'declining_balance', 'units_of_production'
  accumulated_depreciation DECIMAL(12,2) DEFAULT 0,
  current_book_value DECIMAL(12,2),

  -- Operating costs
  fuel_type TEXT,                           -- 'gasoline', 'diesel', 'electric', 'none'
  hourly_fuel_cost DECIMAL(10,2),
  hourly_maintenance_cost DECIMAL(10,2),

  -- Burden rate
  equipment_burden_rate_id UUID REFERENCES v2_equipment_burden_rates(id),

  -- Status
  status TEXT DEFAULT 'active',             -- 'active', 'maintenance', 'retired'
  current_job_id UUID REFERENCES v2_jobs(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT BURDEN RATES
-- All-in hourly rate for equipment
-- ============================================================

CREATE TABLE v2_equipment_burden_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  equipment_type TEXT,                      -- Applies to type, or NULL for all

  -- Ownership costs (monthly or hourly)
  depreciation_hourly DECIMAL(10,2),
  insurance_hourly DECIMAL(10,2),
  registration_hourly DECIMAL(10,2),
  storage_hourly DECIMAL(10,2),

  -- Operating costs (hourly)
  fuel_hourly DECIMAL(10,2),
  maintenance_hourly DECIMAL(10,2),
  repairs_hourly DECIMAL(10,2),
  tires_hourly DECIMAL(10,2),               -- For vehicles

  -- Total
  total_hourly_rate DECIMAL(10,2),

  -- Validity
  effective_date DATE NOT NULL,
  end_date DATE,

  -- Source
  source TEXT,                              -- 'calculated', 'fema', 'manual'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT USAGE
-- Track equipment hours per job
-- ============================================================

CREATE TABLE v2_equipment_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES v2_equipment(id),

  -- Job assignment
  job_id UUID REFERENCES v2_jobs(id),       -- NULL for overhead usage
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Usage data
  usage_date DATE NOT NULL,
  hours DECIMAL(6,2) NOT NULL,

  -- Operator (optional)
  employee_id UUID REFERENCES v2_employees(id),

  -- Cost calculation
  hourly_rate DECIMAL(10,2),                -- Rate at time of usage
  total_cost DECIMAL(12,2),                 -- Hours x Rate

  -- Classification
  cost_type TEXT DEFAULT 'direct',          -- 'direct', 'indirect'

  -- Period
  period_id UUID REFERENCES v2_financial_periods(id),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_equipment_usage_equipment ON v2_equipment_usage(equipment_id);
CREATE INDEX idx_equipment_usage_job ON v2_equipment_usage(job_id);
CREATE INDEX idx_equipment_usage_date ON v2_equipment_usage(usage_date);
```

### Cost Allocation Tables

```sql
-- ============================================================
-- COST POOLS
-- Groupings of indirect costs for allocation
-- ============================================================

CREATE TABLE v2_cost_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  pool_type TEXT NOT NULL,                  -- 'labor_overhead', 'equipment_overhead', 'g&a', 'custom'
  description TEXT,

  -- GL account range for this pool
  gl_account_start TEXT,                    -- e.g., '6000'
  gl_account_end TEXT,                      -- e.g., '6499'

  -- Or specific accounts
  gl_account_ids UUID[],                    -- Array of specific GL accounts

  -- Allocation base
  allocation_base TEXT NOT NULL,            -- 'labor_hours', 'labor_dollars', 'direct_costs', 'equipment_hours'

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ALLOCATION RULES
-- How to distribute pool costs to jobs
-- ============================================================

CREATE TABLE v2_allocation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES v2_cost_pools(id),

  name TEXT NOT NULL,
  description TEXT,

  -- Allocation method
  method TEXT NOT NULL,                     -- 'percentage', 'proportional', 'fixed'

  -- For percentage method
  fixed_percentage DECIMAL(6,4),

  -- For proportional method (uses allocation base from pool)
  -- Rate = Pool Total / Total Allocation Base
  -- Job Allocation = Rate x Job's Allocation Base

  -- Frequency
  frequency TEXT DEFAULT 'monthly',         -- 'weekly', 'monthly', 'quarterly', 'job_completion'

  -- Filters (optional)
  job_status_filter TEXT[],                 -- Only apply to jobs with these statuses
  exclude_job_ids UUID[],                   -- Jobs to exclude

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOB ALLOCATIONS
-- Actual allocated amounts per job per period
-- ============================================================

CREATE TABLE v2_job_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Source
  pool_id UUID REFERENCES v2_cost_pools(id),
  rule_id UUID REFERENCES v2_allocation_rules(id),

  -- Allocation calculation
  allocation_type TEXT NOT NULL,            -- 'labor_burden', 'equipment_burden', 'overhead', 'g&a'
  allocation_base_value DECIMAL(12,2),      -- Job's base value (hours, dollars, etc.)
  total_base_value DECIMAL(12,2),           -- Total base across all jobs
  allocation_rate DECIMAL(12,6),            -- Rate used
  allocated_amount DECIMAL(12,2) NOT NULL,

  -- Audit
  calculation_details JSONB,                -- Full calculation breakdown
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  allocated_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, period_id, pool_id)
);

CREATE INDEX idx_job_allocations_job ON v2_job_allocations(job_id);
CREATE INDEX idx_job_allocations_period ON v2_job_allocations(period_id);
```

### Job Profitability Tables

```sql
-- ============================================================
-- JOB FINANCIALS
-- Period-based financial summary per job
-- ============================================================

CREATE TABLE v2_job_financials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Contract data
  original_contract DECIMAL(12,2),
  approved_changes DECIMAL(12,2),
  current_contract DECIMAL(12,2),           -- Original + Changes

  -- Revenue
  billed_this_period DECIMAL(12,2),
  billed_to_date DECIMAL(12,2),
  collected_this_period DECIMAL(12,2),
  collected_to_date DECIMAL(12,2),

  -- Direct costs
  direct_labor_cost DECIMAL(12,2),
  direct_material_cost DECIMAL(12,2),
  direct_equipment_cost DECIMAL(12,2),
  direct_subcontract_cost DECIMAL(12,2),
  direct_other_cost DECIMAL(12,2),
  total_direct_cost DECIMAL(12,2),

  -- Indirect costs (from allocations)
  labor_burden_cost DECIMAL(12,2),
  equipment_burden_cost DECIMAL(12,2),
  overhead_allocation DECIMAL(12,2),
  ga_allocation DECIMAL(12,2),
  total_indirect_cost DECIMAL(12,2),

  -- Total cost
  total_cost DECIMAL(12,2),                 -- Direct + Indirect

  -- Profitability
  gross_profit DECIMAL(12,2),               -- Revenue - Direct Costs
  gross_margin_pct DECIMAL(6,2),            -- (Gross Profit / Revenue) x 100
  net_profit DECIMAL(12,2),                 -- Revenue - Total Costs
  net_margin_pct DECIMAL(6,2),              -- (Net Profit / Revenue) x 100

  -- Estimates
  est_cost_to_complete DECIMAL(12,2),
  est_total_cost DECIMAL(12,2),
  est_final_profit DECIMAL(12,2),
  est_final_margin_pct DECIMAL(6,2),

  -- Variance from budget
  budget_variance DECIMAL(12,2),
  budget_variance_pct DECIMAL(6,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, period_id)
);

CREATE INDEX idx_job_financials_job ON v2_job_financials(job_id);
CREATE INDEX idx_job_financials_period ON v2_job_financials(period_id);

-- ============================================================
-- JOB PROFITABILITY SNAPSHOTS
-- Historical tracking of profitability over time
-- ============================================================

CREATE TABLE v2_job_profitability_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  snapshot_date DATE NOT NULL,

  -- Key metrics at point in time
  percent_complete DECIMAL(6,2),
  total_cost_to_date DECIMAL(12,2),
  total_billed_to_date DECIMAL(12,2),
  current_gross_margin DECIMAL(6,2),
  current_net_margin DECIMAL(6,2),
  projected_final_margin DECIMAL(6,2),

  -- Change from previous snapshot
  margin_change DECIMAL(6,2),               -- Fade or gain

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, snapshot_date)
);
```

### WIP Reporting Tables

```sql
-- ============================================================
-- WIP SCHEDULES
-- Work-in-Progress schedule headers
-- ============================================================

CREATE TABLE v2_wip_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  report_date DATE NOT NULL,
  status TEXT DEFAULT 'draft',              -- 'draft', 'final'

  -- Totals
  total_contract_value DECIMAL(14,2),
  total_costs_to_date DECIMAL(14,2),
  total_est_costs_to_complete DECIMAL(14,2),
  total_billings_to_date DECIMAL(14,2),
  total_earned_revenue DECIMAL(14,2),
  net_over_under_billing DECIMAL(14,2),

  -- Metadata
  generated_by TEXT,
  generated_at TIMESTAMPTZ,
  finalized_by TEXT,
  finalized_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WIP LINES
-- Individual job lines on WIP schedule
-- ============================================================

CREATE TABLE v2_wip_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wip_schedule_id UUID NOT NULL REFERENCES v2_wip_schedules(id),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),

  -- Contract
  original_contract DECIMAL(12,2),
  change_orders DECIMAL(12,2),
  current_contract DECIMAL(12,2),

  -- Costs
  costs_to_date DECIMAL(12,2),
  est_costs_to_complete DECIMAL(12,2),
  est_total_costs DECIMAL(12,2),

  -- Percent complete calculation
  percent_complete_method TEXT,             -- 'cost_to_cost', 'physical', 'milestone'
  percent_complete DECIMAL(6,2),

  -- Revenue recognition
  earned_revenue DECIMAL(12,2),             -- Contract x % Complete

  -- Billings
  billings_to_date DECIMAL(12,2),

  -- Over/Under billing
  over_under_billing DECIMAL(12,2),         -- Billings - Earned Revenue
  -- Positive = Over-billed (liability)
  -- Negative = Under-billed (asset)

  -- Profit analysis
  est_gross_profit DECIMAL(12,2),           -- Contract - Est Total Costs
  est_gross_margin_pct DECIMAL(6,2),
  original_est_profit DECIMAL(12,2),
  profit_fade_gain DECIMAL(12,2),           -- Current Est - Original Est

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wip_lines_schedule ON v2_wip_lines(wip_schedule_id);
CREATE INDEX idx_wip_lines_job ON v2_wip_lines(job_id);
```

### Financial Period Tables

```sql
-- ============================================================
-- FINANCIAL PERIODS
-- Monthly accounting periods for close process
-- ============================================================

CREATE TABLE v2_financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,            -- 1-12
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'open',               -- 'open', 'closing', 'closed'

  -- Close process tracking
  close_started_at TIMESTAMPTZ,
  close_started_by TEXT,
  close_completed_at TIMESTAMPTZ,
  close_completed_by TEXT,

  -- Close checklist (JSONB for flexibility)
  close_checklist JSONB,                    -- Track which steps completed

  -- Locks
  invoices_locked_at TIMESTAMPTZ,           -- Prevent new invoice posting
  payroll_locked_at TIMESTAMPTZ,            -- Prevent timesheet changes
  expenses_locked_at TIMESTAMPTZ,           -- Prevent expense changes
  allocations_run_at TIMESTAMPTZ,           -- When overhead allocated

  -- Adjustments allowed after close
  adjustments_allowed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(period_year, period_month)
);

-- ============================================================
-- PERIOD SNAPSHOTS
-- Frozen financial data at period close
-- ============================================================

CREATE TABLE v2_period_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Company-level totals
  total_revenue DECIMAL(14,2),
  total_direct_costs DECIMAL(14,2),
  total_indirect_costs DECIMAL(14,2),
  total_gross_profit DECIMAL(14,2),
  total_net_profit DECIMAL(14,2),

  -- Summary by category
  revenue_by_job JSONB,                     -- {job_id: amount, ...}
  costs_by_category JSONB,                  -- {category: amount, ...}
  costs_by_job JSONB,                       -- {job_id: amount, ...}

  -- Key metrics
  overall_gross_margin DECIMAL(6,2),
  overall_net_margin DECIMAL(6,2),
  backlog DECIMAL(14,2),                    -- Contract Value - Earned Revenue

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Integration Points with Existing Ross Built CMS Tables

### Direct Integration (Foreign Keys)

| New Table | Existing Table | Integration |
|-----------|----------------|-------------|
| v2_expenses | v2_jobs | FK: job_id for direct costs |
| v2_expenses | v2_vendors | FK: vendor_id for vendor payments |
| v2_expenses | v2_invoices | FK: invoice_id links expense to vendor invoice |
| v2_expenses | v2_cost_codes | FK: cost_code_id for categorization |
| v2_expenses | v2_purchase_orders | FK: po_id for committed costs |
| v2_time_entries | v2_jobs | FK: job_id for direct labor |
| v2_time_entries | v2_cost_codes | FK: cost_code_id for labor categorization |
| v2_equipment_usage | v2_jobs | FK: job_id for equipment allocation |
| v2_equipment_usage | v2_cost_codes | FK: cost_code_id |
| v2_job_financials | v2_jobs | FK: job_id |
| v2_wip_lines | v2_jobs | FK: job_id |
| v2_job_allocations | v2_jobs | FK: job_id |

### Data Flow Integration

| Source Data | Financial Module Use |
|-------------|---------------------|
| v2_invoices (amount, status='paid') | Feed into v2_job_financials.direct_material_cost |
| v2_invoice_allocations | Break down invoice costs by cost code |
| v2_budget_lines | Compare to actual costs for variance analysis |
| v2_draws | Feed into WIP billings_to_date |
| v2_purchase_orders | Committed costs for job profitability |
| v2_po_line_items | Cost code level PO tracking |
| v2_jobs.contract_amount | WIP contract value |
| v2_change_orders | WIP approved changes |

### Calculation Integration

```
EXISTING DATA                    FINANCIAL CALCULATION
--------------                   ----------------------

v2_invoices (vendor)    ------>  Direct Material Cost
v2_invoice_allocations  ------>  Cost by Code breakdown

v2_time_entries         ------>  Direct Labor Cost
                       \------>  + Labor Burden = Total Labor

v2_equipment_usage      ------>  Direct Equipment Cost
                       \------>  + Equip Burden = Total Equipment

v2_budget_lines         ------>  Budget vs Actual variance

v2_draws (billed)       ------>  WIP billings_to_date
v2_jobs (contract)      ------>  WIP contract_amount

v2_purchase_orders      ------>  Committed costs
(open status)                    (not yet invoiced)
```

---

## Key Formulas and Calculations

### Labor Burden Rate Calculation

```javascript
// Industry standard: 40-70% of base wage

laborBurden = {
  // Federal taxes (required)
  fica: baseWage * 0.0765,           // 7.65% (Social Security + Medicare)
  futa: baseWage * 0.006,            // 0.6% Federal Unemployment

  // State taxes (varies)
  suta: baseWage * 0.027,            // ~2.7% average State Unemployment

  // Insurance (varies by trade/state)
  workersComp: baseWage * wcRate,    // 3-20% depending on trade
  liability: baseWage * 0.02,        // ~2% general liability

  // Benefits (if offered)
  health: hoursWorked * healthHourly, // e.g., $4.50/hr
  retirement: baseWage * 0.03,        // 3% 401k match

  // Other
  vacation: baseWage * 0.04,          // ~2 weeks = 4%
  training: hoursWorked * 0.50,       // $0.50/hr training
  smallTools: hoursWorked * 0.25      // $0.25/hr tools/consumables
};

fullyBurdenedRate = baseHourlyRate * (1 + totalBurdenPercent);
// Example: $30/hr * 1.45 = $43.50/hr fully burdened
```

### Overhead Allocation Calculation

```javascript
// Method: Labor Hours Base
overheadPool = sumOfIndirectExpenses(period);
totalLaborHours = sumAllJobDirectLaborHours(period);
overheadRatePerHour = overheadPool / totalLaborHours;
jobOverhead = jobDirectLaborHours * overheadRatePerHour;

// Method: Direct Cost Base
overheadPool = sumOfIndirectExpenses(period);
totalDirectCosts = sumAllJobDirectCosts(period);
overheadRatePercent = overheadPool / totalDirectCosts;
jobOverhead = jobDirectCosts * overheadRatePercent;

// Industry benchmark: 10-11% of total project costs
```

### Job Profitability Calculation

```javascript
// Direct Costs (COGS)
directCosts = {
  labor: sumDirectLaborCost(job),
  material: sumMaterialInvoices(job),
  equipment: sumEquipmentUsage(job),
  subcontract: sumSubcontractInvoices(job),
  other: sumOtherDirectCosts(job)
};
totalDirectCost = sum(directCosts);

// Indirect Costs
indirectCosts = {
  laborBurden: directCosts.labor * laborBurdenRate,
  equipmentBurden: directCosts.equipment * equipmentBurdenRate,
  overheadAllocation: jobOverheadAllocation,
  gaAllocation: jobGAAllocation
};
totalIndirectCost = sum(indirectCosts);

// Profitability
revenue = billedAmount;  // or earnedRevenue for accrual
grossProfit = revenue - totalDirectCost;
grossMarginPct = (grossProfit / revenue) * 100;  // Target: 20-26%
netProfit = grossProfit - totalIndirectCost;
netMarginPct = (netProfit / revenue) * 100;      // Target: 3-8%
```

### WIP Calculation (Cost-to-Cost Method)

```javascript
// Percent Complete
percentComplete = costsToDate / estimatedTotalCosts;

// Earned Revenue
earnedRevenue = contractAmount * percentComplete;

// Over/Under Billing
overUnderBilling = billingsToDate - earnedRevenue;
// Positive = Over-billed (Billings in Excess) - Liability
// Negative = Under-billed (Costs in Excess) - Asset

// Profit Fade/Gain
originalEstProfit = originalContract - originalEstCosts;
currentEstProfit = currentContract - currentEstCosts;
profitFadeGain = currentEstProfit - originalEstProfit;
// Negative = Profit Fade (bad)
// Positive = Profit Gain (good)
```

---

## Industry References

### Overhead Allocation Methods
- [Foundation Software - Overhead Allocation Methods](https://www.foundationsoft.com/learn/overhead-allocation-methods/)
- [RedHammer - Overhead Allocation Best Practices](https://www.redhammer.io/blog/overhead-allocation-in-construction-best-practices)
- [Deltek - Overhead Cost Allocation](https://www.deltek.com/en/construction/accounting/job-costing/overhead-cost)

### Labor Burden Calculation
- [Procore - Fully Burdened Labor Rate](https://www.procore.com/library/fully-burdened-labor-rate)
- [eBacon - Construction Labor Burden Formula](https://www.ebacon.com/construction/construction-labor-burden-calculation-the-complete-formula/)
- [Autodesk - Construction Labor Burden Explained](https://www.autodesk.com/blogs/construction/construction-labor-burden-explained/)

### Job Profitability & WIP
- [Procore - Job Costing in Construction](https://www.procore.com/library/job-costing)
- [Deltek - Work in Progress Guide](https://www.deltek.com/en/construction/accounting/work-in-progress)
- [AICPA - WIP Schedules for Construction](https://www.aicpa-cima.com/professional-insights/article/wip-schedules-blueprints-for-solid-construction-accounting)

### Database Structure Patterns
- [Foundation Software - Top 20 Tables](http://www.foundationupdates.com/webinars/2011/docs/01122011top20tables.pdf)
- [Sage 300 CRE Data Structure](https://onpoint-software.com/wp-content/uploads/2021/03/Sage-300-CRE-Data-Structure.pdf)
- [Chart of Accounts for Construction](https://www.jonasconstruction.com/chart-of-accounts-construction-company/)

### ERP Integration Patterns
- [Autodesk - Construction ERP Integrations](https://www.autodesk.com/blogs/construction/construction-erp-financial-integrations/)
- [Merge - ERP API Integration](https://www.merge.dev/blog/erp-api-integration)

### Cost Pool Allocation
- [AAFCPAs - Burden Calculations](https://www.aafcpa.com/2016/10/11/burden-calculations-how-to-allocate-your-indirect-cost-pools-to-specific-jobs/)
- [BQE Core - Calculating Indirect Rates](https://corehelpcenter.bqe.com/hc/en-us/articles/360009052854-Calculating-indirect-rates-based-on-cost-pools)

---

## Implementation Recommendations

### Phase 1: Foundation (Weeks 1-2)
1. Create GL accounts and expense categories tables
2. Set up expense tracking with job/cost code allocation
3. Link existing invoices to expense records
4. Basic expense reporting

### Phase 2: Labor Tracking (Weeks 3-4)
1. Create employee and time entry tables
2. Implement labor burden rate configuration
3. Build timesheet entry interface
4. Calculate fully burdened labor costs

### Phase 3: Equipment Tracking (Week 5)
1. Create equipment and usage tables
2. Implement equipment burden rates
3. Build usage tracking interface
4. Calculate equipment costs per job

### Phase 4: Cost Allocation (Weeks 6-7)
1. Create cost pools and allocation rules
2. Implement allocation engine
3. Build allocation configuration UI
4. Run period-based allocations

### Phase 5: Job Profitability (Weeks 8-9)
1. Create job financials aggregation
2. Implement profitability calculations
3. Build profitability dashboard
4. Variance analysis reports

### Phase 6: WIP Reporting (Week 10)
1. Create WIP schedule tables
2. Implement WIP calculations
3. Build WIP report interface
4. Period close integration

### Phase 7: Financial Periods (Weeks 11-12)
1. Create period management tables
2. Implement close checklist
3. Build period close workflow
4. Historical snapshot reporting
