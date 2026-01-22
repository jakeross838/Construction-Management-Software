# Phase 106-02: Hierarchical API Routes - Summary

## Completed: 2026-01-21

## Overview
Added comprehensive API endpoints for managing hierarchical estimates: phases, groups, subgroups, and line items. Includes template management for reusable estimate structures and bulk reorder functionality for drag-and-drop support.

## Tasks Completed

### Task 1: Update GET /api/estimates/:id for Full Hierarchy
- Added nested query for phases -> groups -> subgroups -> line_items
- Sort all nested arrays by sort_order for consistent ordering
- Maintain backwards compatibility with legacy v2_estimate_lines table
- Added line_items field from new v2_estimate_line_items table

### Task 2: Phase CRUD Endpoints
- `POST /api/estimates/:id/phases` - Create new phase with auto sort_order
- `PATCH /api/estimates/phases/:phaseId` - Update phase properties
- `DELETE /api/estimates/phases/:phaseId` - Delete phase (cascades to children)

### Task 3: Group CRUD Endpoints
- `POST /api/estimates/phases/:phaseId/groups` - Create group in phase
- `PATCH /api/estimates/groups/:groupId` - Update group properties
- `DELETE /api/estimates/groups/:groupId` - Delete group (cascades)

### Task 4: Subgroup CRUD Endpoints
- `POST /api/estimates/groups/:groupId/subgroups` - Create subgroup in group
- `PATCH /api/estimates/subgroups/:subgroupId` - Update subgroup properties
- `DELETE /api/estimates/subgroups/:subgroupId` - Delete subgroup (cascades)

### Task 5: Hierarchical Line Item Endpoints
- `POST /api/estimates/subgroups/:subgroupId/lines` - Create line in subgroup
- `PATCH /api/estimates/lines/:lineId` - Update line item with auto-amount calc
- `DELETE /api/estimates/lines/:lineId` - Delete line item
- Auto calculate amount from quantity * unit_cost when not provided
- Support catalog_item_id for selection linking

### Task 6: Template Management Endpoints
- `GET /api/estimates/templates/db` - List database templates
- `GET /api/estimates/templates/db/:id` - Get template details with structure
- `POST /api/estimates/:id/apply-template` - Apply template to estimate
- `POST /api/estimates/:id/save-as-template` - Save estimate as template
- Fallback logic when database RPC functions not available

### Task 7: Bulk Reorder Endpoint
- `POST /api/estimates/:id/reorder` - Reorder phases, groups, subgroups, or lines
- Parallel updates using Promise.all for performance
- Supports drag-and-drop reordering in UI

## Files Modified

- `server/routes/estimates.js` - Added ~760 lines of new endpoints

## New API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/estimates/:id` | Updated: Returns full hierarchy |
| POST | `/api/estimates/:id/phases` | Create phase |
| PATCH | `/api/estimates/phases/:phaseId` | Update phase |
| DELETE | `/api/estimates/phases/:phaseId` | Delete phase |
| POST | `/api/estimates/phases/:phaseId/groups` | Create group |
| PATCH | `/api/estimates/groups/:groupId` | Update group |
| DELETE | `/api/estimates/groups/:groupId` | Delete group |
| POST | `/api/estimates/groups/:groupId/subgroups` | Create subgroup |
| PATCH | `/api/estimates/subgroups/:subgroupId` | Update subgroup |
| DELETE | `/api/estimates/subgroups/:subgroupId` | Delete subgroup |
| POST | `/api/estimates/subgroups/:subgroupId/lines` | Create line item |
| PATCH | `/api/estimates/lines/:lineId` | Update line item |
| DELETE | `/api/estimates/lines/:lineId` | Delete line item |
| GET | `/api/estimates/templates/db` | List templates |
| GET | `/api/estimates/templates/db/:id` | Get template |
| POST | `/api/estimates/:id/apply-template` | Apply template |
| POST | `/api/estimates/:id/save-as-template` | Save as template |
| POST | `/api/estimates/:id/reorder` | Bulk reorder |

## Commits

1. `feat(106-02): update GET /api/estimates/:id for full hierarchy`
2. `feat(106-02): add Phase CRUD endpoints`
3. `feat(106-02): add Group CRUD endpoints`
4. `feat(106-02): add Subgroup CRUD endpoints`
5. `feat(106-02): add hierarchical line item endpoints`
6. `feat(106-02): add template management endpoints`
7. `feat(106-02): add bulk reorder endpoint`

## Duration
~15 minutes

## Next Steps
- Phase 106-03: Collapsible hierarchy UI rendering
- Phase 106-04: Catalog suggestions and auto-fill
