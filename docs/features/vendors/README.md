# Vendors

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Trade partner and subcontractor management. Tracks vendor information, insurance compliance, W9 status, and contact details.

## Key Files

### Frontend
- `client/src/pages/Vendors.tsx` - Main vendors page
- `client/src/components/vendors/` - Components

### Backend
- `server/routes/vendors.js` - Vendors API

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_vendors` | Vendor records |
| `v2_vendor_documents` | Insurance, W9 documents |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vendors` | List with filters |
| POST | `/api/vendors` | Create vendor |
| GET | `/api/vendors/:id` | Get vendor details |
| PATCH | `/api/vendors/:id` | Update vendor |
| DELETE | `/api/vendors/:id` | Delete vendor |
| POST | `/api/vendors/import` | Bulk CSV import |
| GET | `/api/vendors/duplicates` | Potential duplicates |

## Status Values
- `active` - Current vendor
- `expiring` - Insurance expiring soon
- `expired` - Insurance expired
- `inactive` - Not currently used

## Key Features
- Contact information storage
- Insurance expiration tracking
- W9 document status
- Trade categorization
- Bulk import/export
- Duplicate detection

## Related Features
- [Purchase Orders](../purchase-orders/) - POs to vendors
- [Invoices](../invoices/) - Invoices from vendors
- [Bids](../bids/) - Bid invitations
