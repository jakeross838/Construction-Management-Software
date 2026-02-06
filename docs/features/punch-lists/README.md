# Punch Lists

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Pre-closeout deficiency tracking and resolution. Manages punch list items with photo annotations, vendor assignment, and verification workflow for construction project completion.

## Key Files

### Frontend
- `client/src/pages/PunchLists.tsx` - Main punch list page
- `client/src/components/punch-lists/` - Components

### Backend
- `server/routes/punch-lists.js` - Punch list API (938 lines)

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_punch_lists` | Punch list records |
| `v2_punch_list_items` | Individual items |
| `v2_punch_list_attachments` | Photos/documents |
| `v2_punch_list_photo_annotations` | Annotated photos |
| `v2_punch_list_activity` | Audit trail |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/punch-lists/` | List with filters |
| GET | `/api/punch-lists/stats` | Statistics |
| POST | `/api/punch-lists/` | Create punch list |
| POST | `/api/punch-lists/:id/items` | Add item |
| POST | `/api/punch-lists/items/:itemId/start` | Mark in progress |
| POST | `/api/punch-lists/items/:itemId/resolve` | Mark resolved |
| POST | `/api/punch-lists/items/:itemId/verify` | Verify completed |
| POST | `/api/punch-lists/items/:itemId/reject` | Reject item |
| POST | `/api/punch-lists/items/:itemId/annotate` | Save annotation |
| POST | `/api/punch-lists/:id/close` | Close list |
| GET | `/api/punch-lists/locations/scan/:qrCode` | Scan QR code |

## Item Status Flow
```
open → in_progress → resolved → verified (complete)
                            ↓
                          open (if rejected)
```

## Item Priority
- `high` - Critical, fix immediately
- `normal` - Standard priority
- `low` - Minor, fix when convenient

## Key Features
- Item status tracking with verification
- QR code scanning for locations
- Photo attachments (before/after)
- Photo annotation/markup
- Vendor assignment
- Priority management
- Automatic list status updates

## Related Features
- [Inspections](../inspections/) - Inspection deficiencies
- [Vendors](../vendors/) - Vendor assignment
- [Jobs](../jobs/) - Punch lists belong to jobs
