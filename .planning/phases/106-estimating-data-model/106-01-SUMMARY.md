---
phase: 106-estimating-data-model
plan: 01
subsystem: database
tags: [postgresql, estimates, sections, assemblies, allowances, versioning, migration]

# Dependency graph
requires:
  - phase: 041-estimates
    provides: Base v2_estimates and v2_estimate_lines tables
  - phase: 042-estimate-assemblies
    provides: parent_line_id and is_assembly columns for inline assemblies
  - phase: 085-selection-driven-estimates
    provides: markup_percent, contingency_percent columns and recalculate functions
provides:
  - v2_estimate_sections table for hierarchical estimate organization
  - v2_assembly_templates and v2_assembly_template_items for reusable templates
  - Allowance tracking (is_allowance, allowance_notes) on estimate lines
  - Separate overhead/profit markup columns on estimates
  - v2_estimate_versions table for snapshot-based version history
  - Status workflow with 'sent' status for client delivery
affects: [106-02-estimating-api, estimates-ui, proposal-generation, budget-conversion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Snapshot-based versioning with JSONB for full state capture
    - Separate markup calculation (overhead -> profit -> contingency)
    - Organizational hierarchy via section_id foreign key

key-files:
  created:
    - database/migration-117-estimating-data-model.sql
  modified: []

key-decisions:
  - "Sections use ON DELETE SET NULL for line items - items remain but become unassigned"
  - "Assembly templates are reusable (not per-estimate) with template_id tracing on lines"
  - "Version snapshots store full JSONB state plus computed totals for quick comparison"
  - "Markup calculation order: subtotal -> overhead -> profit -> contingency = grand_total"
  - "Status constraint includes 'sent' for client delivery workflow"

patterns-established:
  - "Hierarchical estimate structure: Estimate -> Sections -> Items"
  - "Template expansion creates items with template_id for source tracing"
  - "Allowance items flagged separately from fixed-price items"

# Metrics
duration: 3min
completed: 2026-01-22
---

# Phase 106 Plan 01: Estimating Data Model Summary

**Database schema for hierarchical estimates with sections, assembly templates, allowances, separate markups, and version history via migration-117**

## Performance

- **Duration:** 3 min 30 sec
- **Started:** 2026-01-22T19:31:25Z
- **Completed:** 2026-01-22T19:34:55Z
- **Tasks:** 3/3
- **Files modified:** 1

## Accomplishments

- Created v2_estimate_sections table for organizational grouping (Site Work, Framing, Finishes)
- Added v2_assembly_templates and v2_assembly_template_items for reusable template bundles
- Extended v2_estimate_lines with section_id, is_allowance, allowance_notes, template_id
- Added separate overhead_percent/amount and profit_percent/amount to v2_estimates
- Updated status constraint to include 'sent' for client delivery workflow
- Created v2_estimate_versions table with JSONB snapshots for version history
- All migrations applied successfully (117)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create estimate sections table** - `22fcbc3` (feat)
2. **Task 2: Create assembly templates tables and extend estimate_lines** - `ef2f1cb` (feat)
3. **Task 3: Add separate markup columns, status constraint, and version tracking table** - `1936e89` (feat)

## Files Created/Modified

- `database/migration-117-estimating-data-model.sql` - Complete estimating data model migration with 38 SQL statements

## Schema Changes Summary

### New Tables
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| v2_estimate_sections | Organizational groupings | estimate_id, name, sort_order, subtotal |
| v2_assembly_templates | Reusable template headers | name, category, is_active, created_by |
| v2_assembly_template_items | Template line items | template_id, cost_code_id, description, quantity, unit_cost |
| v2_estimate_versions | Version history snapshots | estimate_id, version_number, snapshot_data, change_summary |

### Extended Tables
| Table | New Columns |
|-------|-------------|
| v2_estimate_lines | section_id, is_allowance, allowance_notes, template_id |
| v2_estimates | overhead_percent, overhead_amount, profit_percent, profit_amount, version |

### Status Workflow
- Previous: draft, submitted, approved, rejected, converted
- New: draft, **sent**, submitted, approved, rejected, converted

## Decisions Made

1. **Section deletion handling:** ON DELETE SET NULL - line items remain but become unassigned to any section
2. **Template architecture:** Reusable templates (not per-estimate) that expand into line items with template_id tracking
3. **Version storage:** JSONB snapshot_data with pre-computed totals (subtotal, total_amount, line_count) for quick comparison without JSON parsing
4. **Markup calculation order:** subtotal -> +overhead -> +profit -> +contingency = grand_total

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration applied cleanly with all 38 statements.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Data model foundation complete for estimating v4.0 rebuild
- Ready for Plan 106-02: API endpoints for sections, templates, and version management
- Section/template CRUD operations can now be built
- Version comparison queries ready to implement
- Allowance tracking UI can reference is_allowance flag

---
*Phase: 106-estimating-data-model*
*Completed: 2026-01-22*
