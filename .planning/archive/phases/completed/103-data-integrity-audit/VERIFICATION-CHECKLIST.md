# Data Integrity Verification Checklist

Use this checklist when adding new features or after deployments to ensure data integrity.

## Quick Checks

### Budget Page
- [ ] Base Contract = job.contract_amount
- [ ] Current Contract = Base + sum(approved COs)
- [ ] Budget Total = sum(budget_lines.budgeted_amount)
- [ ] Variance = Budget - Projected (for each line)
- [ ] Integrity indicator shows "Verified" (green)

### Draws Page
- [ ] G702 Line 3 = Line 1 + Line 2
- [ ] G702 Line 6 = Line 4 - Line 5
- [ ] G703 row totals = sum of column values
- [ ] Integrity indicators show "Verified" for G702 and G703

### Dashboard
- [ ] Stat cards show "-" during loading
- [ ] Stat cards show actual counts after load
- [ ] No hardcoded numbers visible
- [ ] Pending Invoices matches needs_approval count
- [ ] Open POs matches actual open PO count

### Any Stat Card Page
- [ ] Count stats match list.length
- [ ] Filter changes update stats appropriately
- [ ] Empty state shows 0, not hardcoded values
- [ ] Stats update after CRUD operations

## Page-by-Page Verification Status

### Financial Pages
| Page | Data Integrity | Stat Cards | User Refs | Status |
|------|----------------|------------|-----------|--------|
| budgets.html | Verified + check | N/A | N/A | PASS |
| draws.html | Verified + check | N/A | N/A | PASS |
| profitability.html | API-driven | 5 cards | N/A | PASS |
| wip.html | API-driven | 6 cards | N/A | PASS |
| pnl.html | API-driven | 5 cards | N/A | PASS |
| cash-flow.html | API-driven | 6 cards | N/A | PASS |
| overhead.html | API-driven | 3 cards | N/A | PASS |
| expenses.html | API-driven | 5 cards | Deferred | PASS |
| timesheets.html | API-driven | 4 cards | Deferred | PASS |

### Dashboard & Overview Pages
| Page | Data Integrity | Stat Cards | User Refs | Status |
|------|----------------|------------|-----------|--------|
| dashboard.html | Verified | 4 cards | N/A | PASS |
| business-dashboard.html | API-driven | 5 cards | N/A | PASS |
| job-hub.html | API-driven | 10+ cards | N/A | PASS |
| employees.html | Verified | 4 cards | N/A | PASS |

### Operational Pages
| Page | Data Integrity | Stat Cards | User Refs | Status |
|------|----------------|------------|-----------|--------|
| inspections.html | API-driven | 4 cards | Deferred | PASS |
| punch-lists.html | API-driven | 5 cards | Deferred | PASS |
| daily-logs.html | Verified | 4 cards | Fixed | PASS |
| rfis.html | Verified | 4 cards | Fixed | PASS |
| submittals.html | Verified | 5 cards | Fixed | PASS |
| tasks.html | Verified | 5 cards | Fixed | PASS |
| closeout.html | API-driven | 5 cards | N/A | PASS |
| warranties.html | Verified | 5 cards | Fixed | PASS |
| schedule.html | Verified | 5 cards | N/A | PASS |

### Other Pages
| Page | Data Integrity | Stat Cards | User Refs | Status |
|------|----------------|------------|-----------|--------|
| selections.html | API-driven | 3 cards | Deferred | PASS |
| catalog.html | API-driven | N/A | Deferred | PASS |
| estimates.html | API-driven | 5 cards | N/A | PASS |
| bids.html | API-driven | 5 cards | N/A | PASS |
| leads.html | API-driven | 5 cards | N/A | PASS |
| contracts.html | API-driven | 3 cards | N/A | PASS |
| companies.html | API-driven | 2 cards | N/A | PASS |
| contacts.html | API-driven | 2 cards | N/A | PASS |
| permits.html | API-driven | 3 cards | N/A | PASS |
| photos.html | API-driven | 1 card | N/A | PASS |
| messaging.html | API-driven | N/A | Deferred | PASS |
| notifications.html | API-driven | N/A | Deferred | PASS |

## Adding New Features

When adding new stat cards:
1. Always fetch data from API
2. Calculate stats from response data
3. Show loading state initially
4. Handle errors gracefully (show "-" not "0")
5. Add integrity check if showing calculated values

## Common Patterns

### Good Pattern - Data from API
```javascript
const total = data.reduce((sum, item) => sum + item.amount, 0);
document.getElementById('stat').textContent = formatMoney(total);
```

### Bad Pattern - Hardcoded
```javascript
// DON'T DO THIS
document.getElementById('stat').textContent = '$50,000';
```

### Good Pattern - User Context
```javascript
// Use window.currentUser which will be set by auth
const user = window.currentUser || 'User';
body.created_by = user;
```

### Bad Pattern - Hardcoded User
```javascript
// DON'T DO THIS
body.created_by = 'Jake Ross';
```

## Integrity Check Functions

### Budget Page
The `verifyBudgetIntegrity()` function:
- Compares sum of line items to API totals
- Shows green "Verified" if match within $0.01
- Shows orange "Check totals" if mismatch

### Draws Page
The `verifyDrawIntegrity()` function:
- Validates G702 calculations (Line 3 = Line 1 + Line 2)
- Validates G703 totals match line item sums
- Shows indicators on both G702 and G703 sections

## Deployment Verification Steps

1. **Before deployment:**
   - Run through Quick Checks above
   - Verify no new hardcoded values introduced

2. **After deployment:**
   - Verify dashboard loads all 4 stat cards
   - Verify budget page shows integrity indicator
   - Verify draw page shows integrity indicators
   - Create/delete a record and verify stats update

3. **Regression check:**
   - If any stat shows unexpected value, check:
     - API endpoint returning correct data
     - JavaScript calculating from response (not hardcoded)
     - DOM element IDs match code

---
*Checklist created: 2026-01-21*
*Phase 103 Data Integrity Audit*
