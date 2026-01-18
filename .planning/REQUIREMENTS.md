# Requirements: Ross Built CMS

## Overview

Comprehensive requirements for the construction management system with granular subtasks. Each feature area lists what exists, what's missing, and what needs enhancement.

**Legend:**
- [x] Implemented and working
- [ ] Not implemented / placeholder
- [~] Partially implemented / needs work

---

## 1. Foundation

### FND-01: Express Server
**Status:** Mostly Complete
- [x] Node.js/Express server with middleware
- [x] CORS, compression, JSON parsing
- [x] Route organization in `/server/routes/`
- [~] Error handling (basic, could use more consistency)
- [ ] Request validation middleware
- [ ] Rate limiting
- [ ] API versioning

### FND-02: Supabase Integration
**Status:** Complete
- [x] Database client configuration
- [x] Storage client for file uploads
- [x] Connection configuration
- [x] Service role key authentication

### FND-03: Migration System
**Status:** Complete
- [x] Automated SQL migrations with tracking table
- [x] `npm run migrate` commands
- [x] Migration status checking
- [x] 38+ migrations applied

### FND-04: Error Handling
**Status:** Partial
- [x] Basic AppError class
- [x] Error codes defined
- [~] Async handler wrapper (inconsistent usage)
- [ ] Centralized error logging
- [ ] Error reporting/monitoring integration
- [ ] User-friendly error messages

### FND-05: Real-time Sync
**Status:** Complete
- [x] SSE connections for live updates
- [x] Supabase realtime integration
- [x] Offline queue for failed operations
- [x] Connection status indicator

---

## 2. Jobs

### JOB-01: Job CRUD
**Status:** Partial
- [x] GET all jobs
- [x] GET single job
- [~] Create job (via Supabase direct, no route)
- [~] Update job (partial - specs only via PATCH)
- [ ] DELETE job (soft delete)
- [ ] Job archiving workflow

### JOB-02: Job Status
**Status:** Partial
- [x] Status field exists (active, completed, on_hold)
- [ ] Status transition validation
- [ ] Status history/audit trail
- [ ] Automatic status updates based on milestones

### JOB-03: Cost Code Management
**Status:** Complete
- [x] Master list of cost codes
- [x] Cost code categories
- [x] Cost code CRUD routes
- [x] Cost code picker component

### JOB-04: Job Profile Page
**Status:** Partial
- [x] Job profile HTML page exists
- [x] Job specs display and editing
- [x] AI spec extraction from plans
- [~] Related data tabs (invoices, POs, etc.)
- [ ] Job dashboard with metrics
- [ ] Job timeline/activity feed
- [ ] Job completion percentage

---

## 3. Vendors

### VND-01: Vendor CRUD
**Status:** Partial
- [x] GET all vendors
- [x] CREATE vendor
- [x] UPDATE vendor (PATCH)
- [x] Vendor details with stats
- [ ] DELETE vendor (soft delete)
- [ ] Vendor search/filter
- [ ] Vendor merge (for duplicates)

### VND-02: Vendor Documents
**Status:** Not Implemented
- [ ] Upload W-9 documents
- [ ] Store insurance certificates
- [ ] Track license/certification expiry
- [ ] Document expiration alerts
- [ ] Vendor compliance dashboard

### VND-03: Duplicate Detection
**Status:** Partial
- [~] AI-powered detection endpoint exists
- [ ] Automatic detection on vendor creation
- [ ] Merge wizard for duplicates
- [ ] Duplicate prevention rules

---

## 4. Invoices

### INV-01: Invoice Upload
**Status:** Complete
- [x] PDF upload to Supabase Storage
- [x] File validation
- [x] Standardized naming convention

### INV-02: AI Extraction
**Status:** Complete
- [x] Claude API extracts vendor, amount, date, line items
- [x] Confidence scoring
- [x] Auto-matching to jobs/vendors/POs

### INV-03: OCR Processing
**Status:** Complete
- [x] Claude Vision OCR for scanned PDFs
- [x] Auto-detection of scanned vs text PDFs
- [x] Image extraction from PDFs

### INV-04: Auto-Matching
**Status:** Complete
- [x] AI matches invoices to jobs
- [x] AI matches to vendors
- [x] AI matches to POs
- [x] Confidence scores displayed

### INV-05: Status Workflow
**Status:** Complete
- [x] received → needs_approval → approved → in_draw → paid
- [x] Status transition validation
- [x] Status history tracking

### INV-06: Allocations
**Status:** Complete
- [x] Split invoice amount across cost codes
- [x] Allocation validation
- [x] Budget impact calculation

### INV-07: PDF Stamping
**Status:** Complete
- [x] Approval stamp with job info
- [x] Cost code breakdown on stamp
- [x] PO info on stamp
- [x] Stamped PDF storage

### INV-08: Split Invoices
**Status:** Complete
- [x] Split one invoice into multiple children
- [x] Parent/child relationship tracking
- [x] Amount distribution

### INV-09: Credit Invoices
**Status:** Complete
- [x] Handle negative amounts
- [x] Proper draw calculations for credits

### INV-10: Duplicate Detection
**Status:** Complete
- [x] Hash-based detection
- [x] Warning on upload

### INV-11: Entity Locking
**Status:** Complete
- [x] 5-minute edit locks
- [x] Lock owner tracking
- [x] Lock release on save

### INV-12: Undo System
**Status:** Complete
- [x] 30-second undo window
- [x] Snapshot storage
- [x] Undo for status changes

---

## 5. Purchase Orders

### PO-01: PO CRUD
**Status:** Complete
- [x] Create PO linked to job/vendor
- [x] Update PO
- [x] Soft delete
- [x] List with filters

### PO-02: Line Items
**Status:** Complete
- [x] PO line items by cost code
- [x] Amount tracking
- [x] Invoiced amount tracking per line

### PO-03: PO Approval
**Status:** Complete
- [x] Approval workflow
- [x] Status tracking (pending, approved, rejected)
- [x] Approval timestamp/user

### PO-04: Change Orders
**Status:** Complete
- [x] Track change orders
- [x] CO line items
- [x] Original vs adjusted amount
- [x] CO billing in draws

### PO-05: Invoice Linking
**Status:** Complete
- [x] Link invoices to POs
- [x] Track billed vs total
- [x] Overbilling warnings

### PO-06: Attachments
**Status:** Complete
- [x] Attach documents to POs
- [x] File upload
- [x] Attachment listing

### PO-07: Activity Log
**Status:** Complete
- [x] Audit trail of all PO actions
- [x] Timestamp/user tracking

---

## 6. Draws (Pay Applications)

### DRW-01: Draw CRUD
**Status:** Complete
- [x] Create draws per job
- [x] Sequential draw numbering
- [x] Period end date tracking

### DRW-02: Add Invoices
**Status:** Complete
- [x] Add approved invoices to draws
- [x] Remove invoices from draws
- [x] Invoice status updates

### DRW-03: G702 Calculation
**Status:** Complete
- [x] Original contract sum
- [x] Change order tracking
- [x] Completed to date
- [x] Retainage calculation

### DRW-04: G703 Schedule
**Status:** Complete
- [x] Budget vs billings per cost code
- [x] Previous billings
- [x] Current billings
- [x] Balance remaining

### DRW-05: Draw Workflow
**Status:** Complete
- [x] draft → submitted → funded
- [x] Status timestamps

### DRW-06: Excel Export
**Status:** Complete
- [x] G702/G703 Excel export
- [x] Proper formatting

### DRW-07: PDF Export
**Status:** Complete
- [x] Draw summary PDF
- [x] Professional formatting

---

## 7. Budgets

### BUD-01: Budget Lines
**Status:** Complete
- [x] Budget amounts per job per cost code
- [x] CRUD operations

### BUD-02: Committed Tracking
**Status:** Complete
- [x] Track committed from POs
- [x] Automatic updates

### BUD-03: Billed Tracking
**Status:** Complete
- [x] Track billed from allocations
- [x] Draw integration

### BUD-04: Budget Page
**Status:** Partial
- [x] Budget page HTML exists
- [x] Budget data endpoints
- [~] Visual comparison display
- [ ] Budget variance alerts
- [ ] Budget forecasting
- [ ] What-if analysis

---

## 8. Daily Logs

### LOG-01: Daily Log CRUD
**Status:** Complete
- [x] Create daily logs per job
- [x] Date-based lookup
- [x] Duplicate prevention (one per job/date)
- [x] Soft delete

### LOG-02: Crew Tracking
**Status:** Complete
- [x] Track crews on site
- [x] Worker count per crew
- [x] Hours worked
- [x] Trade tracking
- [x] Schedule task linking
- [x] Completion percentage updates

### LOG-03: Weather Recording
**Status:** Complete
- [x] Weather conditions field
- [x] Temperature high/low
- [x] Auto-fetch weather API
- [x] Geocoding for job location

### LOG-04: Work Summary
**Status:** Complete
- [x] Work completed notes
- [x] Work planned notes
- [x] Delays/issues field
- [x] Safety notes
- [x] Site visitors
- [x] Weekly report generation
- [x] Photo attachments

---

## 9. Schedules

### SCH-01: Schedule Tasks
**Status:** Complete
- [x] Task management with dates
- [x] Vendor/PO assignment
- [x] Construction phase tracking
- [x] Trade categorization

### SCH-02: Task Dependencies
**Status:** Complete
- [x] Predecessor relationships (depends_on array)
- [x] Sort order management

### SCH-03: Gantt View
**Status:** Partial
- [x] Gantt data endpoint
- [x] Schedule page HTML
- [~] Gantt chart visualization (basic)
- [ ] Drag-and-drop task editing
- [ ] Critical path display
- [ ] Milestone markers

---

## 10. Documents

### DOC-01: Document Upload
**Status:** Complete
- [x] Upload to Supabase Storage
- [x] Multiple file types supported
- [x] Size limits enforced

### DOC-02: Document Categories
**Status:** Complete
- [x] 11 categories (contracts, plans, permits, etc.)
- [x] Category filtering
- [x] AI auto-categorization

### DOC-03: Version History
**Status:** Partial
- [x] Document metadata stored
- [~] Version tracking (basic)
- [ ] Version comparison
- [ ] Rollback functionality
- [ ] Change tracking

---

## 11. Inspections

### INS-01: Inspection CRUD
**Status:** Complete
- [x] Create inspections linked to jobs
- [x] Update/delete inspections
- [x] List with filters

### INS-02: Inspection Types
**Status:** Complete
- [x] 19 predefined types
- [x] Custom type support
- [x] Type filtering

### INS-03: Status Tracking
**Status:** Complete
- [x] scheduled → passed/failed/cancelled
- [x] Result date/notes
- [x] Re-inspection support
- [x] Re-inspection counting

### INS-04: Inspector Info
**Status:** Complete
- [x] Inspector name, phone, agency
- [x] Deficiency tracking
- [x] Deficiency resolution workflow
- [x] Photo attachments
- [x] Activity logging

---

## 12. Punch Lists

### PUN-01: Punch List CRUD
**Status:** Complete
- [x] Create punch lists linked to jobs/POs
- [x] List with filters
- [x] Soft delete

### PUN-02: Punch Items
**Status:** Complete
- [x] Individual items with status
- [x] Location/category fields
- [x] Priority levels

### PUN-03: Item Workflow
**Status:** Complete
- [x] open → in_progress → resolved → verified
- [x] Resolution notes
- [x] Verification tracking

### PUN-04: Photo Evidence
**Status:** Complete
- [x] Before/after/progress photos
- [x] Photo upload to storage
- [x] Caption support

### PUN-05: Retainage Hold
**Status:** Complete
- [x] 10% retainage on POs
- [x] retainage_held tracking
- [x] Release mechanism

### PUN-06: PO Blocking
**Status:** Complete
- [x] Cannot complete PO with open items
- [x] Punch status check endpoint

---

## 13. Bids (NOT IMPLEMENTED)

### BID-01: Bid CRUD
**Status:** Not Started
- [ ] Create bid linked to job/vendor
- [ ] Update bid details
- [ ] Delete bid
- [ ] List bids with filters

### BID-02: Bid File Upload
**Status:** Not Started
- [ ] Upload bid documents (PDF)
- [ ] Store in Supabase Storage
- [ ] File preview

### BID-03: Bid Status Workflow
**Status:** Not Started
- [ ] received → under_review → accepted/rejected
- [ ] Status transition validation
- [ ] Status history

### BID-04: Bid Comparison View
**Status:** Not Started
- [ ] Compare multiple bids side-by-side
- [ ] Scope comparison
- [ ] Price comparison
- [ ] Bid notes/comments

### BID-05: Convert Bid to PO
**Status:** Not Started
- [ ] Convert accepted bid to PO
- [ ] Map bid scope to PO line items
- [ ] Link PO back to source bid

---

## 14. Estimates

### EST-01: Estimate CRUD
**Status:** Complete
- [x] Create estimate linked to job
- [x] Update estimate
- [x] Delete estimate (soft delete)
- [x] List estimates with filters

### EST-02: Estimate Line Items
**Status:** Complete
- [x] Add line items by cost code
- [x] Quantity, unit cost, total
- [x] Subtotals by category
- [x] Grand total calculation
- [x] Assembly groupings
- [x] Line item reordering

### EST-03: Import from Bids
**Status:** Complete
- [x] Import accepted bid amounts
- [x] Map to cost codes
- [x] Bulk import via /import-from-bid route

### EST-04: Estimate Versions
**Status:** Complete
- [x] Version control (v1, v2, etc.)
- [x] Version comparison via parent_estimate_id
- [x] Version notes

### EST-05: Convert to Budget
**Status:** Complete
- [x] Convert approved estimate to budget
- [x] Create budget lines from estimate
- [x] Link budget to source estimate (source_estimate_id)

---

## 15. Photos (NOT IMPLEMENTED)

### PHO-01: Photo Upload
**Status:** Not Started
- [ ] Drag-and-drop upload
- [ ] Multi-select upload
- [ ] Mobile-friendly capture
- [ ] Compression/optimization

### PHO-02: Photo Metadata
**Status:** Not Started
- [ ] Caption field
- [ ] Date taken
- [ ] Location/area
- [ ] Category tags
- [ ] GPS coordinates (if available)

### PHO-03: Photo Gallery
**Status:** Not Started
- [ ] Grid view
- [ ] Lightbox viewer
- [ ] Filter by date/category/area
- [ ] Search by caption
- [ ] Download options

### PHO-04: Link to Entities
**Status:** Not Started
- [ ] Link photos to inspections
- [ ] Link photos to punch items
- [ ] Link photos to daily logs
- [ ] Photo references in entity views

---

## 16. Dashboard

### DASH-01: Overview Metrics
**Status:** Partial
- [x] Dashboard HTML page
- [x] Stats endpoint exists
- [~] Basic metrics display
- [ ] Real-time updates
- [ ] Customizable widgets
- [ ] Date range selection

### DASH-02: Alerts/Notifications
**Status:** Not Implemented
- [ ] Upcoming inspections
- [ ] Expiring documents
- [ ] Budget overruns
- [ ] Pending approvals
- [ ] Overdue items

---

## 17. User Experience

### UX-01: Navigation
**Status:** Complete
- [x] Main nav sidebar
- [x] Sub-navigation
- [x] Active page highlighting

### UX-02: Search
**Status:** Partial
- [x] In-page filtering
- [ ] Global search
- [ ] Keyboard shortcuts

### UX-03: Mobile Responsiveness
**Status:** Partial
- [~] Some responsive styles
- [ ] Mobile-first design
- [ ] Touch-friendly controls
- [ ] Offline capability

---

## Traceability Matrix

| Requirement | Phase | Priority | Status |
|-------------|-------|----------|--------|
| FND-01 to FND-05 | 1 | P0 | 90% |
| JOB-01 to JOB-04 | 2 | P0 | 60% |
| VND-01 to VND-03 | 2 | P0 | 40% |
| INV-01 to INV-12 | 3 | P0 | 100% |
| PO-01 to PO-07 | 4 | P0 | 100% |
| DRW-01 to DRW-07 | 5 | P0 | 100% |
| BUD-01 to BUD-04 | 6 | P0 | 80% |
| LOG-01 to LOG-04 | 7 | P0 | 100% |
| SCH-01 to SCH-03 | 8 | P0 | 85% |
| DOC-01 to DOC-03 | 9 | P0 | 80% |
| INS-01 to INS-04 | 10 | P0 | 100% |
| PUN-01 to PUN-06 | 11 | P0 | 100% |
| BID-01 to BID-05 | 12 | P0 | 100% |
| EST-01 to EST-05 | 13 | P0 | 100% |
| PHO-01 to PHO-04 | 14 | P1 | 0% |
| DASH-01 to DASH-02 | 15 | P2 | 30% |
| UX-01 to UX-03 | 16 | P2 | 50% |

**Summary:**
- Fully Complete: Invoices, POs, Draws, Daily Logs, Inspections, Punch Lists, Bids, Estimates
- Mostly Complete: Foundation, Schedules, Documents, Budgets
- Needs Work: Jobs, Vendors, Dashboard, UX
- Not Started: Photos
