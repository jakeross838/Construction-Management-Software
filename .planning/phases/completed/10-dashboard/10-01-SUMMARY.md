# Plan 10-01 Summary: Dashboard Alerts and Activity

## Execution
- **Started**: 2026-01-17
- **Completed**: 2026-01-17
- **Status**: SUCCESS

## Changes Made

### Task 1: Alerts API Endpoint
**File**: `server/routes/dashboard.js`

Added `/api/dashboard/alerts` endpoint that aggregates actionable items:
- **Upcoming Inspections**: Scheduled inspections in next 7 days
- **Budget Overruns**: Budget lines where billed > budgeted
- **Pending Approvals**: Invoices needing approval + POs pending approval
- **Open Punch Items**: Punch items with status 'open' or 'in_progress'
- **Overdue Inspections**: Past scheduled_date with status still 'scheduled'

Response structure:
```json
{
  "inspections": { "count": N, "items": [...] },
  "budgetOverruns": { "count": N, "items": [...] },
  "pendingApprovals": { "invoices": N, "pos": M },
  "punchItems": { "count": N, "items": [...] },
  "overdueInspections": { "count": N, "items": [...] }
}
```

### Task 2: Alert Cards UI
**File**: `public/dashboard.html`

Replaced "Action Items" section with "Needs Attention" alert cards:
- Responsive grid layout (auto-fit, minmax 280px)
- Color-coded severity: info (blue), warning (orange), danger (red)
- Clickable cards linking to relevant pages
- Shows count and label for each alert type
- Empty state when no items need attention

Alert card types:
- Upcoming Inspections (info) → inspections.html?filter=scheduled
- Budget Overruns (danger) → budgets.html
- Pending Approvals (warning) → index.html?status=needs_approval
- Open Punch Items (warning) → punch-lists.html
- Overdue Inspections (danger) → inspections.html?filter=overdue

### Task 3: Activity Feed Enhancement
**Files**: `server/routes/dashboard.js`, `public/dashboard.html`

Added `/api/dashboard/activity` endpoint that aggregates recent activity:
- Recent invoices (with vendor name, amount, status)
- Recent PO activity (from v2_po_activity table)
- Recent inspections with results

Frontend updated to:
- Use new activity endpoint
- Show colored dots by activity type (invoice=blue, po=green, inspection=purple)
- Display activity icons and formatted timestamps

## Verification
- [x] `/api/dashboard/alerts` returns all alert categories
- [x] `/api/dashboard/activity` returns mixed activity from multiple entities
- [x] Dashboard displays alert cards with correct counts
- [x] Alert cards link to relevant pages
- [x] Activity feed shows diverse activity types
- [x] No console errors on API calls

## Test Results
```bash
# Alerts endpoint
$ curl http://localhost:3001/api/dashboard/alerts
{"inspections":{"count":0,"items":[]},"budgetOverruns":{"count":1,...},"pendingApprovals":{"invoices":0,"pos":7},...}

# Activity endpoint
$ curl http://localhost:3001/api/dashboard/activity?limit=5
[{"type":"po","icon":"📋","text":"PO PO-TEST-002: deleted",...},{"type":"invoice",...}]
```

## Key Decisions
- Used client-side filtering for budget overruns (Supabase doesn't support column comparison in WHERE)
- Activity feed combines multiple entity types, sorted by timestamp
- Alert cards use semantic colors matching the app's design system
