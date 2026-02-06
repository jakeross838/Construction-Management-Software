# Permits

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction permit tracking from application through approval. Manages permit types, fees, inspections, and document attachments for regulatory compliance.

## Key Files

### Frontend
- `client/src/pages/Permits.tsx` - Main permits page
- `client/src/components/permits/` - Components
  - `PermitFormDialog.tsx` - Create/edit form

### Backend
- `server/routes/permits.js` - Permit API (483 lines)

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_permits` | Permit records |
| `v2_permit_inspections` | Permit-related inspections |
| `v2_permit_documents` | Permit documents |
| `v2_permit_activity` | Audit trail |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/permits/` | List with filters |
| GET | `/api/permits/stats` | Statistics |
| POST | `/api/permits/` | Create permit |
| PATCH | `/api/permits/:id` | Update permit |
| POST | `/api/permits/:id/submit` | Submit permit |
| POST | `/api/permits/:id/approve` | Mark approved |
| POST | `/api/permits/:id/inspections` | Schedule inspection |
| POST | `/api/permits/inspections/:id/complete` | Complete inspection |
| POST | `/api/permits/:id/documents` | Upload document |

## Status Values
- `draft` - In preparation
- `submitted` - Submitted to jurisdiction
- `under_review` - Being reviewed
- `approved` - Approved
- `rejected` - Rejected
- `expired` - Permit expired
- `revoked` - Permit revoked

## Key Features
- Permit status tracking
- Inspection scheduling
- Document management
- Fee tracking
- Expiration monitoring
- Activity logging

## Related Features
- [Inspections](../inspections/) - Permit inspections
- [Jobs](../jobs/) - Permits belong to jobs
