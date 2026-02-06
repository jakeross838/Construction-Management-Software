# RFIs (Requests for Information)

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Request for Information management for construction projects. Tracks questions, responses, and resolution for design clarifications and field issues.

## Key Files

### Frontend
- `client/src/pages/RFIs.tsx` - Main RFIs page
- `client/src/components/rfis/` - Components
  - `RFIFormDialog.tsx` - Create/edit form
  - `RFIDetailDialog.tsx` - Detail view

### Backend
- `server/routes/rfis.js` - RFI API (372 lines)

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_rfis` | RFI records |
| `v2_rfi_responses` | Responses to RFIs |
| `v2_rfi_attachments` | Question/response documents |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rfis/` | List with filters |
| GET | `/api/rfis/stats` | Statistics |
| GET | `/api/rfis/:id` | Single RFI with responses |
| POST | `/api/rfis/` | Create RFI |
| PATCH | `/api/rfis/:id` | Update RFI |
| POST | `/api/rfis/:id/respond` | Add response |
| POST | `/api/rfis/:id/close` | Close RFI |
| POST | `/api/rfis/:id/reopen` | Reopen RFI |
| POST | `/api/rfis/:id/attachments` | Add attachment |

## Status Values
- `open` - Awaiting response
- `pending` - Response in progress
- `answered` - Response provided
- `closed` - Resolved

## Priority Levels
- `high` - Urgent, blocking work
- `normal` - Standard priority
- `low` - Non-urgent clarification

## Key Features
- RFI number auto-generation
- Response tracking
- Due date management
- Reference drawing/spec tracking
- Attachment management
- Status auto-update on response

## Related Features
- [Submittals](../submittals/) - Related submittals
- [Plans](../plans/) - Referenced drawings
- [Jobs](../jobs/) - RFIs belong to jobs
