# Research Summary: v3.1 Business Intelligence & Financial Management

**Synthesized:** 2026-01-20
**Sources:** STACK.md, FEATURES.md, FINANCIAL-MANAGEMENT-ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

This research explores building a sophisticated financial management system for Ross Built Custom Homes. The system will track true job costs (including labor burden, equipment, and allocated overhead), enable accurate job bidding through the **% of Labor Hours** allocation method, and provide business intelligence dashboards for strategic planning.

**Key Finding**: The most critical decision—using % of Labor Hours for overhead allocation instead of % of Direct Costs—is validated by industry research. Direct cost allocation causes custom builders to win "headache jobs" (high material, low labor) and lose "easy jobs" (low material, high labor), systematically eroding profitability.

**Scope**: ~20 new database tables, integration with existing invoice/PO/draw systems, and new UI for expense tracking, time entry, and financial dashboards.

---

## Critical Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Overhead allocation method | % of Labor Hours | Industry best practice for custom builders; avoids direct-cost allocation trap |
| App structure | Same app, role-based | Simpler deployment; PMs see job-level data, admins see company-wide |
| Labor burden approach | Detailed calculation | 30-60% of wages; quarterly review yields 12-18% better cost control (AGC) |
| Financial precision | DECIMAL(12,2) + Decimal.js | Avoid floating-point errors in money calculations |

---

## Key Technical Findings

### Libraries (from STACK.md)
- **Decimal.js ^10.4** - Arbitrary precision for financial calculations
- **Dinero.js ^2.0** - Currency handling with immutable operations
- **date-fns ^3.6** - Period calculations (pay periods, fiscal months)
- **Chart.js ^4.4** - Dashboard visualizations
- **pdfmake ^0.2** - PDF report generation
- **node-cron ^3.0** - Scheduled jobs (period close, snapshots)

### Database Schema (from ARCHITECTURE.md)
New tables organized by domain:

| Domain | Tables | Purpose |
|--------|--------|---------|
| General Ledger | v2_gl_accounts, v2_expense_categories, v2_expenses | Track company expenses |
| Labor | v2_employees, v2_labor_burden_rates, v2_time_entries, v2_payroll_periods | Time tracking + burden |
| Equipment | v2_equipment, v2_equipment_burden_rates, v2_equipment_usage | Fleet cost allocation |
| Allocation | v2_cost_pools, v2_allocation_rules, v2_job_allocations | Overhead to jobs |
| Reporting | v2_job_financials, v2_job_profitability_snapshots, v2_wip_schedules | Financial reports |
| Periods | v2_financial_periods, v2_period_snapshots | Time-based data integrity |

### Critical Formulas

**Labor Burden Rate**:
```
Burden Rate = (Payroll Taxes + Workers Comp + Benefits + PTO Value) / Base Wages
Burdened Labor = Base Wages × (1 + Burden Rate)
```

**Overhead Allocation**:
```
Overhead Rate = Total Overhead / Total Labor Hours (company-wide)
Job Overhead = Job Labor Hours × Overhead Rate
```

**Job Profitability**:
```
All-In Cost = Direct Costs + Burdened Labor + Equipment + Allocated Overhead
Gross Margin = (Revenue - All-In Cost) / Revenue
```

---

## Feature Priorities (from FEATURES.md)

### Table Stakes (Must Have)
- Job cost tracking with real-time budget vs actual
- Labor hour tracking with burden calculation
- Overhead allocation engine (% of Labor Hours)
- Job profitability reports showing all-in costs
- WIP (Work-in-Progress) schedule generation

### Differentiators (Should Have)
- Real-time overhead rate dashboard
- What-if job bidding calculator
- Historical overhead trend analysis
- Capacity planning based on labor hours
- Cash flow projections

### Future (Could Have)
- Multi-entity support
- Full GL integration
- Automated bank feeds
- AI-powered job duration predictions

---

## Critical Pitfalls to Avoid (from PITFALLS.md)

### Phase 1 Pitfalls (Expense Tracking)
| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| Wrong expense categorization | Bad overhead rates | Provide category guidance, allow recategorization |
| Missing expenses | Understated overhead | Require receipt upload, flag incomplete periods |
| Period close timing | Stale data | Lock periods, require review before close |

### Phase 2 Pitfalls (Labor & Burden)
| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| Underestimating burden (30-50% common) | Jobs appear more profitable than reality | Include ALL burden components: FICA, FUTA, SUTA, workers comp, health, 401k match, PTO accrual |
| Ignoring burden variability | Wrong job costs | Calculate burden per employee class, update quarterly |

### Phase 3 Pitfalls (Allocation)
| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| **CRITICAL**: Using % of Direct Costs | Win bad jobs, lose good jobs | Use % of Labor Hours method |
| Allocating overhead before period close | Unstable numbers | Only allocate from closed periods |
| Ignoring seasonal variation | Wrong annual rates | Use rolling 12-month averages |

### Phase 4 Pitfalls (Reporting)
| Pitfall | Impact | Mitigation |
|---------|--------|------------|
| Reporting partially allocated data | Misleading reports | Show "provisional" badge until period closed |
| No historical comparison | Can't spot trends | Store snapshots, show YoY/QoQ comparisons |

---

## Implications for Roadmap

Based on research findings, the recommended phase structure:

### Phase 1: Foundation & Expense Tracking
**Goal**: Track company expenses by category for overhead calculation

- Database migrations for GL accounts, expense categories, expenses
- Expense entry UI (amount, vendor, category, date, receipt)
- Expense list with filters and search
- Period management (open/close months)
- Integration: Link expenses to existing vendors

**Pitfall focus**: Expense categorization, period timing

### Phase 2: Labor & Time Tracking Enhancement
**Goal**: Capture labor hours by job for allocation basis

- Employee management (name, role, burden class)
- Labor burden rate configuration per employee class
- Time entry enhancement (existing daily logs → hours by job)
- Payroll period management
- Burdened labor cost calculation

**Pitfall focus**: Burden underestimation, burden variability

### Phase 3: Equipment & Fleet Tracking
**Goal**: Track equipment costs and allocate to jobs

- Equipment registry (trucks, tools, heavy equipment)
- Equipment burden rates (depreciation, maintenance, fuel)
- Equipment usage logging (which job, how long)
- Equipment cost allocation to jobs

**Pitfall focus**: Missing equipment costs, allocation timing

### Phase 4: Overhead Allocation Engine
**Goal**: Allocate overhead to jobs using % of Labor Hours

- Cost pool configuration (which expense categories → overhead)
- Allocation rule setup (% of Labor Hours method)
- Allocation calculation engine
- Job overhead assignment
- Overhead rate dashboard (current rate, trend)

**Pitfall focus**: Using wrong allocation method, period timing

### Phase 5: Job Profitability Reporting
**Goal**: Show true all-in job costs and margins

- Job financial summary (direct + burden + equipment + overhead)
- Job profitability report with all-in margins
- Profitability snapshots for trend analysis
- Budget vs actual with overhead included
- Job comparison reports

**Pitfall focus**: Partial allocation reporting, historical comparison

### Phase 6: Business Intelligence Dashboard
**Goal**: Company-wide P&L and strategic planning tools

- Company P&L dashboard (revenue, costs, margins)
- Overhead trend analysis
- Capacity planning (labor hours available vs committed)
- Cash flow projections
- KPI scorecards

**Pitfall focus**: Data integrity, benchmark comparison

### Phase 7: Bidding & Planning Tools
**Goal**: Use financial data for job bidding and business planning

- Job bidding calculator (estimate overhead allocation)
- Pipeline forecasting (committed vs projected revenue)
- What-if analysis for overhead rate changes
- Bonus calculation tools
- Strategic planning reports

---

## Integration Points

The new financial system integrates with existing Ross Built data:

| Existing Table | Integration |
|----------------|-------------|
| v2_jobs | Job profitability calculations, labor hour allocation |
| v2_invoices | Direct costs from approved invoices |
| v2_purchase_orders | Committed costs for WIP calculations |
| v2_draws | Revenue recognition timing |
| v2_budget_lines | Budget vs actual with overhead |
| v2_vendors | Expense vendor linking |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Labor hour tracking adoption | Medium | High | Make time entry fast and mobile-friendly |
| Expense categorization errors | High | Medium | Provide defaults, allow bulk recategorization |
| Period close discipline | Medium | High | Automated reminders, lock periods |
| Overhead rate volatility | Low | Medium | Use rolling averages, show trend context |

---

## Recommended MVP Scope

For v3.1, focus on the core allocation loop:

1. **Expense tracking** - Know total overhead
2. **Labor hour tracking** - Know allocation basis
3. **Allocation engine** - Calculate job overhead
4. **Job profitability report** - Show all-in costs

Defer to v3.2+:
- Equipment tracking (use estimate for now)
- Full WIP schedule generation
- Advanced business planning tools
- Multi-period trend analysis

---

## Next Steps

1. **Define Requirements** (`/gsd:define-requirements`)
   - Scope features for v3.1 vs v3.2
   - Create checkable requirements list
   - Map requirements to phases

2. **Create Roadmap** (`/gsd:create-roadmap`)
   - Build phases from requirements
   - Estimate scope per phase
   - Identify dependencies

---

## Research Documents

| Document | Purpose |
|----------|---------|
| [STACK.md](./STACK.md) | Library recommendations, formulas, code patterns |
| [FEATURES.md](./FEATURES.md) | Feature landscape, competitor analysis, MVP definition |
| [PITFALLS.md](./PITFALLS.md) | Critical mistakes and mitigations by phase |
| [FINANCIAL-MANAGEMENT-ARCHITECTURE.md](./FINANCIAL-MANAGEMENT-ARCHITECTURE.md) | Database schema, data flows, integration points |
