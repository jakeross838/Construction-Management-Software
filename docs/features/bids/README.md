# Bids

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Bid package creation and subcontractor bid management. Organizes trade packages, tracks invitations, and compares submitted bids for award decisions.

## Key Files

### Frontend
- `client/src/pages/Bids.tsx` - Main bids page
- `client/src/components/bids/` - Components

### Backend
- `server/routes/bids.js` - Bids API
- `server/routes/bid-packages.js` - Bid packages API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_bids` | Bid package records |
| `v2_subcontractor_bids` | Vendor bid submissions |
| `v2_subcontractor_bid_documents` | Bid documents |
| `v2_bid_package_invites` | Invitation tracking |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bids` | List bid packages |
| POST | `/api/bids` | Create bid package |
| GET | `/api/bids/:id` | Get package with bids |
| PATCH | `/api/bids/:id` | Update package |
| POST | `/api/bids/:id/invite` | Send invitations |
| POST | `/api/bids/:id/submit` | Submit vendor bid |
| POST | `/api/bids/:id/award` | Award to vendor |
| GET | `/api/bids/stats` | Bid statistics |

## Package Status
- `draft` - In preparation
- `open` - Accepting bids
- `closed` - Bidding closed
- `awarded` - Awarded to vendor
- `cancelled` - Cancelled

## Key Features
- Bid package creation
- Subcontractor invitations
- Bid receipt tracking
- Bid comparison
- Trade categorization
- Due date management
- Award tracking

## Related Features
- [Vendors](../vendors/) - Invited vendors
- [Purchase Orders](../purchase-orders/) - Create PO from award
- [Estimates](../estimates/) - Estimate integration
