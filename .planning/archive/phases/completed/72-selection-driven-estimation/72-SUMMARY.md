# Phase 72: Selection-Driven Estimation - Summary

**Completed:** 2026-01-20
**Migration:** 084-085

---

## What Was Built

### Database (migration-084, 085)

1. **v2_project_details table**:
   - Square footage: total, conditioned, garage, porch
   - Room counts: bedrooms, bathrooms, stories
   - Linear dimensions: exterior, interior walls, roof
   - Room-specific details as JSON array
   - Style/tier for default selections (builder/standard/premium/luxury)

2. **v2_estimates table**:
   - Estimate identification (number, name, description)
   - Status workflow (draft, pending_review, approved, rejected, converted)
   - Version tracking with parent reference
   - Totals: material, labor, subtotal, markup, contingency, grand total
   - Approval tracking

3. **v2_estimate_line_items table**:
   - Links to catalog item (copied for versioning)
   - Cost code assignment
   - Quantity calculations with unit, waste factor
   - Material cost (unit price, extended)
   - Labor cost (hours, rate, extended)
   - Override flags for manual adjustments
   - Notes per line

4. **v2_estimate_sections table**:
   - Group line items by category
   - Section subtotals

5. **Database functions**:
   - `calculate_estimate_totals(estimate_id)` - Recalculate all totals
   - `create_estimate_from_selections(job_id)` - Auto-populate from job selections
   - `calculate_material_quantity(item_id, project_details)` - Auto-calculate qty

---

## API Endpoints

### Project Details
- `GET/POST/PATCH /api/jobs/:jobId/project-details` - Manage project details

### Estimates CRUD
- `GET /api/jobs/:jobId/estimates` - List estimates for job
- `GET /api/estimates/:id` - Get estimate with line items
- `POST /api/jobs/:jobId/estimates` - Create estimate
- `PATCH /api/estimates/:id` - Update estimate
- `DELETE /api/estimates/:id` - Delete estimate

### Line Items
- `POST /api/estimates/:id/line-items` - Add line item
- `PATCH /api/estimates/:id/line-items/:lineId` - Update line item
- `DELETE /api/estimates/:id/line-items/:lineId` - Remove line item

### Actions
- `POST /api/estimates/:id/calculate` - Recalculate totals
- `POST /api/estimates/:id/populate-from-selections` - Add all job selections
- `POST /api/estimates/:id/approve` - Approve estimate
- `POST /api/estimates/:id/duplicate` - Create new version

---

## UI Features

### Estimate Builder Page (`/estimates.html`)

- Project details form (sqft, rooms, dimensions)
- Create estimate from selections button
- Line items table with:
  - Item name, quantity, unit
  - Material cost (unit, extended)
  - Labor cost (hours, rate, extended)
  - Total per line
- Section grouping by cost code category
- Summary panel:
  - Material subtotal
  - Labor subtotal
  - Markup % and amount
  - Contingency % and amount
  - Grand total
- Save, approve, duplicate actions

### Auto-Calculations

When project details exist:
- Flooring quantities from sqft
- Paint from wall sqft
- Trim from linear feet
- Fixtures from room counts
- Roofing from roof sqft

---

## Downstream Conversion

### Estimate to Allowances
- `POST /api/estimates/:id/convert-to-allowances`
- Creates allowance budgets per cost code section

### Estimate to Scopes
- `POST /api/estimates/:id/generate-scopes`
- Creates scope of work documents by trade

### Scope to Bids
- `POST /api/scopes/:id/create-bid-request`
- Sends bid requests to qualified vendors

### Bid to PO
- `POST /api/bids/:id/convert-to-po`
- Creates PO from approved bid

---

## Notes

Selection-Driven Estimation enables the core construction workflow:
1. Enter project details (sqft, rooms, etc.)
2. Select products from catalog
3. System calculates quantities based on project
4. System applies labor rates from trades
5. Generate estimate with full breakdown
6. Convert approved estimate to budgets, scopes, bids, POs
