# Data Integrity Audit Report
Phase 103 - 2026-01-21

## Executive Summary
- **Total pages audited:** 53 HTML pages
- **Pages with stat cards:** 26 pages
- **Hardcoded user values found:** 54 instances in 28 files
- **Data integrity issues:** 0 critical (all stat cards load from API)
- **Placeholder "$0" values:** 127 instances (all properly initialized, populated from API)

## Assessment Overview

### Good Practices Found
The codebase demonstrates generally good data practices:
- All stat cards initialize with placeholder values ("$0", "0", "-") that are populated via API calls
- Budget page correctly loads from `/api/jobs/{id}/budget` endpoint
- Dashboard loads from `/api/dashboard/stats`, `/api/purchase-orders/stats`, `/api/vendors/expiring`
- Money formatting is consistent using `formatMoney()` or `formatCurrency()` functions
- Data flows from API to UI are properly implemented

### Issues Identified

**Category 1: Hardcoded User References (54 instances)**
All instances use `'Jake Ross'` as a placeholder for authentication - this is expected since auth system is not yet implemented.

**Category 2: Placeholder Values**
All "$0" values in HTML are properly designed as initial placeholders that get populated from API data. This is correct practice.

---

## Pages Audited

### Financial Pages
| Page | Stat Cards/Summary Values | Data Source | Hardcoded Values | Status |
|------|--------------------------|-------------|------------------|--------|
| budgets.html | 16 summary values (Base Contract, Current Contract, Billed, Projected, Remaining, Variance, etc.) | `/api/jobs/{id}/budget` | None | OK - Loads from job.contract_amount |
| draws.html | 10 summary values (This Period, Payment Due, Funded Amount, G702 lines) | `/api/draws/{id}` | None | OK - Calculates from invoice allocations |
| profitability.html | 5 summary values (Total Contract, Total Cost, Gross Profit, Net Profit, Margin) | `/api/profitability/jobs` | None | OK - Derived from job data |
| wip.html | 6 summary values (Contract, Earned Revenue, Over/Underbilling, Projected Profit) | `/api/wip` | None | OK - Calculated from job budget data |
| pnl.html | 5 summary values (YTD Revenue, COGS, Gross Profit, Op Income, Net Income) | `/api/pnl/summary` | None | OK - Calculated from financial data |
| cash-flow.html | 6 summary values (Receivables, Payables, Net Position, Due in 7 days) | `/api/cash-flow/summary` | None | OK - Derived from AR/AP data |
| overhead.html | 3 rate cards + preview | `/api/overhead` | None | OK - Calculated from expense/timesheet data |
| expenses.html | 5 stat values (Total, Office, Fleet, Equipment, Admin) | `/api/expenses/stats` | None | OK |
| timesheets.html | 3 stat cards (Hours, Entries, Cost) | `/api/timesheets/stats` | None | OK |
| financial-periods.html | 4 stat values | `/api/financial-periods/stats` | None | OK |

### Dashboard & Overview Pages
| Page | Stat Cards | Data Source | Hardcoded Values | Status |
|------|------------|-------------|------------------|--------|
| dashboard.html | 4 stat cards (Pending Invoices, Approved Amount, Open POs, Expiring Vendors) | `/api/dashboard/stats`, `/api/purchase-orders/stats`, `/api/vendors/expiring` | None | OK |
| business-dashboard.html | 5 metric cards (Active Jobs, Pipeline Value, Pending Invoices, Pending Draws, Projected Profit) | `/api/business/dashboard` | None | OK |
| job-hub.html | 10+ hub stats (Contract, Billed, Paid, Budget totals, Invoice/PO/Draw totals) | Multiple job APIs | None | OK |
| job-profile.html | 8 spec stats + 6 financial metrics | `/api/jobs/{id}`, `/api/jobs/{id}/budget` | None | OK |

### Operational Pages
| Page | Stat Cards | Data Source | Hardcoded Values | Status |
|------|------------|-------------|------------------|--------|
| inspections.html | 4 stat values | `/api/inspections/stats` | `CURRENT_USER='Jake Ross'` (line 24) | Auth placeholder |
| punch-lists.html | 5 stat values | `/api/punch-lists/stats` | `CURRENT_USER='Jake Ross'` (line 23) | Auth placeholder |
| daily-logs.html | 4 stat cards | `/api/daily-logs/stats` | 'Jake Ross' in save/delete | Auth placeholder |
| rfis.html | 4 stat values | `/api/rfis/stats` | 'Jake Ross' in form defaults | Auth placeholder |
| submittals.html | 5 stat cards | `/api/submittals/stats` | 'Jake Ross' in form defaults | Auth placeholder |
| tasks.html | 5 stat cards | `/api/tasks/stats` | 'Jake Ross' in assignee/creator | Auth placeholder |
| closeout.html | 5 stat values | `/api/closeout/stats` | None | OK |
| warranties.html | 5 stat cards | `/api/warranties/stats` | 'Jake Ross' in created_by | Auth placeholder |

### v3.1 Business Intelligence Pages
| Page | Stat Cards | Data Source | Hardcoded Values | Status |
|------|------------|-------------|------------------|--------|
| price-intelligence.html | 4 stat chips + 2 savings summaries | `/api/price-intelligence/*` | None | OK |
| business-planning.html | Target cards | `/api/business-plans/*` | None | OK |
| employees.html | 1 total + calculator preview | `/api/employees`, `/api/burden-classes` | None | OK |

### Other Pages
| Page | Stat Cards | Data Source | Status |
|------|------------|-------------|--------|
| selections.html | 3 summary values | `/api/selections/job/{id}/summary` | OK |
| catalog.html | Variance display in selection modal | From allowance/selection data | OK |
| estimates.html | 5 stat chips | `/api/estimates/stats` | OK |
| bids.html | 5 stat chips | `/api/bids/stats` | OK |
| leads.html | 5 stat chips | `/api/leads/stats` | OK |
| contracts.html | 3 stat chips | `/api/contracts/stats` | OK |
| companies.html | 2 stat chips | `/api/companies/stats` | OK |
| contacts.html | 2 stat chips | `/api/contacts/stats` | OK |
| permits.html | 3 stat chips | `/api/permits/stats` | OK |
| schedule.html | Agenda stats | `/api/schedules/*` | OK |
| photos.html | 1 total photos | `/api/photos/stats` | OK |
| messaging.html | Stats from API | `/api/messages/stats` | currentUser='Jake Ross' |
| notifications.html | Stats from API | `/api/notifications/*` | currentUser='Jake Ross' |
| compliance.html | 4 stat values | `/api/compliance/stats` | OK |
| correspondence.html | 4 stat values | `/api/correspondence/stats` | OK |
| meetings.html | 4 stat values | `/api/meetings/stats` | OK |
| crew-schedule.html | 3 stat chips | `/api/crew-schedule/stats` | OK |

---

## Hardcoded User Values (Jake Ross) - Full Inventory

### Critical Files (Need Auth Integration)

**Constants/Global Variables:**
| File | Line | Code | Priority |
|------|------|------|----------|
| public/js/inspections.js | 24 | `const CURRENT_USER = 'Jake Ross';` | High |
| public/js/punch-lists.js | 23 | `const CURRENT_USER = 'Jake Ross';` | High |
| public/js/messaging.js | 10 | `let currentUser = 'Jake Ross';` | High |
| public/js/notifications.js | 9 | `let currentUser = 'Jake Ross';` | High |

**API Calls with Hardcoded User:**

| File | Line | Context | Plan |
|------|------|---------|------|
| public/js/app.js | 159 | `performed_by: 'Jake Ross'` in bulk approve | 103-02 |
| public/js/app.js | 190 | `performed_by: 'Jake Ross'` in quick approve | 103-02 |
| public/js/app.js | 1031 | `approved_by: 'Jake Ross'` in approve | 103-02 |
| public/js/modals.js | 3753 | `performed_by: 'Jake Ross'` in remove from draw | 103-02 |
| public/js/modals.js | 3901 | `closed_out_by: 'Jake Ross'` in close-out | 103-02 |
| public/js/modals.js | 5672 | `performed_by: 'User'` with TODO | 103-02 |
| public/js/co-app.js | 903 | `approved_by: 'Jake Ross'` | 103-03 |
| public/js/co-app.js | 923 | `rejected_by: 'Jake Ross'` | 103-03 |
| public/js/co-app.js | 961 | `bypassed_by: 'Jake Ross'` | 103-03 |
| public/js/daily-logs.js | 1186 | `created_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1187 | `updated_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1218 | `completed_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1251 | `deleted_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1553 | `reopened_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1680 | `uploaded_by: 'Jake Ross'` | 103-04 |
| public/js/daily-logs.js | 1839 | `deleted_by: 'Jake Ross'` | 103-04 |
| public/js/expenses.js | 436 | `created_by: 'Jake Ross'` | 103-05 |
| public/js/expenses.js | 502 | `deleted_by: 'Jake Ross'` | 103-05 |
| public/js/expenses.js | 664 | `created_by: 'Jake Ross'` | 103-05 |
| public/js/financial-periods.js | 277 | `created_by: 'Jake Ross'` | 103-05 |
| public/js/financial-periods.js | 339 | `closed_by: 'Jake Ross'` | 103-05 |
| public/js/financial-periods.js | 368 | `reopened_by: 'Jake Ross'` | 103-05 |
| public/js/po-modals.js | 1425 | `created_by: 'Jake Ross'` | 103-03 |
| public/js/selections.js | 748 | `changed_by: 'Jake Ross'` | 103-04 |
| public/js/selections.js | 894 | `created_by: 'Jake Ross'` | 103-04 |
| public/js/catalog.js | 1020 | `created_by: 'Jake Ross'` | 103-04 |
| public/js/rfis.js | 199, 218, 244 | RFI submitted_by default | 103-04 |
| public/js/rfis.js | 408, 433 | Response responded_by | 103-04 |
| public/js/submittals.js | 209, 416, 483, 501 | Submittal forms | 103-04 |
| public/js/tasks.js | 299, 496, 736, 761 | Task created_by, comments | 103-04 |
| public/js/warranties.js | 533 | `created_by: 'Jake Ross'` | 103-04 |

**HTML Form Defaults:**
| File | Line | Context |
|------|------|---------|
| public/catalog.html | 21 | User info display |
| public/selections.html | 154 | User info display |
| public/rfis.html | 173 | RFI submitted by input default |
| public/rfis.html | 331 | Response by input default |
| public/submittals.html | 191 | Submitted by input default |
| public/submittals.html | 364 | Reviewed by input default |
| public/tasks.html | 89 | Assignee dropdown option |
| public/tasks.html | 206 | Assigned to placeholder |
| public/tasks.html | 221 | Created by default |
| public/lien-releases.html | 512 | uploaded_by in form submit |
| public/messaging.html | 124 | Participants placeholder |

---

## Data Integrity Verification

### Budget Page Deep Dive

The budget page was specifically noted in the user request. Analysis shows:

1. **Base Contract** (`#summaryBudget`):
   - Source: `data.job?.contract_amount` (line 651 in budgets.html)
   - Loaded from: `/api/jobs/{id}/budget` endpoint
   - Status: **OK - correctly loads from database**

2. **Current Contract** (`#summaryTotalContract`):
   - Calculation: `baseContract + changeOrderTotal` (line 653)
   - Change orders from: `data.totals.changeOrderTotal`
   - Status: **OK - correctly calculated**

3. **Budget Line Items**:
   - Loaded from: `data.lines` array in budget API response
   - Grouped by category and rendered in table
   - Status: **OK - no hardcoded values**

4. **Variance Calculations**:
   - Closed variance: Sum of `(budgeted - committed)` for closed lines
   - Open overages: Sum of overages on open lines
   - Status: **OK - calculated from line item data**

### Dashboard Stats Verification

1. **Pending Invoices**: Loaded from `stats.invoices?.needs_approval?.count`
2. **Approved Amount**: Loaded from `stats.invoices?.approved?.amount`
3. **Open POs**: Loaded from `posStats.total_count`
4. **Expiring Vendors**: Loaded from `expiring.length`

All dashboard values are properly fetched from API endpoints.

---

## Recommendations

### Immediate (Phase 103)

1. **Plan 103-02: Invoice System User References**
   - Files: app.js, modals.js
   - Replace hardcoded 'Jake Ross' with `window.currentUser` pattern
   - Add fallback for when auth not available

2. **Plan 103-03: PO/Change Order User References**
   - Files: co-app.js, po-modals.js
   - Implement consistent user reference pattern

3. **Plan 103-04: Operational Module User References**
   - Files: daily-logs.js, selections.js, catalog.js, rfis.js, submittals.js, tasks.js, warranties.js
   - Large scope - consider grouping by similar patterns

4. **Plan 103-05: Financial Module User References**
   - Files: expenses.js, financial-periods.js
   - Implement consistent pattern

5. **Plan 103-06: Establish User Context System**
   - Create `getCurrentUser()` utility function
   - Set `window.currentUser` from auth context (or default to 'User' for now)
   - Update all constants to use the utility

### Future (Auth Integration)

When authentication is implemented:
1. Replace all `'Jake Ross'` references with authenticated user
2. Update `window.currentUser` to come from auth context
3. Consider storing user preference for display name
4. Audit log entries should use authenticated user ID, not name

---

## Appendix: API Endpoints and Data Sources

### Stat Card Endpoints
| Page | Endpoint | Returns |
|------|----------|---------|
| dashboard.html | `/api/dashboard/stats` | Invoice counts and amounts by status |
| dashboard.html | `/api/purchase-orders/stats` | PO counts |
| dashboard.html | `/api/vendors/expiring` | Expiring vendor list |
| budgets.html | `/api/jobs/{id}/budget` | Budget lines, totals, job data |
| draws.html | `/api/draws/{id}` | Draw with G702/G703 data |
| profitability.html | `/api/profitability/jobs` | Job profitability metrics |
| wip.html | `/api/wip` | Work in progress by job |
| pnl.html | `/api/pnl/summary` | P&L summary data |
| cash-flow.html | `/api/cash-flow/summary` | AR/AP summary |
| overhead.html | `/api/overhead` | Overhead rate calculations |

### formatMoney/formatCurrency Usage
Found in 37 files - indicates consistent money formatting across the application. All currency values go through these functions before display.

---

## Conclusion

The application has **no critical data integrity issues** with stat cards or summary values. All displayed values properly load from API endpoints and are calculated from database data.

The primary finding is **54 hardcoded user references** (`'Jake Ross'`) that are placeholders for future authentication integration. These do not affect data display but should be systematically replaced with a proper user context system.

**Risk Assessment:**
- Data Integrity: LOW RISK (all values from API)
- User Attribution: MEDIUM RISK (hardcoded values could misattribute actions)
- Recommended Action: Implement user context system in Phase 103-06
