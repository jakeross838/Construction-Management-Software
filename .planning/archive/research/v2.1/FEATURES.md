# v2.1 Selections Module Research: Visual Catalog Features

## Research Summary

This document captures industry research on how Materio and similar construction selection software organize visual catalogs, with a focus on internal staff use cases for Ross Built CMS.

---

## Industry Landscape

### Key Players Analyzed

| Software | Focus | Visual Approach |
|----------|-------|-----------------|
| **Materio** | Interior Design & Construction | Floor plan markers, location-based schedules |
| **Buildertrend** | Residential Construction | Digital selection lists with images |
| **BuildBook** | Custom Home Builders | Image-based room views, virtual showroom |
| **JobTread** | Selections & Allowances | Centralized status tracking, auto change orders |
| **Houzz Pro** | Design & Construction | Clipper tool, visual boards, vendor library |
| **Gather** | FF&E Specification | Compare options, spec packages, team collaboration |
| **ConstructionOnline** | General Construction | Capture from supplier websites, selection sheets |
| **CoConstruct** | Custom Home Building | Master selection sheets by category and room |

### Common Visual Patterns

1. **Grid-based product catalogs** with large thumbnail images
2. **Card-based filtering** using visual tiles instead of dropdowns
3. **Room/location tagging** to organize selections spatially
4. **Status indicators** (open, in review, confirmed) with visual badges
5. **Before/after comparisons** for upgrade options
6. **Price impact displays** showing allowance vs. actual cost

---

## Table Stakes Features

These are expected by users and essential for parity with competitors:

### 1. Visual Product Grid
- **Large photo thumbnails** in grid/card layout
- **Product name, SKU, price** visible on card
- **Quick preview** on hover or click
- **Responsive grid** that adjusts to screen size

### 2. Category Hierarchy
- **Multi-level categories**: Category > Subcategory > Product
- **Standard categories**: Flooring, Fixtures, Appliances, Lighting, Finishes, Hardware, Cabinetry, Countertops
- **Room-based organization** as secondary filter (Kitchen, Master Bath, etc.)
- **Category icons/images** for quick recognition

### 3. Search and Filter
- **Keyword search** across product names/descriptions
- **Filter by**: Category, Vendor, Price Range, Room
- **Sort options**: Price (low/high), Name, Recently Added, Most Used
- **Clear all filters** button
- **Real-time results** (async, no page reload)

### 4. Product Detail View
- **Multiple product photos** with gallery navigation
- **Full specifications** (dimensions, materials, colors)
- **Vendor information** and contact
- **Price and availability**
- **Link to vendor website/catalog**

### 5. Selection Management
- **Select product for job** workflow
- **Status tracking**: Pending, Selected, Ordered, Installed
- **Selection history** with timestamps
- **Notes/comments** on selections

### 6. Allowance Integration
- **Allowance budget display** per category
- **Real-time variance calculation** (allowance - selection price)
- **Overage/underage indicators** (visual: green/red)
- **Running total** across all selections

---

## Differentiating Features

Features that would set Ross Built apart:

### 1. AI-Powered Product Capture
- **Screenshot-to-product**: Upload vendor catalog screenshots, AI extracts product info
- **PDF import**: Parse vendor spec sheets automatically
- **Suggested categorization** based on product name/description
- **Duplicate detection** when adding new products

### 2. Smart Recommendations
- **"Also used in similar projects"** suggestions
- **Budget-aware alternatives**: "This product is under allowance by $500"
- **Vendor relationship scoring**: Prioritize preferred vendors
- **Trending products** from recent project selections

### 3. Quick Add from Invoices
- **Link to invoice processing**: When approving an invoice, prompt to add product to catalog
- **Auto-populate product details** from invoice line items
- **Build catalog organically** from actual purchases

### 4. Project Templates
- **Standard selection packages** for project types (e.g., "Builder Grade", "Premium Upgrade")
- **Clone selections** from previous similar projects
- **Bulk apply** template to new project

### 5. Vendor Portal Integration
- **Live pricing feeds** from key vendors
- **Availability checking** via API
- **Direct order placement** from selection

### 6. Change Order Automation
- **Auto-generate CO** when selection exceeds allowance
- **CO preview** before confirming selection
- **Bulk CO** for multiple selection overages
- **CO history linked to selection**

---

## Anti-Features to Avoid

Patterns that hurt usability or don't fit internal staff use:

### 1. Client Portal Complexity
- **Avoid**: Complex client-facing approval workflows
- **Why**: This is for internal staff, not homeowner decisions
- **Instead**: Simple internal status tracking

### 2. 3D Visualization Overhead
- **Avoid**: Full 3D room rendering, VR walkthroughs
- **Why**: Overkill for catalog browsing, slow to load
- **Instead**: High-quality static product photos

### 3. Floor Plan Mapping (for MVP)
- **Avoid**: Requiring floor plan uploads to use selections
- **Why**: Adds friction, not all jobs have digital plans
- **Instead**: Simple room dropdown tagging

### 4. Complex Approval Chains
- **Avoid**: Multi-step approval workflows with routing
- **Why**: Small team, informal process
- **Instead**: Simple "Selected by [name]" tracking

### 5. Punch-Out Catalogs
- **Avoid**: Complex vendor website integrations
- **Why**: Maintenance burden, vendor systems change
- **Instead**: Simple product library with manual updates

### 6. Mobile-First at Expense of Desktop
- **Avoid**: Touch-first UI that's awkward with mouse
- **Why**: Staff primarily use desktop in office
- **Instead**: Desktop-optimized with usable mobile fallback

### 7. Over-Granular Permissions
- **Avoid**: Role-based access per category/product
- **Why**: Small team, everyone needs full access
- **Instead**: Simple edit history for accountability

---

## Feature Dependencies

### Core Dependencies (Must Have First)
```
Product Catalog (DB tables) ─┬─> Visual Grid Browse
                             ├─> Product Detail View
                             └─> Search/Filter

Category Hierarchy ─────────────> Category Navigation

Allowance Budgets (existing) ───> Variance Display
```

### Integration Dependencies
```
Invoice Processing (existing) ──> Quick Add from Invoice
Change Order System (existing) ─> Auto CO on Overage
Job/Project System (existing) ──> Job Selection Assignment
```

### Enhancement Dependencies
```
Visual Grid Browse ─────────────> Advanced Filters
Product Detail View ────────────> Gallery/Multiple Photos
Variance Display ───────────────> CO Automation
```

---

## MVP Definition: Visual Catalog Redesign

### Phase 1: Foundation (MVP)

**Goal**: Replace current selection module with visual, photo-driven catalog.

#### Database Schema
- `v2_product_catalog` - Products with photos, specs, pricing
- `v2_product_categories` - Hierarchical categories
- `v2_product_photos` - Multiple photos per product
- `v2_job_selections` - Link products to jobs with status

#### UI Components
1. **Category sidebar** with icons and counts
2. **Product grid** with card layout (photo, name, price, vendor)
3. **Product detail modal** with full specs and gallery
4. **Selection sidebar** showing current job's selections
5. **Allowance status bar** with variance indicators

#### Core Workflows
1. Browse catalog by category
2. Search products by keyword
3. View product details
4. Add product to job selection
5. See allowance impact

### Phase 2: Catalog Management

**Goal**: Make it easy for staff to build and maintain the product library.

#### Features
- Add new product form with photo upload
- Edit existing products
- Bulk import from CSV
- Duplicate product (for variants)
- Archive products (soft delete)
- Category management (add/edit/reorder)

### Phase 3: Integration

**Goal**: Connect selections to existing CMS workflows.

#### Features
- Link selections to invoices
- Auto-generate change orders on overage
- Selection reports by job
- Vendor usage analytics
- "Add to catalog" from invoice approval flow

### Phase 4: Advanced (Future)

**Goal**: Intelligent features for power users.

#### Features
- AI product capture from screenshots
- Smart recommendations
- Project templates
- Vendor pricing integration

---

## Category Structure Recommendation

Based on industry standards for residential construction:

### Level 1 Categories
```
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
```

### Example Subcategories (Flooring)
```
Flooring
├── Hardwood
│   ├── Oak
│   ├── Walnut
│   └── Engineered
├── Tile
│   ├── Ceramic
│   ├── Porcelain
│   └── Natural Stone
├── Carpet
│   ├── Plush
│   ├── Berber
│   └── Commercial
├── LVP/LVT
└── Other
```

### Room Tags (Secondary Organization)
```
- Kitchen
- Master Bathroom
- Secondary Bathroom(s)
- Living Areas
- Bedrooms
- Garage
- Exterior
- Whole House
```

---

## UI Design Patterns to Follow

### Grid Layout
- Use CSS Grid with `repeat(auto-fill, minmax(280px, 1fr))`
- Cards should have consistent aspect ratio (4:3 or 1:1 for photos)
- Hover state shows quick actions (View, Add to Job)
- Card shows: Photo, Product Name, Vendor, Price

### Filter Panel
- Left sidebar on desktop, bottom sheet on mobile
- Collapsible category tree
- Checkbox filters for vendors
- Range slider for price
- Apply button on mobile, instant apply on desktop

### Product Modal
- Full-screen modal matching existing PO/Invoice pattern
- Photo gallery with thumbnails
- Specs in organized sections
- "Add to Job" CTA prominent
- Show allowance impact before confirming

### Status Badges
Reuse existing badge patterns:
- Pending: `--accent-orange`
- Selected: `--accent-blue`
- Ordered: `--accent-green`
- Installed: `--accent-green` (darker)

---

## Sources

### Materio & Visual Catalogs
- [Materio Official](https://www.materio.co/)
- [Materio Reviews - Capterra](https://www.capterra.com/p/238666/Materio/)
- [Materio Reviews - GetApp](https://www.getapp.com/construction-software/a/materio/)

### Construction Selection Software
- [ConstructionOnline Selections](https://us.constructiononline.com/construction-client-selections-software)
- [Buildertrend Selections](https://buildertrend.com/project-management/construction-selections-software/)
- [BuildBook Client Selections](https://buildbook.co/client-selections-software)
- [JobTread Selections & Allowances](https://www.jobtread.com/features/selections)
- [Buildern Selections Software](https://buildern.com/features/construction-client-selections-software)

### Allowance & Budget Tracking
- [BuildTools Budget Tracking](https://www.buildtools.com/features/budget-tracking)
- [Planyard Change Order Software](https://planyard.com/construction-change-order-software)
- [Buildern Change Orders](https://buildern.com/features/construction-change-orders-software)
- [Buildern Construction Allowances Guide](https://buildern.com/resources/blog/construction-allowances/)

### UI Patterns & Design
- [Baymard E-Commerce Product Lists Research](https://baymard.com/research/ecommerce-product-lists)
- [Eleken List UI Design Examples](https://www.eleken.co/blog-posts/list-ui-design)
- [Smart Interface Design Patterns - Filtering UX](https://smart-interface-design-patterns.com/articles/filtering-ux/)
- [Smashing Magazine - Filter Design Best Practices](https://www.smashingmagazine.com/2021/07/frustrating-design-patterns-broken-frozen-filters/)

### Selection Categories & Workflows
- [Archisoup Finish Schedules 101](https://www.archisoup.com/finish-schedules)
- [Stauffer & Sons - Making Selections](https://staufferandsons.com/making-selections-home-without-getting-overwhelmed/)
- [Buildern Construction Selection Guide](https://buildern.com/resources/blog/construction-selection/)
- [CoConstruct Selection Templates](https://www.coconstruct.com/learn-construction-software/spec-selection-template-examples)

### Product Catalog Management
- [Bundle - Construction Procurement](https://www.bundle.build/)
- [Houzz Pro Selections](https://pro.houzz.com/for-pros/feature-selections)
- [Gather FF&E Software](https://gatherit.co/features/selections)
