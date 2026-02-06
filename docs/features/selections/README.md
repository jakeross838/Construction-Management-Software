# Selections

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Material and product selection tracking for construction projects. Manages allowances, client choices, and budget variances for finishes and fixtures.

## Key Files

### Frontend
- `client/src/pages/Selections.tsx` - Main selections page
- `client/src/components/selections/` - Components

### Backend
- `server/routes/selections.js` - Selections API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_selections` | Selection records |
| `v2_selection_categories` | Category organization |
| `v2_selection_catalogs` | Product catalogs |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/selections` | List selections |
| POST | `/api/selections` | Create selection |
| GET | `/api/selections/:id` | Get selection details |
| PATCH | `/api/selections/:id` | Update selection |
| POST | `/api/selections/:id/approve` | Approve selection |
| GET | `/api/selections/categories` | List categories |
| GET | `/api/selections/catalogs` | Product catalogs |

## Status Values
- `pending` - Awaiting client decision
- `selected` - Client selected
- `approved` - Selection approved
- `ordered` - Product ordered
- `received` - Product received
- `installed` - Product installed

## Key Features
- Allowance vs actual tracking
- Client approval workflow
- Room/area assignment
- Product image gallery
- Budget variance calculation
- Vendor product linking
- Selection-driven estimation

## Related Features
- [Estimates](../estimates/) - Selection-driven estimates
- [Budget](../budget/) - Allowance tracking
- [Contracts](../contracts/) - Contract allowances
