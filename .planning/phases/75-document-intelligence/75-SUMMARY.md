# Phase 75: Document Intelligence - Summary

**Completed:** 2026-01-20
**Migration:** 088

---

## What Was Built

### Database (migration-088-document-intelligence.sql)

1. **v2_document_extractions table**:
   - Tracks all AI extractions
   - Source document reference
   - Document type classification
   - Confidence score
   - Extracted data as JSON
   - Processing status: pending, complete, failed, needs_review
   - Routing status tracking

2. **v2_extraction_routes table**:
   - Records where extracted data was routed
   - Destination type: invoice, catalog, price_intel, schedule, knowledge, daily_log, scorecard
   - Destination record ID
   - Route status: auto_routed, pending_approval, approved, rejected
   - User who approved/rejected

3. **v2_extraction_templates table**:
   - Document type extraction rules
   - Field mappings per document type
   - Required vs optional fields
   - Validation rules

---

## Document Types Supported

| Type | Extracts | Routes To |
|------|----------|-----------|
| Invoice | vendor, amounts, line items, dates | Invoices, Price Intel |
| Quote/Proposal | vendor, line items, pricing, terms | Catalog, Price Intel |
| Spec Sheet | product details, dimensions, features | Catalog, Knowledge |
| Delivery Receipt | items, quantities, dates | Daily Log, Schedule |
| Warranty Doc | terms, duration, coverage | Knowledge, Catalog |
| Change Order | scope, amounts, approvals | Change Orders |

---

## API Endpoints

### Extraction Management
- `GET /api/documents/extractions` - List extractions
- `GET /api/documents/extractions/:id` - Get extraction detail
- `POST /api/documents/extractions/:id/approve` - Approve routing
- `POST /api/documents/extractions/:id/reject` - Reject with reason
- `POST /api/documents/extractions/:id/edit` - Modify before routing

### Processing
- `POST /api/documents/process` - Process uploaded document
- `POST /api/documents/reprocess/:id` - Reprocess with different template

### Templates
- `GET /api/documents/templates` - List extraction templates
- `POST /api/documents/templates` - Create custom template

---

## Processing Pipeline

### 1. Document Upload
- Accept PDF, image, or document file
- Store in Supabase storage
- Create extraction record

### 2. Classification
- AI determines document type
- Select appropriate extraction template
- Set confidence threshold

### 3. Extraction
- Apply template field mappings
- Extract all relevant data
- Calculate confidence per field

### 4. Validation
- Check required fields present
- Validate against existing data (vendor match, etc.)
- Flag anomalies for review

### 5. Routing
- Determine destination systems
- Auto-route if high confidence
- Queue for review if needed

### 6. Confirmation
- User reviews pending routes
- Approve, edit, or reject
- Data committed to destinations

---

## Integration Points

### To Catalog
- New products with extracted specs
- Pricing updates to existing items
- Labor estimates from quotes

### To Price Intelligence
- Vendor pricing captured
- Historical price tracking
- Price comparison data

### To Schedule
- Lead times from quotes
- Delivery dates from receipts
- Duration data from proposals

### To Knowledge Base
- Warranty terms
- Installation requirements
- Product warnings

### To Daily Logs
- Delivery records
- Material receipts
- Inspection results

---

## Notes

Document Intelligence (Phase 75) was largely consolidated into the AI Document Intelligence Hub (Phase 70.1). This phase focuses on the extraction tracking and routing infrastructure, while 70.1 handles the UI and processing.

Key distinction:
- Phase 70.1: User-facing upload and processing UI
- Phase 75: Backend extraction tracking and multi-destination routing
