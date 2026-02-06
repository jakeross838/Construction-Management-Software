# Plan 21-01 Summary: Reports Backend API

## Status: COMPLETED

## What Was Built

Created a Reports Backend API with three financial summary endpoints for the Ross Built CMS v1.3 milestone.

### Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `server/routes/reports.js` | Created | New Express router with 3 report endpoints |
| `server/index.js` | Modified | Registered reports router at `/api/reports` |

### Endpoints Implemented

#### 1. Job Cost Report
**`GET /api/reports/job-cost/:jobId`**

Returns budget vs actual analysis by cost code for a specific job.

Query params:
- `startDate` (optional): Filter invoices from this date
- `endDate` (optional): Filter invoices to this date

Response structure:
```json
{
  "job": { "id": "uuid", "name": "Job Name" },
  "period": { "start": "2026-01-01", "end": "2026-01-31" },
  "summary": {
    "totalBudget": 500000,
    "totalCommitted": 450000,
    "totalActual": 420000,
    "totalVariance": 80000,
    "percentComplete": 84
  },
  "lines": [
    {
      "costCode": "03100",
      "description": "Concrete",
      "category": "Concrete",
      "budget": 50000,
      "committed": 45000,
      "actual": 42000,
      "variance": 8000,
      "variancePercent": 16,
      "status": "under"
    }
  ]
}
```

#### 2. Vendor Spend Report
**`GET /api/reports/vendor-spend`**

Returns spend totals grouped by vendor.

Query params:
- `jobId` (optional): Filter to specific job
- `startDate` (optional): Filter invoices from this date
- `endDate` (optional): Filter invoices to this date

Response structure:
```json
{
  "period": { "start": null, "end": null },
  "filters": { "jobId": null, "jobName": null },
  "summary": {
    "totalSpend": 125000,
    "vendorCount": 15,
    "invoiceCount": 45,
    "avgInvoiceAmount": 2777.78
  },
  "vendors": [
    {
      "vendorId": "uuid",
      "vendorName": "Florida Sunshine Carpentry",
      "invoiceCount": 12,
      "totalSpend": 45000,
      "avgInvoiceAmount": 3750,
      "lastInvoiceDate": "2026-01-15"
    }
  ]
}
```

#### 3. Category Spend Report
**`GET /api/reports/category-spend`**

Returns spend totals grouped by CSI MasterFormat division (first 2 digits of cost code).

Query params:
- `jobId` (optional): Filter to specific job
- `startDate` (optional): Filter invoices from this date
- `endDate` (optional): Filter invoices to this date

Response structure:
```json
{
  "period": { "start": null, "end": null },
  "filters": { "jobId": null, "jobName": null },
  "summary": {
    "totalSpend": 500000,
    "categoryCount": 8
  },
  "categories": [
    {
      "categoryCode": "03",
      "categoryName": "Concrete",
      "costCodeCount": 5,
      "totalSpend": 125000,
      "percentOfTotal": 25.0
    }
  ]
}
```

## Technical Implementation

### Data Sources
- **Budget**: `v2_budget_lines` table joined with `v2_cost_codes`
- **Committed**: `v2_po_line_items` joined with `v2_purchase_orders` (non-cancelled)
- **Actual**: `v2_invoice_allocations` joined with `v2_invoices` (status: approved, in_draw, paid)
- **Vendors**: `v2_vendors` table
- **Jobs**: `v2_jobs` table

### Patterns Used
- Express router with `asyncHandler` for error handling
- `AppError` for structured error responses
- Supabase client for database queries
- Date filtering via query parameters

### Status Calculation (Job Cost Report)
- `over`: actual > budget
- `near`: actual > 90% of budget
- `under`: actual <= 90% of budget

## Verification

- [x] `node -c server/routes/reports.js` - Syntax valid
- [x] `node -c server/index.js` - Syntax valid
- [x] Reports router exports correctly
- [x] All three endpoints defined with correct paths
- [x] Date filtering implemented for all endpoints
- [x] Job filtering implemented for vendor-spend and category-spend

## Next Steps

This backend API enables Phases 22-23 of v1.3:
- Phase 22: Excel export functionality for reports
- Phase 23: PDF export functionality for reports
