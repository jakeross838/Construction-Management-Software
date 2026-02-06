# Leads

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Sales pipeline management for construction projects. Tracks potential clients from initial contact through contract signing with Kanban board visualization.

## Key Files

### Frontend
- `client/src/pages/Leads.tsx` - Main leads page
- `client/src/components/leads/` - Components

### Backend
- `server/routes/leads.js` - Leads API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_leads` | Lead records |
| `v2_lead_sources` | Lead source tracking |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List with filters |
| POST | `/api/leads` | Create lead |
| GET | `/api/leads/:id` | Get lead details |
| PATCH | `/api/leads/:id` | Update lead |
| DELETE | `/api/leads/:id` | Delete lead |
| POST | `/api/leads/import` | Bulk import |
| GET | `/api/leads/stats` | Pipeline statistics |

## Pipeline Stages
- `new` - New inquiry
- `contacted` - Initial contact made
- `qualified` - Qualified opportunity
- `proposal` - Proposal sent
- `negotiation` - In negotiation
- `won` - Contract signed
- `lost` - Lost opportunity

## Key Features
- Kanban board visualization
- Lead scoring
- Pipeline stage tracking
- Geographic mapping
- Contract builder integration
- Import/export
- Analytics dashboard

## Related Features
- [Contracts](../contracts/) - Convert to contract
- [Estimates](../estimates/) - Create estimates
- [Jobs](../jobs/) - Convert to job
