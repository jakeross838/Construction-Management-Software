# Requirements: v1.1 Field Features

## Overview

Complete the three remaining placeholder features: Bids, Estimates, and Photos.

---

## Bids

### BID-01: Bid CRUD
**Priority:** v1
**Description:** Create, read, update, delete bid records linked to jobs and vendors.

### BID-02: Bid File Upload
**Priority:** v1
**Description:** Upload bid documents (PDF, images) to Supabase Storage with file preview.

### BID-03: Bid Status Workflow
**Priority:** v1
**Description:** Track bid status: received → under_review → accepted/rejected.

### BID-04: Bid Comparison View
**Priority:** v1
**Description:** Compare multiple bids for same scope side-by-side (vendor, amount, notes).

### BID-05: Convert Bid to PO
**Priority:** v1
**Description:** Convert accepted bid to Purchase Order with line items pre-populated.

---

## Estimates

### EST-01: Estimate CRUD
**Priority:** v1
**Description:** Create, read, update, delete estimates linked to jobs.

### EST-02: Estimate Line Items
**Priority:** v1
**Description:** Add line items by cost code with quantity, unit cost, total.

### EST-03: Import from Bids
**Priority:** v1
**Description:** Import accepted bid amounts as estimate line items.

### EST-04: Estimate Versions
**Priority:** v1
**Description:** Version control - create new version, view version history.

### EST-05: Convert to Budget
**Priority:** v1
**Description:** Convert approved estimate to job budget (v2_budget_lines).

### EST-06: Estimate vs Actuals
**Priority:** v2
**Description:** Compare estimate to actual costs across completed jobs.

---

## Photos

### PHO-01: Photo Upload
**Priority:** v1
**Description:** Upload photos to job with drag-and-drop, multi-select.

### PHO-02: Photo Metadata
**Priority:** v1
**Description:** Add caption, date, location/area, category (progress, issue, completion).

### PHO-03: Photo Gallery
**Priority:** v1
**Description:** Grid view with filters (job, date range, category), lightbox viewer.

### PHO-04: Link to Entities
**Priority:** v1
**Description:** Link photos to inspections, punch list items, daily logs.

### PHO-05: Timeline View
**Priority:** v2
**Description:** Chronological timeline showing project progress through photos.

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BID-01 | Phase 1 | Pending |
| BID-02 | Phase 1 | Pending |
| BID-03 | Phase 1 | Pending |
| BID-04 | Phase 1 | Pending |
| BID-05 | Phase 1 | Pending |
| EST-01 | Phase 2 | Pending |
| EST-02 | Phase 2 | Pending |
| EST-03 | Phase 2 | Pending |
| EST-04 | Phase 2 | Pending |
| EST-05 | Phase 2 | Pending |
| PHO-01 | Phase 3 | Pending |
| PHO-02 | Phase 3 | Pending |
| PHO-03 | Phase 3 | Pending |
| PHO-04 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0
