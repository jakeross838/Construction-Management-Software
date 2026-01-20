# Requirements: Ross Built CMS v2.1

**Defined:** 2026-01-20
**Core Value:** Run your entire construction business from one system

## v2.1 Requirements

Requirements for Selections & Navigation Polish milestone. Each maps to roadmap phases.

### Navigation Consistency

- [ ] **NAV-01**: Staff can see which pages have job selection in main window vs sidebar
- [ ] **NAV-02**: All pages use sidebar job selection pattern (never in main window)
- [ ] **NAV-03**: Job selection persists in URL (`?job=uuid`) across page refreshes

### Visual Catalog Core

- [ ] **CAT-01**: Staff can browse products in visual grid with large photo thumbnails
- [ ] **CAT-02**: Staff can navigate multi-level category hierarchy (Category > Subcategory)
- [ ] **CAT-03**: Staff can search products by keyword across names/descriptions
- [ ] **CAT-04**: Staff can filter products by category, vendor, price range, room
- [ ] **CAT-05**: Staff can view product detail modal with photo gallery
- [ ] **CAT-06**: Product details include quantities, square footage, and specs
- [ ] **CAT-07**: Staff can see selection status (Pending → Selected → Ordered → Installed)
- [ ] **CAT-08**: Staff can see allowance variance indicators (green/red for under/over)

### Catalog Management

- [ ] **MGT-01**: Staff can add new products with photo upload
- [ ] **MGT-02**: Staff can edit existing products
- [ ] **MGT-03**: Staff can add multiple photos per product with gallery
- [ ] **MGT-04**: Staff can manage categories (add/edit/reorder)
- [ ] **MGT-05**: Staff can archive products (soft delete)

### Integration

- [ ] **INT-01**: Staff can link product selections to specific jobs
- [ ] **INT-02**: Staff can see allowance budget tracking per category
- [ ] **INT-03**: System generates change order when selection exceeds allowance

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Catalog Enhancement

- **ENH-01**: Staff can bulk import products from CSV
- **ENH-02**: Staff can add product to catalog from invoice approval flow
- **ENH-03**: Staff can view selection reports by job
- **ENH-04**: Staff can view vendor usage analytics

### AI Features

- **AI-01**: AI captures product info from screenshots/PDFs
- **AI-02**: System suggests "also used in similar projects"
- **AI-03**: Staff can apply project templates (Builder Grade, Premium Upgrade)
- **AI-04**: System integrates live vendor pricing feeds

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Client portal | Internal staff tool only - per user requirement |
| 3D visualization / VR | Overkill for catalog browsing, slow to load |
| Floor plan mapping | Adds friction, not all jobs have digital plans |
| Complex approval chains | Small team, informal process |
| Punch-out vendor catalogs | Maintenance burden, vendor systems change |
| Mobile-first design | Staff primarily use desktop in office |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| NAV-01 | Phase 65 | Pending |
| NAV-02 | Phase 65 | Pending |
| NAV-03 | Phase 65 | Pending |
| CAT-01 | Phase 67 | Pending |
| CAT-02 | Phase 67 | Pending |
| CAT-03 | Phase 67 | Pending |
| CAT-04 | Phase 67 | Pending |
| CAT-05 | Phase 67 | Pending |
| CAT-06 | Phase 66 | Pending |
| CAT-07 | Phase 67 | Pending |
| CAT-08 | Phase 67 | Pending |
| MGT-01 | Phase 68 | Pending |
| MGT-02 | Phase 68 | Pending |
| MGT-03 | Phase 66 | Pending |
| MGT-04 | Phase 68 | Pending |
| MGT-05 | Phase 68 | Pending |
| INT-01 | Phase 69 | Pending |
| INT-02 | Phase 69 | Pending |
| INT-03 | Phase 69 | Pending |

**Coverage:**
- v2.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-01-20*
*Last updated: 2026-01-20 after roadmap creation*
