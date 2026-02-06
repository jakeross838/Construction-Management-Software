# Warranties

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Warranty tracking and management for completed projects. Tracks manufacturer and contractor warranties with expiration alerts and claim management.

## Key Files

### Frontend
- `client/src/pages/Warranties.tsx` - Warranties page
- `client/src/components/warranties/` - Components

### Backend
- `server/routes/warranties.js` - Warranties API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_warranties` | Warranty records |
| `v2_warranty_claims` | Warranty claims |
| `v2_warranty_documents` | Documentation |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/warranties` | List warranties |
| POST | `/api/warranties` | Create warranty |
| GET | `/api/warranties/:id` | Get warranty details |
| PATCH | `/api/warranties/:id` | Update warranty |
| DELETE | `/api/warranties/:id` | Delete warranty |
| POST | `/api/warranties/:id/claim` | File claim |
| GET | `/api/warranties/expiring` | Expiring soon |

## Warranty Types
- `manufacturer` - Manufacturer warranty
- `contractor` - Workmanship warranty
- `extended` - Extended warranty
- `home` - Builder home warranty

## Status Values
- `active` - Currently active
- `expiring_soon` - Within 90 days
- `expired` - Past expiration
- `claimed` - Claim filed

## Key Features
- Warranty tracking
- Expiration alerts
- Claim management
- Document storage
- Item categorization
- Coverage details
- Homeowner delivery

## Related Features
- [Final Docs](../final-docs/) - Closeout docs
- [Jobs](../jobs/) - Project warranties
- [Selections](../selections/) - Product warranties
