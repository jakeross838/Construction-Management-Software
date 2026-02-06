# Cost Codes

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction cost code management following CSI divisions. Provides standardized cost categorization for budgets, estimates, and financial tracking.

## Key Files

### Frontend
- `client/src/pages/CostCodes.tsx` - Cost codes management
- `client/src/components/cost-codes/` - Components

### Backend
- `server/routes/cost-codes.js` - Cost codes API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_cost_codes` | Cost code definitions |
| `v2_cost_code_divisions` | CSI divisions |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cost-codes` | List cost codes |
| POST | `/api/cost-codes` | Create cost code |
| GET | `/api/cost-codes/:id` | Get cost code |
| PATCH | `/api/cost-codes/:id` | Update cost code |
| DELETE | `/api/cost-codes/:id` | Delete cost code |
| GET | `/api/cost-codes/divisions` | CSI divisions |
| POST | `/api/cost-codes/import` | Import codes |

## CSI Divisions
- 01 - General Requirements
- 02 - Existing Conditions
- 03 - Concrete
- 04 - Masonry
- 05 - Metals
- 06 - Wood, Plastics, Composites
- 07 - Thermal & Moisture Protection
- 08 - Openings
- 09 - Finishes
- And more...

## Key Features
- CSI MasterFormat alignment
- Custom code creation
- Division organization
- Code description
- Unit of measure
- Import/export
- Budget integration

## Related Features
- [Budget](../budget/) - Budget line items
- [Estimates](../estimates/) - Estimate coding
- [Invoices](../invoices/) - Invoice coding
