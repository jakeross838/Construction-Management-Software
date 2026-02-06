# Photos

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Job progress photo documentation and management. Organizes site photos by category with metadata, thumbnails, and gallery views.

## Key Files

### Frontend
- `client/src/pages/Photos.tsx` - Main photos page
- `client/src/components/photos/` - Components

### Backend
- `server/routes/photos.js` - Photos API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_photos` | Photo records |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/photos` | List with filters |
| POST | `/api/photos` | Upload photo |
| GET | `/api/photos/:id` | Get photo details |
| DELETE | `/api/photos/:id` | Delete photo |

## Photo Categories
- `progress` - Construction progress
- `issues` - Problems/defects
- `before` - Before conditions
- `after` - After conditions
- `safety` - Safety documentation
- `materials` - Material photos

## Key Features
- Job progress documentation
- Category tagging
- Thumbnail generation
- Photo metadata (location, date)
- Grid and list views
- Bulk upload support

## Related Features
- [Daily Logs](../daily-logs/) - Log photos
- [Punch Lists](../punch-lists/) - Deficiency photos
- [Jobs](../jobs/) - Photos belong to jobs
