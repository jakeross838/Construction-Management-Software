# Jobs

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Core entity representing construction projects. Jobs organize all financial and operational data - invoices, POs, draws, budget, schedule, and documents. Each job tracks a single construction project from pre-construction through closeout.

## Key Files

### Frontend
- `client/src/pages/Jobs.tsx` - Main jobs list page
- `client/src/pages/JobDetails.tsx` - Single job detail view
- `client/src/components/jobs/` - 11 components (6 main + 5 detail subfolder)

### Backend
- `server/routes/jobs.js` - Job API routes
- `server/services/standards.js` - Job naming conventions

### Database Migrations
- `migration-047-job-crud.sql` - Base CRUD operations
- `migration-035-job-specs.sql` - Job specifications
- `migration-077-job-milestones.sql` - Milestone tracking
- `migration-105-job-profitability.sql` - Profitability calculations
- `migration-176-job-fields-alignment.sql` - Field standardization

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_jobs` | Main job records |

### Key Fields (v2_jobs)
```sql
id, name, address, client_name, contract_amount,
status (active/completed/on_hold), created_at
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs with budget summary |
| GET | `/api/jobs/:id` | Get job details |
| POST | `/api/jobs` | Create new job |
| PATCH | `/api/jobs/:id` | Update job |
| GET | `/api/jobs/:id/budget` | Get budget with actuals |
| GET | `/api/dashboard/stats` | Dashboard metrics |

## Component Inventory

### Main Components
| Component | Purpose |
|-----------|---------|
| JobCard.tsx | Job card in grid view |
| JobDetail.tsx | Job detail container |
| JobFormDialog.tsx | Create/edit job form |
| JobsHeader.tsx | Page header with actions |
| JobSpecsFormDialog.tsx | Job specifications form |
| JobsStats.tsx | Summary statistics |

### Detail Subfolder (`/detail/`)
| Component | Purpose |
|-----------|---------|
| JobDetailHeader.tsx | Detail page header |
| JobOverview.tsx | Overview tab content |
| BudgetTracking.tsx | Budget tab content |
| DocumentsAndNotes.tsx | Documents tab content |
| TimeTracking.tsx | Time tracking tab |

## Job Identifier Convention
Derived from job name for PO numbers and file naming:
- `"Drummond-501 74th St"` → `Drummond501`
- `"Crews-8290 Manasota Key"` → `Crews8290`

Pattern: {Client}{StreetNumber}

## Job as Central Entity
Jobs are the organizing principle for all data:
```
v2_jobs
├── v2_invoices (job_id FK)
├── v2_purchase_orders (job_id FK)
├── v2_draws (job_id FK)
├── v2_budget_lines (job_id FK)
├── v2_estimates (job_id FK)
├── v2_daily_logs (job_id FK)
├── v2_schedule_items (job_id FK)
└── v2_photos (job_id FK)
```

## Status Values
- `active` - Currently under construction
- `completed` - Project finished
- `on_hold` - Paused/delayed

## Current Limitations / TODO
- [ ] Job templates for common project types
- [ ] Client portal integration per job

## Related Features
- [Budget](../budget/) - Job budget tracking
- [Invoices](../invoices/) - Job-specific invoices
- [Purchase Orders](../purchase-orders/) - Job POs
- [Draws](../draws/) - Job payment applications
- [Estimates](../estimates/) - Job estimates
