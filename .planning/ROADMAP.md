# Roadmap: Ross Built CMS v2.1

## Overview

Transform the selections module into a visual catalog (Materio-style) with photo-driven browsing, and fix navigation consistency across all pages so job selection always uses the sidebar pattern.

## Milestones

- [Archive: .planning/milestones/] v1.0-v2.0 (shipped)
- **v2.1 Selections & Navigation Polish** - Phases 65-69 (in progress)

## Phases

**Phase Numbering:**
- Continues from v2.0 (ended at Phase 64)
- Integer phases (65, 66, 67): Planned milestone work
- Decimal phases (65.1, 65.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 65: Navigation Audit & Fix** - Fix sidebar job selection across all pages
- [x] **Phase 66: Selections Schema** - Database tables for visual catalog
- [x] **Phase 67: Visual Catalog UI** - Grid layout, categories, search/filters
- [ ] **Phase 68: Catalog Management** - Add/edit products with image upload
- [ ] **Phase 69: Selections Integration** - Connect to jobs, allowances, change orders

## Phase Details

### Phase 65: Navigation Audit & Fix
**Goal**: All pages use sidebar job selection pattern with URL state persistence
**Depends on**: Nothing (first phase)
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. Staff can see report of which pages have broken navigation
  2. All pages use sidebar for job selection (never main window)
  3. Job selection persists in URL and survives page refresh
**Research**: Unlikely (internal audit, existing patterns)
**Plans**: TBD

### Phase 66: Selections Schema
**Goal**: Database ready to store products with multiple photos, specs, and variants
**Depends on**: Phase 65
**Requirements**: CAT-06, MGT-03
**Success Criteria** (what must be TRUE):
  1. v2_catalog_images table exists with storage paths
  2. v2_selection_catalog has columns for quantities, specs, dimensions
  3. Supabase storage bucket for selection images exists
  4. ThumbHash column added for placeholder images
**Research**: Unlikely (Supabase patterns established)
**Plans**: TBD

### Phase 67: Visual Catalog UI
**Goal**: Staff can browse products in visual grid with category navigation and filters
**Depends on**: Phase 66
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-07, CAT-08
**Success Criteria** (what must be TRUE):
  1. Staff can see products in visual grid with photo thumbnails
  2. Staff can navigate category hierarchy (sidebar)
  3. Staff can search products by keyword
  4. Staff can filter by category, vendor, price, room
  5. Staff can view product detail modal with photo gallery
  6. Staff can see selection status badges
  7. Staff can see allowance variance indicators (green/red)
**Research**: Unlikely (library choices made in STACK.md)
**Plans**: TBD

### Phase 68: Catalog Management
**Goal**: Staff can add, edit, and organize products in the catalog
**Depends on**: Phase 67
**Requirements**: MGT-01, MGT-02, MGT-04, MGT-05
**Success Criteria** (what must be TRUE):
  1. Staff can add new product with photo upload
  2. Staff can edit existing product details
  3. Staff can manage categories (add/edit/reorder)
  4. Staff can archive products (soft delete)
  5. Photos compress on upload and generate thumbnails
**Research**: Unlikely (FilePond documented)
**Plans**: TBD

### Phase 69: Selections Integration
**Goal**: Selections connect to jobs, allowances, and change orders
**Depends on**: Phase 68
**Requirements**: INT-01, INT-02, INT-03
**Success Criteria** (what must be TRUE):
  1. Staff can assign product selections to specific jobs
  2. Staff can see allowance budget per category with variance
  3. System auto-generates change order when selection exceeds allowance
**Research**: Unlikely (existing CO/allowance systems)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 65 → 66 → 67 → 68 → 69

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 65. Navigation Audit & Fix | 1/1 | Complete | 2026-01-20 |
| 66. Selections Schema | 1/1 | Complete | 2026-01-20 |
| 67. Visual Catalog UI | 1/1 | Complete | 2026-01-20 |
| 68. Catalog Management | 0/TBD | Not started | - |
| 69. Selections Integration | 0/TBD | Not started | - |
