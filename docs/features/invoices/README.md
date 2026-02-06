# Invoices

## Status
Current state: **Stable**
Last updated: 2026-02-06

## Overview
Core financial document processing for construction invoices. Features AI-powered PDF extraction, vendor/job matching, cost code allocation, approval workflows, and PDF stamping. Supports multi-status workflow from receipt through payment.

## Key Files

### Frontend
- `client/src/pages/Invoices.tsx` - Main invoice list page
- `client/src/pages/InvoicesNew.tsx` - New invoice management UI
- `client/src/components/invoices/` - 13 components

### Backend
- `server/routes/invoices.js` - Invoice API routes
- `server/ai/processor.js` - AI invoice extraction
- `server/ai/ocr-processor.js` - OCR for scanned PDFs
- `server/documents/pdf-stamper.js` - PDF approval stamping

### Database Migrations
- `migration-001-po-and-enhanced-invoices.sql` - Base schema
- `migration-002-invoice-system-enhancements.sql` - Enhanced fields
- `migration-003-allocation-job-id.sql` - Allocation improvements
- `migration-025-split-invoices.sql` - Invoice splitting
- `migration-071-co-invoices.sql` - Change order invoices
- `migration-074-credit-invoices.sql` - Credit invoice support

## Database Tables

| Table | Purpose |
|-------|---------|
| `v2_invoices` | Main invoice records with AI data, status, approvals |
| `v2_invoice_allocations` | Cost code allocations per invoice |
| `v2_invoice_activity` | Audit log of all invoice actions |
| `v2_invoice_hashes` | Duplicate detection via content hashing |

### Key Fields (v2_invoices)
```sql
id, job_id, vendor_id, po_id, invoice_number, invoice_date, due_date,
amount, status, pdf_url, pdf_stamped_url, ai_processed, ai_confidence,
ai_extracted_data, needs_review, review_flags, approved_at, approved_by
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List with filters (status, job, vendor) |
| GET | `/api/invoices/:id` | Get invoice with allocations, activity |
| POST | `/api/invoices/process` | AI process uploaded PDF |
| PATCH | `/api/invoices/:id/approve` | Approve + stamp PDF |
| POST | `/api/invoices/:id/allocate` | Set cost code allocations |
| POST | `/api/invoices/:id/transition` | Change status |
| POST | `/api/invoices/:id/split` | Split into child invoices |
| GET | `/api/invoices/:id/family` | Get parent + children |

## Component Inventory

| Component | Purpose |
|-----------|---------|
| InvoiceDetailDialog.tsx | Full invoice detail modal |
| AllocationEditor.tsx | Cost code allocation interface |
| AIConfidenceBadge.tsx | Shows AI extraction confidence |
| AIMatchedEntityCard.tsx | Displays AI-matched job/vendor |
| BulkAddToDrawDialog.tsx | Add multiple invoices to draw |
| BulkInvoiceUploadDialog.tsx | Multi-file upload |
| CostCodeSuggestions.tsx | AI-suggested cost codes |
| InvoiceBulkActions.tsx | Bulk operations toolbar |
| InvoiceManualFormDialog.tsx | Manual invoice entry |
| PaymentStatusBadge.tsx | Payment status indicator |
| RecordPaymentDialog.tsx | Record payment modal |
| ReviewFlagsBadges.tsx | Shows review flags |

## Status Flow
```
Upload PDF → AI Processing → [received]
                                ↓
                        Review → [needs_approval]
                                ↓
                     PM Approves → [approved] → PDF Stamped
                                ↓
                    Add to Draw → [in_draw]
                                ↓
                   Client Pays → [paid] → Archived
```

**Valid Transitions:**
- received → needs_approval, denied
- needs_approval → approved, denied, received
- approved → in_draw, needs_approval
- in_draw → paid, approved
- paid → (terminal)

## PDF Stamp Format
When approved, stamp added to top-right corner:
```
┌──────────────────────────────────┐
│ APPROVED                         │
│ Date: 1/7/2026                   │
│ By: Jake Ross                    │
│ Job: Drummond-501 74th St        │
│ Amount: $17,760.00               │
│ --- Cost Codes ---               │
│ 06100 Rough Carpentry ($17,760)  │
│ --- Purchase Order ---           │
│ PO: PO-Drummond501-0001          │
│ PO Total: $25,000.00             │
│ Billed: $17,760.00 (71%)         │
│ Remaining: $7,240.00             │
└──────────────────────────────────┘
```

## Current Limitations / TODO
- [ ] Batch processing queue for large uploads
- [ ] Enhanced duplicate detection across vendors

## Related Features
- [Purchase Orders](../purchase-orders/) - PO matching and billing tracking
- [Draws](../draws/) - Invoices added to draw for payment
- [Budget](../budget/) - Allocations update budget actuals
