# Lien Releases

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Lien waiver and release tracking for construction projects. Manages conditional and unconditional waivers from subcontractors and suppliers, ensuring lien-free project closeout.

## Key Files

### Frontend
- `client/src/pages/LienReleases.tsx` - Main lien releases page
- `client/src/components/lien-releases/` - Components

### Backend
- `server/routes/lien-releases.js` - Lien releases API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_lien_releases` | Release records |
| `v2_lien_release_documents` | Signed documents |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lien-releases` | List releases |
| POST | `/api/lien-releases` | Create release request |
| GET | `/api/lien-releases/:id` | Get release details |
| PATCH | `/api/lien-releases/:id` | Update release |
| POST | `/api/lien-releases/:id/receive` | Mark as received |
| GET | `/api/lien-releases/stats` | Release statistics |

## Release Types
- `conditional_progress` - Conditional waiver for progress payment
- `unconditional_progress` - Unconditional waiver for progress
- `conditional_final` - Conditional final waiver
- `unconditional_final` - Unconditional final waiver

## Status Values
- `requested` - Waiver requested
- `sent` - Sent to vendor
- `received` - Signed copy received
- `verified` - Verified and filed

## Key Features
- Type-specific waiver forms
- Vendor tracking
- Payment association
- Document storage
- Closeout integration
- Status tracking

## Related Features
- [Vendors](../vendors/) - Vendor management
- [Purchase Orders](../purchase-orders/) - Payment tracking
- [Final Docs](../final-docs/) - Project closeout
