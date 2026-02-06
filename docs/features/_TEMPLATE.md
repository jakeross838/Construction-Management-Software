# [Feature Name]

## Status
Current state: [Active Development | Stable | Needs Work]
Last updated: YYYY-MM-DD

## Overview
Brief description of what this feature does in the construction management context.

## Key Files

### Frontend
- `client/src/pages/Feature.tsx` - Main page component
- `client/src/components/feature/` - Feature-specific components

### Backend
- `server/routes/feature.js` - API route handlers

### Database
- `database/migration-XXX-feature.sql` - Schema migrations

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_feature` | Main records |
| `v2_feature_items` | Related items |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/feature` | List all records |
| GET | `/api/feature/:id` | Get single record |
| POST | `/api/feature` | Create new record |
| PATCH | `/api/feature/:id` | Update record |
| DELETE | `/api/feature/:id` | Delete record |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| FeatureTable.tsx | Main data table |
| FeatureFormDialog.tsx | Create/edit form |
| FeatureDetailDialog.tsx | Detail view |

## Status Flow (if applicable)
```
status_1 → status_2 → status_3 → status_4
```

## Current Limitations / TODO
- [ ] Known issue or limitation
- [ ] Planned improvement

## Related Features
- [Related Feature](../related-feature/) - How it relates
