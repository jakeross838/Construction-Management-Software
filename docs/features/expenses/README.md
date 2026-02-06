# Expenses

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Non-invoice expense tracking for overhead and operational costs. Tracks company expenses separate from job-specific costs with category assignment and period allocation.

## Key Files

### Frontend
- `client/src/pages/Expenses.tsx` - Main expenses page
- `client/src/components/expenses/` - Components

### Backend
- `server/routes/expenses.js` - Expenses API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_expenses` | Expense records |
| `v2_expense_categories` | Category definitions |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List expenses |
| POST | `/api/expenses` | Create expense |
| GET | `/api/expenses/:id` | Get expense details |
| PATCH | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/categories` | List categories |
| GET | `/api/expenses/stats/summary` | Period summary |

## Category Types
- `overhead` - General overhead
- `office` - Office expenses
- `equipment` - Equipment costs
- `vehicle` - Vehicle expenses
- `insurance` - Insurance premiums
- `other` - Miscellaneous

## Key Features
- Category-based organization
- Period assignment
- Date range filtering
- Receipt attachments
- Overhead type classification
- Summary statistics

## Related Features
- [Budget](../budget/) - Budget allocation
- [Profitability](../profitability/) - Cost impact
- [Reports](../reports/) - Expense reports
