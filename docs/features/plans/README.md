# Plans

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction plan set management. Handles drawing sheets, revisions, and plan distribution with markup and annotation capabilities.

## Key Files

### Frontend
- `client/src/pages/Plans.tsx` - Main plans page
- `client/src/components/plans/` - Components

### Backend
- `server/routes/plan-sets.js` - Plan sets API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_plan_sets` | Plan set records |
| `v2_plan_sheets` | Individual sheets |
| `v2_plan_revisions` | Revision tracking |
| `v2_plan_markups` | Annotations/markups |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/plan-sets` | List plan sets |
| POST | `/api/plan-sets` | Create plan set |
| GET | `/api/plan-sets/:id` | Get plan set with sheets |
| PATCH | `/api/plan-sets/:id` | Update plan set |
| DELETE | `/api/plan-sets/:id` | Delete plan set |
| POST | `/api/plan-sets/:id/sheets` | Upload sheet |
| POST | `/api/plan-sets/:id/revision` | Create revision |

## Sheet Disciplines
- `architectural` - Architectural drawings
- `structural` - Structural drawings
- `mechanical` - HVAC/mechanical
- `electrical` - Electrical drawings
- `plumbing` - Plumbing drawings
- `civil` - Site/civil drawings
- `landscape` - Landscape drawings

## Key Features
- Plan set organization
- Sheet management
- Revision tracking
- Markup annotations
- Version comparison
- PDF viewing
- Distribution lists

## Related Features
- [Files](../files/) - Document storage
- [RFIs](../rfis/) - Plan clarifications
- [Submittals](../submittals/) - Material approvals
