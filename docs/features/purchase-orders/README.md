# Purchase Orders

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Purchase order management for construction procurement. Tracks vendor commitments, line items by cost code, change orders, and invoice billing against PO amounts. Includes approval workflows and PO document generation.

## Key Files

### Frontend
- `client/src/pages/PurchaseOrders.tsx` - Main PO list page
- `client/src/components/purchase-orders/` - 10 components

### Backend
- `server/routes/purchase-orders.js` - PO API routes
- `server/matching/po-matcher.js` - Invoice-to-PO matching
- `server/ai/po-processor.js` - AI PO extraction

### Database Migrations
- `migration-001-po-and-enhanced-invoices.sql` - Base schema
- `migration-005-po-enhancements.sql` - Enhanced fields
- `migration-010-po-line-item-linking.sql` - Line item improvements
- `migration-015-po-line-item-cost-type.sql` - Cost type support
- `migration-016-po-titles.sql` - PO titles
- `migration-024-po-line-item-co.sql` - Change order line items
- `migration-133-po-extended-fields.sql` - Extended fields

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_purchase_orders` | Main PO records with amounts, status |
| `v2_po_line_items` | Line items with cost codes, amounts |
| `v2_po_attachments` | Attached documents |
| `v2_po_activity` | Audit log |

### Key Fields (v2_purchase_orders)
```sql
id, job_id, vendor_id, po_number, description, total_amount,
original_amount, change_order_total, status, status_detail,
approval_status, approved_at, approved_by, scope_of_work, notes
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/purchase-orders` | List with filters |
| GET | `/api/purchase-orders/:id` | Get with line items |
| POST | `/api/purchase-orders` | Create PO |
| PATCH | `/api/purchase-orders/:id` | Update PO |
| POST | `/api/purchase-orders/:id/approve` | Approve PO |
| GET | `/api/pos/stats` | PO statistics |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| POTable.tsx | Main PO data table |
| PODetailDialog.tsx | Fullscreen PO detail modal |
| PODetailPanel.tsx | Side panel detail view |
| POFormDialog.tsx | Create/edit PO form |
| POLineItemsEditor.tsx | Line item management |
| POEditableField.tsx | Inline editable fields |
| POStats.tsx | Summary statistics |
| POBulkActions.tsx | Bulk operations |
| POUploadDialog.tsx | PO document upload |
| SendPOEmailDialog.tsx | Email PO to vendor |

## PO Number Format
Format: `PO-{JobIdentifier}-{XXXX}`
Examples:
- `PO-Drummond501-0001`
- `PO-Crews8290-0043`

Job identifier derived from job name (Client + Street Number).

## Status Flow
```
Created → [pending]
              ↓
      Approved → [approved] / [rejected]
              ↓
       Active → [active]
              ↓
       Closed → [closed]
```

**PO Status Values:**
- `open` / `closed` / `cancelled` (status)
- `pending` / `approved` / `active` / `closed` / `cancelled` (status_detail)
- `pending` / `approved` / `rejected` (approval_status)

## Billing Tracking
PO line items track `invoiced_amount` against `amount`:
- Remaining = amount - invoiced_amount
- % Billed = invoiced_amount / amount * 100
- Shows on invoice approval stamp

## Current Limitations / TODO
- [ ] PO templates for common scopes
- [ ] Vendor portal for PO acknowledgment

## Related Features
- [Invoices](../invoices/) - Invoices billed against POs
- [Jobs](../jobs/) - POs belong to jobs
- [Budget](../budget/) - PO amounts as committed costs
