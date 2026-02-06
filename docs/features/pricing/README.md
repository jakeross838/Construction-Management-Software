# Pricing

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Pricing management and unit cost database. Maintains labor rates, material prices, and assemblies for estimating and budgeting.

## Key Files

### Frontend
- `client/src/pages/Pricing.tsx` - Pricing management
- `client/src/components/pricing/` - Components

### Backend
- `server/routes/historical-costs.js` - Historical pricing
- `server/routes/price-intelligence.js` - Price analytics

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_unit_prices` | Standard unit prices |
| `v2_labor_rates` | Labor rate definitions |
| `v2_material_prices` | Material pricing |
| `v2_price_history` | Historical prices |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/pricing/units` | List unit prices |
| POST | `/api/pricing/units` | Create unit price |
| PATCH | `/api/pricing/units/:id` | Update price |
| GET | `/api/pricing/labor` | Labor rates |
| GET | `/api/pricing/materials` | Material prices |
| GET | `/api/pricing/history` | Price history |
| GET | `/api/price-intelligence/trends` | Market trends |

## Price Categories
- **Labor Rates**: Hourly rates by trade
- **Material Prices**: Material unit costs
- **Equipment Rates**: Equipment rental/usage
- **Subcontractor Rates**: Sub pricing
- **Assemblies**: Combined pricing

## Key Features
- Unit price database
- Labor rate management
- Material cost tracking
- Price history
- Markup/margin settings
- Regional adjustments
- Import/export

## Related Features
- [Estimates](../estimates/) - Uses pricing
- [Budget](../budget/) - Budget pricing
- [Cost Codes](../cost-codes/) - Code association
