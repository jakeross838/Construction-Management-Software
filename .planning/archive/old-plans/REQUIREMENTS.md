# Requirements: Ross Built CMS v3.1

**Defined:** 2026-01-20
**Core Value:** Run your entire construction business from one intelligent system

## v3.1 Requirements

Requirements for Business Intelligence & Financial Management milestone. Each maps to roadmap phases.

### Expense Tracking

- [x] **EXP-01**: Admin can enter non-invoice expenses (amount, vendor, category, date, notes)
- [x] **EXP-02**: Admin can categorize expenses by overhead type (office, fleet, equipment, admin)
- [x] **EXP-03**: Admin can open/close financial periods (monthly close with lock)
- [x] **EXP-04**: Admin can configure recurring expenses (auto-create monthly)
- [x] **EXP-05**: Admin can attach receipts/documents to expenses
- [x] **EXP-06**: Admin can view expense list with filters (period, category, vendor)

### Labor Tracking & Burden

- [ ] **LAB-01**: User can enter labor hours (employee, job, hours, date, cost code)
- [ ] **LAB-02**: Admin can manage employees (name, role, burden class)
- [ ] **LAB-03**: Admin can configure company-wide burden rate (default %)
- [ ] **LAB-04**: Admin can configure multiple burden rates by employee class
- [ ] **LAB-05**: System calculates burdened labor cost automatically (Base × (1 + Burden Rate))
- [ ] **LAB-06**: System prompts quarterly burden rate review
- [ ] **LAB-07**: User can view labor hours by job, employee, or period
- [ ] **LAB-08**: Employee can submit digital timesheet (job, hours, date, notes)
- [ ] **LAB-09**: Employee can view their submitted time history
- [ ] **LAB-10**: Admin can view/approve submitted timesheets
- [ ] **LAB-11**: System validates timesheet entries (reasonable hours, valid jobs)
- [ ] **LAB-12**: Employee can edit timesheet within submission window

### Overhead Allocation

- [ ] **OVH-01**: Admin can configure cost pools (which expense categories → overhead)
- [ ] **OVH-02**: Admin can set allocation method (% of Labor Hours primary)
- [ ] **OVH-03**: System calculates overhead rate (Total Overhead / Total Labor Hours)
- [ ] **OVH-04**: System allocates overhead to jobs based on labor hours
- [ ] **OVH-05**: Admin can view overhead rate dashboard (current rate, trend)
- [ ] **OVH-06**: System only allocates from closed periods (data integrity)

### Job Profitability Reports

- [ ] **JOB-01**: User can view job cost summary (direct costs + burden + overhead)
- [ ] **JOB-02**: User can view budget vs actual by cost code (variance analysis)
- [ ] **JOB-03**: User can compare jobs by profitability (ranked list)
- [ ] **JOB-04**: System stores monthly profitability snapshots per job
- [ ] **JOB-05**: User can view gross and net margin per job
- [ ] **JOB-06**: User can drill down from job summary to cost details

### WIP Schedule

- [ ] **WIP-01**: System calculates % complete (costs to date / estimated total costs)
- [ ] **WIP-02**: System calculates earned revenue (contract × % complete)
- [ ] **WIP-03**: System calculates over/under billing (billed - earned)
- [ ] **WIP-04**: System auto-populates WIP from existing draw data
- [ ] **WIP-05**: User can view WIP schedule report
- [ ] **WIP-06**: System alerts on significant over/under billing (threshold configurable)

### Company P&L Dashboard

- [ ] **PNL-01**: User can view revenue by period (contract revenue, change orders)
- [ ] **PNL-02**: User can view COGS breakdown (materials, labor, subs, equipment)
- [ ] **PNL-03**: User can view operating expenses by category (overhead)
- [ ] **PNL-04**: User can view gross profit and gross margin %
- [ ] **PNL-05**: User can view net income and net margin %
- [ ] **PNL-06**: User can compare periods (month vs month, YoY)

### Cash Flow & Forecasting

- [ ] **CSH-01**: User can view AR aging report (0-30, 31-60, 61-90, 90+ days)
- [ ] **CSH-02**: User can view AP aging report (by due date)
- [ ] **CSH-03**: System generates 13-week cash flow forecast
- [ ] **CSH-04**: System projects cash inflows from draw schedules
- [ ] **CSH-05**: System projects cash outflows from payables

### Business Planning

- [ ] **BIZ-01**: User can view backlog (signed work not completed, backlog months)
- [ ] **BIZ-02**: User can view KPI dashboard (margins, backlog, DSO, variance)
- [ ] **BIZ-03**: User can view capacity planning (labor hours available vs needed)
- [ ] **BIZ-04**: User can view pipeline (leads → bids → signed → in progress)
- [ ] **BIZ-05**: Admin can configure KPI targets and thresholds

## v3.2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Role-Based Access

- **ROL-01**: Admin role with full financial access
- **ROL-02**: PM role with job-level data only
- **ROL-03**: Sensitive data controls (hide salary, burden rates from non-admins)

### Equipment & Fleet Tracking

- **EQP-01**: Equipment registry with burden rates (trucks, trailers, tools)
- **EQP-02**: Equipment usage logging by job (which equipment, duration)
- **EQP-03**: Equipment cost allocation to jobs based on usage

### Advanced Features

- **ADV-01**: Mobile expense capture (photo receipt → AI extraction → job assignment)
- **ADV-02**: Variance pattern detection (ML-powered insights)
- **ADV-03**: Bonus calculation framework (targets, tracking)
- **ADV-04**: What-if analysis for overhead rate changes

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full General Ledger | QuickBooks already does this; build integration instead |
| Payroll Processing | Highly regulated; integrate with Gusto/ADP instead |
| Multi-Company/Multi-Entity | Adds massive complexity; focus on single company |
| Activity-Based Costing (ABC) | Overkill for custom builders; % of Labor Hours sufficient |
| Bank Reconciliation | Core accounting function; leave to QuickBooks |
| Tax Preparation | Specialized, liability; export data for accountant |
| Complex Depreciation | Accounting function; track costs, let accountants depreciate |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXP-01 | Phase 78 | Complete |
| EXP-02 | Phase 78 | Complete |
| EXP-03 | Phase 78 | Complete |
| EXP-04 | Phase 79 | Complete |
| EXP-05 | Phase 79 | Complete |
| EXP-06 | Phase 78 | Complete |
| LAB-01 | Phase 81 | Pending |
| LAB-02 | Phase 80 | Pending |
| LAB-03 | Phase 80 | Pending |
| LAB-04 | Phase 80 | Pending |
| LAB-05 | Phase 80 | Pending |
| LAB-06 | Phase 80 | Pending |
| LAB-07 | Phase 81 | Pending |
| LAB-08 | Phase 81 | Pending |
| LAB-09 | Phase 81 | Pending |
| LAB-10 | Phase 81 | Pending |
| LAB-11 | Phase 81 | Pending |
| LAB-12 | Phase 81 | Pending |
| OVH-01 | Phase 82 | Pending |
| OVH-02 | Phase 82 | Pending |
| OVH-03 | Phase 82 | Pending |
| OVH-04 | Phase 82 | Pending |
| OVH-05 | Phase 82 | Pending |
| OVH-06 | Phase 82 | Pending |
| JOB-01 | Phase 83 | Pending |
| JOB-02 | Phase 83 | Pending |
| JOB-03 | Phase 83 | Pending |
| JOB-04 | Phase 83 | Pending |
| JOB-05 | Phase 83 | Pending |
| JOB-06 | Phase 83 | Pending |
| WIP-01 | Phase 84 | Pending |
| WIP-02 | Phase 84 | Pending |
| WIP-03 | Phase 84 | Pending |
| WIP-04 | Phase 84 | Pending |
| WIP-05 | Phase 84 | Pending |
| WIP-06 | Phase 84 | Pending |
| PNL-01 | Phase 85 | Pending |
| PNL-02 | Phase 85 | Pending |
| PNL-03 | Phase 85 | Pending |
| PNL-04 | Phase 85 | Pending |
| PNL-05 | Phase 85 | Pending |
| PNL-06 | Phase 85 | Pending |
| CSH-01 | Phase 86 | Pending |
| CSH-02 | Phase 86 | Pending |
| CSH-03 | Phase 86 | Pending |
| CSH-04 | Phase 86 | Pending |
| CSH-05 | Phase 86 | Pending |
| BIZ-01 | Phase 87 | Pending |
| BIZ-02 | Phase 87 | Pending |
| BIZ-03 | Phase 87 | Pending |
| BIZ-04 | Phase 87 | Pending |
| BIZ-05 | Phase 87 | Pending |

**Coverage:**
- v3.1 requirements: 46 total
- Mapped to phases: 46
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after roadmap creation*
