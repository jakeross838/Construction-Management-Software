# v2.1 Research Summary: Visual Catalog & Navigation Polish

**Date:** 2026-01-20
**Milestone:** v2.1 Selections & Navigation Polish

---

## Executive Summary

Research confirms that transforming the selections module into a Materio-style visual catalog is achievable with a modest ~50KB frontend bundle increase using vanilla JS libraries. The key insight is that **internal staff use cases differ significantly from client-facing tools** - we should avoid the complexity of client portals, 3D visualization, and multi-step approval workflows.

For navigation, the research identified that URL state persistence is critical for the sidebar job selection pattern - without it, page refreshes lose job context, breaking the workflow.

---

## Key Findings

### 1. Stack Selection (STACK.md)

**Recommended Libraries:**

| Purpose | Library | Size | Why |
|---------|---------|------|-----|
| Lightbox/Gallery | lightGallery 2.7.2 | ~16KB | Zero-dep, touch gestures, modular |
| Masonry Grid | MiniMasonry.js 3.2.0 | ~2KB | GPU-accelerated, tiny footprint |
| Lazy Loading | unlazy 0.13.0 | ~3KB | ThumbHash support, SEO-friendly |
| File Upload | FilePond 4.31.2 | ~25KB | Beautiful UI, image preview built-in |
| Client Compression | Compressor.js 1.2.1 | ~4KB | Handles mobile photo orientation |
| Server Placeholders | thumbhash + sharp | - | Better than BlurHash (supports alpha) |

**Total frontend increase:** ~50KB gzipped

**What to avoid:**
- PhotoSwipe (45KB, complex API)
- Isotope (25KB, overkill)
- React/Vue/Angular (project is vanilla JS)
- jQuery plugins

### 2. Feature Priorities (FEATURES.md)

**Table Stakes (must have):**
1. Visual product grid with large photo thumbnails
2. Multi-level category hierarchy (Category > Subcategory > Product)
3. Search + filter (keyword, category, vendor, price, room)
4. Product detail view with gallery
5. Selection status tracking (Pending → Selected → Ordered → Installed)
6. Allowance variance display (green/red indicators)

**Differentiators (future):**
- AI product capture from screenshots/PDFs
- "Also used in similar projects" recommendations
- Quick add from invoice approval flow
- Project templates (Builder Grade, Premium Upgrade)

**Anti-features (avoid):**
- Client portal complexity (this is internal staff tool)
- 3D visualization / VR walkthroughs
- Floor plan mapping requirement
- Complex approval chains
- Punch-out vendor catalogs
- Over-granular permissions

### 3. Architecture (ARCHITECTURE.md)

**New Database Tables:**
```sql
v2_catalog_images      -- Multiple photos per product
v2_catalog_variants    -- Size/color/finish variants
v2_catalog_attributes  -- Custom specs (dimensions, materials)
v2_catalog_documents   -- Spec sheets, cut sheets
```

**Storage Strategy:**
- Supabase Storage bucket: `selection-images`
- On-demand transforms via URL params (Pro plan feature)
- ThumbHash stored in DB for instant placeholders
- Original + thumbnail paths per image

**Search Implementation:**
- PostgreSQL tsvector for full-text search
- GIN index on searchable columns
- Trigram similarity for fuzzy matching

### 4. Pitfalls (PITFALLS.md)

**Critical Navigation Issues:**
1. **URL State Persistence** - Job selection MUST be in URL (`?job=uuid`)
2. **Never refresh-lose context** - Page reload should restore job selection
3. **Sidebar always visible** - Don't hide on mobile, use collapsible instead

**Image Performance Traps:**
1. Don't lazy load above-the-fold images (hurts LCP)
2. Always set width/height attributes (prevents layout shift)
3. Use `loading="lazy"` only below fold
4. Pre-generate thumbnails, don't resize on-the-fly for grid

**Memory Leaks in Vanilla JS:**
1. Clean up event listeners on modal close
2. Destroy lightbox/masonry instances before re-init
3. Use WeakMap for element references

---

## Implications for Roadmap

### Phase 1: Navigation Audit & Fix (Foundation)
Before touching selections, fix the navigation consistency issue. This prevents building new features on a broken foundation.

**Scope:**
- Audit all 31 pages for sidebar job selection pattern
- Identify pages where job selection is in main window
- Implement URL state persistence (`?job=uuid`)
- Ensure sidebar is always visible (even on mobile as collapsible)

**Estimate:** 1-2 plans

### Phase 2: Selections Database Schema
Add new tables for images, variants, attributes. Migrate existing v2_selection_catalog data.

**Scope:**
- Create v2_catalog_images, v2_catalog_variants, v2_catalog_attributes, v2_catalog_documents
- Add thumb_hash column to selection catalog
- Create Supabase storage bucket for images
- Add full-text search indexes

**Estimate:** 1 plan

### Phase 3: Selections Visual UI
Replace current list view with visual grid catalog.

**Scope:**
- Install frontend libraries (lightGallery, MiniMasonry, etc.)
- Build category sidebar with icons
- Build product grid with masonry layout
- Build product detail modal with gallery
- Implement search and filters

**Estimate:** 2-3 plans

### Phase 4: Catalog Management
CRUD for products, image upload, category management.

**Scope:**
- Add/edit product form with FilePond upload
- Image compression and ThumbHash generation
- Category management (add/edit/reorder)
- Bulk import from CSV

**Estimate:** 2 plans

### Phase 5: Integration
Connect visual catalog to existing CMS workflows.

**Scope:**
- Selection to job assignment flow
- Allowance variance display
- Link to change orders on overage
- "Add to catalog" from invoice approval

**Estimate:** 1-2 plans

---

## Recommended Category Structure

Based on industry standards for residential construction:

**Level 1 Categories:**
1. Flooring
2. Tile & Stone
3. Cabinetry
4. Countertops
5. Plumbing Fixtures
6. Lighting
7. Appliances
8. Hardware
9. Doors & Windows
10. Paint & Finishes
11. Electrical
12. HVAC
13. Exterior
14. Specialty

**Room Tags (secondary organization):**
Kitchen, Master Bath, Secondary Bath, Living Areas, Bedrooms, Garage, Exterior, Whole House

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Supabase image transforms not on plan | Medium | High | Check plan, fallback to pre-generated sizes |
| Performance issues with large catalogs | Low | Medium | Pagination, virtual scrolling if >500 items |
| Navigation changes break existing workflows | Medium | High | Phase 1 audit before any other changes |
| Staff resistance to new UI | Low | Medium | Keep list view as fallback option |

---

## Dependencies

**External:**
- Supabase Storage (already integrated)
- Supabase Pro plan for image transforms (verify current plan)

**Internal:**
- Existing v2_selection_catalog table
- Existing budget/allowance system
- Existing change order system

---

## Next Steps

1. **Define Requirements** - Create specific, testable requirements for v2.1
2. **Create Roadmap** - Break into 5 phases as outlined above
3. **Plan Phase 1** - Navigation audit and fix (foundation work)

```
/gsd:define-requirements
```

---

## Research Files

- `STACK.md` - Library recommendations and installation
- `FEATURES.md` - Feature analysis and MVP definition
- `ARCHITECTURE.md` - Database schema and storage patterns
- `PITFALLS.md` - Common failure modes and prevention
