# Proposals

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Project proposal and quote generation. Creates professional proposals from estimates with customizable templates and client presentation features.

## Key Files

### Frontend
- `client/src/pages/Proposals.tsx` - Main proposals page
- `client/src/components/proposals/` - Components

### Backend
- `server/routes/proposals.js` - Proposals API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_proposals` | Proposal records |
| `v2_proposal_sections` | Content sections |
| `v2_proposal_templates` | Reusable templates |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals` | List proposals |
| POST | `/api/proposals` | Create proposal |
| GET | `/api/proposals/:id` | Get proposal details |
| PATCH | `/api/proposals/:id` | Update proposal |
| DELETE | `/api/proposals/:id` | Delete proposal |
| POST | `/api/proposals/:id/send` | Send to client |
| GET | `/api/proposals/:id/pdf` | Generate PDF |
| GET | `/api/proposals/templates` | List templates |

## Status Values
- `draft` - In preparation
- `sent` - Sent to client
- `viewed` - Client viewed
- `accepted` - Client accepted
- `declined` - Client declined
- `expired` - Past expiration date

## Key Features
- Template-based creation
- Estimate integration
- PDF generation
- Client portal viewing
- Acceptance tracking
- Expiration dates
- Version history

## Related Features
- [Estimates](../estimates/) - Pricing source
- [Leads](../leads/) - Lead proposals
- [Contracts](../contracts/) - Proposal to contract
