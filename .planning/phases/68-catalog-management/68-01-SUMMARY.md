---
phase: 68
plan: 01
subsystem: catalog
tags: [product-modal, add-product, edit-product, crud, form]
dependency-graph:
  requires: [67]
  provides: [product-crud-ui, product-form-modal, openAddProductModal, openEditProductModal, saveProduct]
  affects: [68-02, 68-03]
tech-stack:
  added: []
  patterns: [modal-form, form-validation, api-fetch]
file-tracking:
  key-files:
    created: []
    modified:
      - public/catalog.html
      - public/js/catalog.js
decisions:
  - desc: "Used existing modal pattern with .show class for visibility"
    why: "Consistent with other modals in the application"
  - desc: "Combined model_number and sku fields in UI"
    why: "Simpler form, SKU populated from model_number"
  - desc: "Price validation requires positive value"
    why: "Prevent zero or negative prices in catalog"
metrics:
  duration: ~3min
  completed: 2026-01-20
---

# Phase 68 Plan 01: Product Modal (Add/Edit) Summary

**One-liner:** Product form modal with create/edit functionality connected to catalog API endpoints.

## What Was Built

### Product Form Modal (HTML)
The modal HTML was added to catalog.html with:
- Form fields for: name, category, vendor, model/SKU, room, price, unit, default qty, sq footage
- Description textarea
- Specifications section: color, finish, style
- Dimensions section: width, height, depth, unit
- Tags input (comma-separated)
- Image upload area (preview only, full upload in 68-03)
- Save and Cancel buttons

### Modal Open Functions

**openAddProductModal()**
- Resets form to empty state
- Populates category dropdown from `allCategories` (with child categories indented)
- Populates vendor dropdown from `allVendors`
- Shows modal with `.show` class
- Focuses name input field

**openEditProductModal()**
- Requires `currentProduct` to be set (from product detail view)
- Calls openAddProductModal() to set up dropdowns
- Changes title to "Edit Product"
- Fills all form fields with current product data:
  - Basic info: name, category_id, vendor_id, model_number, room
  - Pricing: unit_price, unit, quantity_default, square_footage
  - Content: description, tags
  - Specs: color, finish, style (from specs object)
  - Dimensions: width, height, depth, unit (from dimensions object)
- Shows existing images in upload preview area

**closeProductFormModal()**
- Removes `.show` class
- Hides modal with `display: none`

### Save Function

**saveProduct()**
- Reads form values and determines if edit (has id) or create (no id)
- Validates: name required, category required, price must be positive
- Builds product data object with:
  - Basic fields: name, category_id, vendor_id, model_number, sku, description, room
  - Pricing: unit_price, unit, quantity_default, square_footage
  - Arrays: tags (parsed from comma-separated input)
  - Objects: specs, dimensions (built from individual fields)
- Calls API:
  - POST /api/selections/catalog (create)
  - PATCH /api/selections/catalog/:id (update)
- Shows success toast
- Refreshes product grid via loadProducts()
- If editing, reopens product detail with updated data

### Archive Function

**archiveProduct()**
- Requires confirmation
- Calls DELETE /api/selections/catalog/:id
- Closes product modal
- Refreshes product grid

### Event Listeners
- btnAddProduct click -> openAddProductModal()
- btnEditProduct click -> openEditProductModal()
- btnArchiveProduct click -> archiveProduct()

## Key Code Locations

| Function | File | Line |
|----------|------|------|
| openAddProductModal | public/js/catalog.js | 727 |
| openEditProductModal | public/js/catalog.js | 764 |
| closeProductFormModal | public/js/catalog.js | 819 |
| saveProduct | public/js/catalog.js | 825 |
| archiveProduct | public/js/catalog.js | 935 |

## API Integration

- **POST /api/selections/catalog** - Create product (category_id, name, description, model_number, sku, unit_price, unit, etc.)
- **PATCH /api/selections/catalog/:id** - Update product (all fields)
- **DELETE /api/selections/catalog/:id** - Soft delete (sets is_active=false)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. Modal HTML exists in catalog.html (lines 295-454)
2. All required functions defined in catalog.js
3. API endpoints tested - POST creates products, PATCH updates them
4. Event listeners wired up correctly (lines 87-89)
5. JavaScript syntax valid (node -c passes)

## Commits

| Hash | Message |
|------|---------|
| cc19819 | feat(68): add catalog management modals and buttons |
| 81731ce | feat(68-02): implement category management modal (extended functions) |

## Next Phase Readiness

- Product add/edit modal fully functional
- Ready for 68-02 (Category Management) - already complete
- Ready for 68-03 (Image Upload) which will enhance the image upload area
