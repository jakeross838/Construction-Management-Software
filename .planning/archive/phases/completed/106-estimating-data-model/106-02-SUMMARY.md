---
phase: 106-estimating-data-model
plan: 02
subsystem: database
tags: [postgresql, estimates, functions, triggers, versioning, calculations, assemblies]

# Dependency graph
requires:
  - phase: 106-01
    provides: v2_estimate_sections, v2_assembly_templates, v2_estimate_versions tables
  - phase: 085-selection-driven-estimates
    provides: recalculate_estimate_with_markup function (base for v3 upgrade)
provides:
  - recalculate_estimate_totals_v3 function with separate overhead/profit/contingency
  - update_section_subtotal and update_all_section_subtotals functions
  - expand_assembly_template function for template expansion into line items
  - create_estimate_version for JSONB snapshot versioning
  - get_estimate_version and list_estimate_versions for retrieval
  - Automatic triggers for line item changes, markup changes, and timestamps
affects: [estimates-ui, estimate-api, proposal-generation, budget-conversion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Automatic totals recalculation via AFTER triggers
    - JSONB snapshot versioning with pre-computed totals
    - Cascading section subtotal updates on line item changes
    - Assembly header sum updates from child line changes

key-files:
  created:
    - database/migration-118-estimating-functions.sql
  modified: []

key-decisions:
  - "Calculation order: subtotal -> overhead (on subtotal) -> profit (on subtotal+overhead) -> contingency (on subtotal)"
  - "Legacy markup_percent supported for backward compatibility when overhead/profit both 0"
  - "Assembly children excluded from estimate totals (parent_line_id IS NULL filter)"
  - "Version snapshots include estimate header, sections, and lines in JSONB"

patterns-established:
  - "Trigger cascade: line change -> section subtotal -> estimate totals -> assembly header"
  - "Version function pattern: create/get/list for snapshot management"
  - "Template expansion creates header (is_assembly=true) with child lines (parent_line_id set)"

# Metrics
duration: 4min
completed: 2026-01-22
---

# Phase 106 Plan 02: Estimating Functions & Triggers Summary

**Database functions and triggers for automatic estimate calculations with separate overhead/profit/contingency markups, section subtotals, assembly expansion, and version history tracking via migration-118**

## Performance

- **Duration:** 4 min
- **Started:** 2026-01-22T19:39:11Z
- **Completed:** 2026-01-22T19:43:01Z
- **Tasks:** 4/4
- **Files modified:** 1

## Accomplishments

- Created recalculate_estimate_totals_v3 with separate overhead, profit, contingency calculation
- Added section subtotal functions (update_section_subtotal, update_all_section_subtotals)
- Implemented expand_assembly_template for creating header + child lines from templates
- Built automatic triggers for line item changes, markup percentage changes, and timestamps
- Created version tracking functions (create_estimate_version, get_estimate_version, list_estimate_versions)
- Migration 118 applied successfully with 28 SQL statements

## Task Commits

Each task was committed atomically:

1. **Task 1: Create estimate totals calculation function** - `3478835` (feat)
2. **Task 2: Create section subtotal and assembly expansion functions** - `a281238` (feat)
3. **Task 3: Create triggers for automatic calculations** - `f1e4c2e` (feat)
4. **Task 4: Create version snapshot function and apply migration** - `6593b4e` (feat)

## Files Created/Modified

- `database/migration-118-estimating-functions.sql` - 492 lines with all calculation functions, triggers, and version management

## Functions Summary

| Function | Purpose | Returns |
|----------|---------|---------|
| recalculate_estimate_totals_v3 | Calculate estimate with separate markups | void |
| update_section_subtotal | Update single section subtotal | void |
| update_all_section_subtotals | Update all sections for estimate | void |
| expand_assembly_template | Create lines from template | UUID (header id) |
| create_estimate_version | Create JSONB snapshot | UUID (version id) |
| get_estimate_version | Retrieve specific/latest version | TABLE |
| list_estimate_versions | List all versions for history | TABLE |

## Triggers Summary

| Trigger | Table | Event | Action |
|---------|-------|-------|--------|
| trigger_estimate_line_changed_v3 | v2_estimate_lines | INSERT/UPDATE/DELETE | Update sections, totals, assembly headers |
| trigger_estimate_markup_changed | v2_estimates | UPDATE (markup columns) | Recalculate totals |
| trigger_update_section_timestamp | v2_estimate_sections | UPDATE | Set updated_at |
| trigger_update_assembly_template_timestamp | v2_assembly_templates | UPDATE | Set updated_at |

## Calculation Logic

```
subtotal = SUM(line amounts WHERE parent_line_id IS NULL)
overhead_amount = subtotal * overhead_percent / 100
profit_amount = (subtotal + overhead_amount) * profit_percent / 100
contingency_amount = subtotal * contingency_percent / 100
total_amount = subtotal + overhead + profit + contingency
```

## Decisions Made

1. **Calculation order:** overhead applied to subtotal, profit applied to (subtotal + overhead), contingency applied to subtotal
2. **Backward compatibility:** Legacy markup_percent used when both overhead_percent and profit_percent are 0
3. **Assembly handling:** Child lines (parent_line_id IS NOT NULL) excluded from estimate totals to avoid double-counting
4. **Version snapshots:** Full JSONB with pre-computed totals for quick comparison without parsing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - migration applied cleanly with all 28 statements.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Estimating data model complete for v4.0 rebuild
- All calculation functions ready for API integration
- Version tracking enables estimate history UI
- Assembly template expansion supports quick estimate building
- Triggers ensure data integrity without manual recalculation

---
*Phase: 106-estimating-data-model*
*Completed: 2026-01-22*
