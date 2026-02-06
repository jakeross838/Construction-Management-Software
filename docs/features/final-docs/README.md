# Final Docs (Project Closeout)

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Project closeout documentation management. Tracks required closeout deliverables including as-builts, warranties, O&M manuals, and final lien releases.

## Key Files

### Frontend
- `client/src/pages/FinalDocs.tsx` - Main final docs page
- `client/src/components/final-docs/` - Components

### Backend
- `server/routes/closeout.js` - Closeout API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_closeout_items` | Closeout checklist items |
| `v2_closeout_documents` | Final documents |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/closeout/:jobId` | Get closeout status |
| GET | `/api/closeout/:jobId/items` | List closeout items |
| PATCH | `/api/closeout/:jobId/items/:id` | Update item status |
| POST | `/api/closeout/:jobId/documents` | Upload document |
| GET | `/api/closeout/:jobId/checklist` | Standard checklist |

## Document Categories
- `as_built` - As-built drawings
- `warranty` - Warranty documents
- `om_manual` - O&M manuals
- `certificate` - Certificates (occupancy, etc.)
- `lien_release` - Final lien waivers
- `permit_final` - Final permit inspections
- `punch_list` - Completed punch list
- `photo_final` - Final photos

## Status Values
- `required` - Document required
- `in_progress` - Being gathered
- `submitted` - Submitted
- `accepted` - Accepted by owner
- `not_applicable` - N/A for project

## Key Features
- Closeout checklist
- Document tracking
- Status dashboard
- Owner delivery tracking
- Template checklists
- Completion percentage

## Related Features
- [Warranties](../warranties/) - Warranty tracking
- [Lien Releases](../lien-releases/) - Final waivers
- [Punch Lists](../punch-lists/) - Final punch
