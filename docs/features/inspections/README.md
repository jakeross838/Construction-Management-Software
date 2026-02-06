# Inspections

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Municipal and third-party inspection scheduling and tracking. Manages inspection types, results, deficiencies, and re-inspections for construction compliance.

## Key Files

### Frontend
- `client/src/pages/Inspections.tsx` - Main inspections page
- `client/src/components/inspections/` - Components
  - `InspectionFormDialog.tsx` - Create/edit form
  - `InspectionDetailDialog.tsx` - Detail view

### Backend
- `server/routes/inspections.js` - Inspection API (925 lines)

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_inspections` | Inspection records |
| `v2_inspection_deficiencies` | Failed inspection items |
| `v2_inspection_attachments` | Photos and documents |
| `v2_inspection_activity` | Audit trail |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inspections/` | List with filters |
| GET | `/api/inspections/stats` | Statistics |
| GET | `/api/inspections/upcoming` | Next 7 days |
| GET | `/api/inspections/types` | Inspection type list |
| POST | `/api/inspections/` | Create inspection |
| POST | `/api/inspections/:id/pass` | Mark passed |
| POST | `/api/inspections/:id/fail` | Mark failed with deficiencies |
| POST | `/api/inspections/:id/reschedule` | Reschedule |
| POST | `/api/inspections/:id/reinspect` | Create re-inspection |
| POST | `/api/inspections/:id/deficiencies` | Add deficiency |
| POST | `/api/inspections/deficiencies/:id/resolve` | Resolve deficiency |

## Inspection Types
- Foundation, Slab, Framing
- Electrical (Rough & Final)
- Plumbing (Rough & Final)
- HVAC (Rough & Final)
- Insulation, Drywall, Roofing
- Fire, Building Final
- Certificate of Occupancy
- Pool, Septic, Impact Fee

## Result Status
- `scheduled` - Not yet performed
- `passed` - Passed inspection
- `failed` - Failed with deficiencies
- `partial` - Partial pass
- `cancelled` - Cancelled
- `no_show` - Inspector didn't show

## Deficiency Severity
- `critical` - Must fix immediately
- `major` - Fix before next inspection
- `minor` - Fix before final

## Related Features
- [Permits](../permits/) - Permit inspections
- [Punch Lists](../punch-lists/) - Deficiency items
- [Jobs](../jobs/) - Inspections belong to jobs
