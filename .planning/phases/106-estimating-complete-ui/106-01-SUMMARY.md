# Phase 106-01: Estimating - Hierarchical Structure Schema

## Summary

Successfully implemented the database schema for hierarchical estimates with Phase/Group/Subgroup organization and template support.

## Completed Tasks

### Task 1: Create Estimate Phase/Group Schema
- Created `v2_estimate_phases` table for construction phases
- Created `v2_estimate_groups` table for groups within phases
- Created `v2_estimate_subgroups` table for subgroups within groups
- Added `subgroup_id` column to `v2_estimate_line_items`
- Added indexes for performance on all hierarchy tables

### Task 2: Create Estimate Templates Schema
- Created `v2_estimate_templates` table with JSONB structure
- Seeded default "Standard Residential" template with 11 phases:
  - Pre-Construction, Foundation, Framing, Dry-In, MEP Rough
  - Insulation, Drywall, Interior Trim, Finishes, MEP Trim, Final
- Each phase includes groups and subgroups matching construction workflow

### Task 3: Add Template Functions
- `apply_estimate_template(p_estimate_id, p_template_id)`: Creates phases/groups/subgroups from template
- `save_estimate_as_template(p_estimate_id, p_name, p_description, p_created_by)`: Saves estimate structure as reusable template

### Task 4: Add Recalculation Triggers
- `trg_recalc_subgroup_subtotal`: Updates subgroup when line items change
- `trg_recalc_group_subtotal`: Updates group when subgroups change
- `trg_recalc_phase_subtotal`: Updates phase when groups change

## Files Created

| File | Lines | Description |
|------|-------|-------------|
| `database/migration-117-estimate-hierarchy.sql` | 388 | Complete hierarchical schema |

## Database Objects Created

### Tables
- `v2_estimate_phases` - Construction phases within estimates
- `v2_estimate_groups` - Groups within phases
- `v2_estimate_subgroups` - Subgroups within groups
- `v2_estimate_templates` - Reusable estimate structures

### Columns Added
- `v2_estimate_line_items.subgroup_id` - FK to subgroups

### Functions
- `apply_estimate_template()` - Apply template to estimate
- `save_estimate_as_template()` - Save estimate as template

### Triggers
- `trg_recalc_subgroup_subtotal` - Cascade line_total to subgroup
- `trg_recalc_group_subtotal` - Cascade subtotal to group
- `trg_recalc_phase_subtotal` - Cascade subtotal to phase

### Indexes
- `idx_estimate_phases_estimate` - Phase lookup by estimate
- `idx_estimate_groups_phase` - Group lookup by phase
- `idx_estimate_subgroups_group` - Subgroup lookup by group
- `idx_estimate_line_items_subgroup` - Line item lookup by subgroup

## Verification Checklist

- [x] `v2_estimate_phases` table exists with columns
- [x] `v2_estimate_groups` table exists with `phase_id` FK
- [x] `v2_estimate_subgroups` table exists with `group_id` FK
- [x] `v2_estimate_line_items` has `subgroup_id` column
- [x] `v2_estimate_templates` has default residential template
- [x] `apply_estimate_template()` function created
- [x] `save_estimate_as_template()` function created
- [x] Subtotal triggers implemented for cascade

## Duration

~5 minutes

## Next Steps

Plan 106-02: Hierarchical API Endpoints - CRUD operations for phases/groups/subgroups and template management endpoints.
