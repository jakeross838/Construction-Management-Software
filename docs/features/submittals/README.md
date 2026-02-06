# Submittals

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Construction submittal management for material and equipment approvals. Tracks submittal packages through review workflow with architect/engineer approvals.

## Key Files

### Frontend
- `client/src/pages/Submittals.tsx` - Main submittals page
- `client/src/components/submittals/` - Components

### Backend
- `server/routes/submittals.js` - Submittals API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_submittals` | Submittal records |
| `v2_submittal_items` | Individual items |
| `v2_submittal_reviews` | Review history |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submittals` | List submittals |
| POST | `/api/submittals` | Create submittal |
| GET | `/api/submittals/:id` | Get submittal details |
| PATCH | `/api/submittals/:id` | Update submittal |
| DELETE | `/api/submittals/:id` | Delete submittal |
| POST | `/api/submittals/:id/submit` | Submit for review |
| POST | `/api/submittals/:id/review` | Record review decision |

## Status Values
- `draft` - In preparation
- `submitted` - Sent for review
- `under_review` - Being reviewed
- `approved` - Approved
- `approved_as_noted` - Approved with notes
- `revise_resubmit` - Requires revision
- `rejected` - Rejected

## Key Features
- Submittal log management
- Specification section tracking
- Review workflow
- Approval stamping
- Resubmission tracking
- Due date management
- Document attachments

## Related Features
- [Plans](../plans/) - Plan references
- [Selections](../selections/) - Material selections
- [Vendors](../vendors/) - Vendor submittals
