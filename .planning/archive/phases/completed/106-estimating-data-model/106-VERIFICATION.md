---
phase: 106-estimating-data-model
verified: 2026-01-22T20:15:00Z
status: passed
score: 11/11 must-haves verified
---

# Phase 106: Estimating Data Model & Architecture Verification Report

**Phase Goal:** New database schema for hierarchical estimates with assemblies, sections, and items
**Verified:** 2026-01-22T20:15:00Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | v2_estimate_sections table exists for grouping line items into sections | VERIFIED | migration-117 lines 7-20: CREATE TABLE v2_estimate_sections with estimate_id, name, sort_order, subtotal columns |
| 2 | v2_assembly_templates and v2_assembly_template_items tables exist for reusable templates | VERIFIED | migration-117 lines 25-54: Both tables created with proper columns and foreign keys |
| 3 | v2_estimate_lines has section_id, is_allowance, allowance_notes, and template_id columns | VERIFIED | migration-117 lines 60-79: ALTER TABLE statements add all 4 columns with appropriate constraints |
| 4 | v2_estimates has separate overhead_percent/amount and profit_percent/amount columns | VERIFIED | migration-117 lines 85-96: ALTER TABLE adds all 4 markup columns |
| 5 | v2_estimates status constraint includes 'sent' for client delivery workflow | VERIFIED | migration-117 lines 107-121: CHECK constraint includes 'sent' status |
| 6 | v2_estimate_versions table exists for tracking estimate version history | VERIFIED | migration-117 lines 133-159: Table with estimate_id, version_number, snapshot_data JSONB, change_summary |
| 7 | Estimate totals calculate correctly with separate overhead, profit, and contingency | VERIFIED | migration-118 lines 17-92: recalculate_estimate_totals_v3 function implements correct calculation order |
| 8 | Section subtotals auto-update when line items change | VERIFIED | migration-118 lines 97-115, 246-251, 287-290: update_section_subtotal function called by trigger |
| 9 | Assembly template expansion creates properly linked line items | VERIFIED | migration-118 lines 143-218: expand_assembly_template creates header with parent_line_id linked children |
| 10 | Calculation order is documented: subtotal -> overhead -> profit -> contingency | VERIFIED | migration-118 lines 6-15: Comment block documents full calculation order |
| 11 | Estimate versions can be created and retrieved for history tracking | VERIFIED | migration-118 lines 350-491: create_estimate_version, get_estimate_version, list_estimate_versions functions |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `database/migration-117-estimating-data-model.sql` | Schema migration for estimating data model | VERIFIED | 167 lines, creates tables v2_estimate_sections, v2_assembly_templates, v2_assembly_template_items, v2_estimate_versions and extends v2_estimates, v2_estimate_lines |
| `database/migration-118-estimating-functions.sql` | Database functions for estimate calculations | VERIFIED | 493 lines, contains recalculate_estimate_totals_v3, update_section_subtotal, expand_assembly_template, create_estimate_version, get_estimate_version, list_estimate_versions functions plus 4 triggers |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| v2_estimate_lines.section_id | v2_estimate_sections.id | foreign key | VERIFIED | migration-117 line 61: "REFERENCES v2_estimate_sections(id) ON DELETE SET NULL" |
| v2_estimate_lines.template_id | v2_assembly_templates.id | foreign key | VERIFIED | migration-117 line 70: "REFERENCES v2_assembly_templates(id) ON DELETE SET NULL" |
| v2_estimate_versions.estimate_id | v2_estimates.id | foreign key | VERIFIED | migration-117 line 135: "REFERENCES v2_estimates(id) ON DELETE CASCADE" |
| v2_estimate_lines INSERT/UPDATE/DELETE | recalculate_estimate_totals_v3 | trigger | VERIFIED | migration-118 lines 287-290: "AFTER INSERT OR UPDATE OR DELETE ON v2_estimate_lines" |
| v2_estimate_lines INSERT/UPDATE/DELETE | update_section_subtotal | trigger | VERIFIED | migration-118 lines 246-251: trigger_estimate_line_changed_v3 calls update_section_subtotal |
| create_estimate_version function | v2_estimate_versions table | INSERT | VERIFIED | migration-118 lines 396-416: "INSERT INTO v2_estimate_versions" |

### Requirements Coverage

| Requirement | Status | Supporting Evidence |
|-------------|--------|---------------------|
| EST-01: Estimates have sections | SATISFIED | v2_estimate_sections table with estimate_id FK |
| EST-02: Sections contain line items with cost codes, quantities, units, costs | SATISFIED | v2_estimate_lines extended with section_id FK |
| EST-03: Assemblies are reusable templates that expand into multiple items | SATISFIED | v2_assembly_templates + expand_assembly_template function |
| EST-04: Items can be marked as allowances | SATISFIED | is_allowance boolean and allowance_notes columns on v2_estimate_lines |
| EST-05: Estimates track markup (overhead %, profit %, contingency %) | SATISFIED | Separate overhead_percent/amount, profit_percent/amount columns on v2_estimates |
| EST-06: Estimates have versions and status workflow | SATISFIED | v2_estimate_versions table + status constraint includes 'sent' |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

Both migration files are substantive implementations with no placeholder code, TODO comments, or stub patterns detected.

### Human Verification Required

None required. All schema elements can be verified programmatically by inspecting migration SQL files.

### Gaps Summary

No gaps found. All must-haves from both plans are fully implemented:

**Schema (migration-117):**
- v2_estimate_sections table with estimate_id, name, sort_order, subtotal
- v2_assembly_templates table with name, category, is_active
- v2_assembly_template_items table with template_id, cost_code_id, description, quantity, unit_cost
- v2_estimate_lines extended with section_id, is_allowance, allowance_notes, template_id
- v2_estimates extended with overhead_percent/amount, profit_percent/amount, version
- Status constraint updated to include 'sent'
- v2_estimate_versions table with snapshot_data JSONB

**Functions (migration-118):**
- recalculate_estimate_totals_v3 - separate markup calculation with documented order
- update_section_subtotal / update_all_section_subtotals - section subtotal management
- expand_assembly_template - template expansion into linked line items
- create_estimate_version / get_estimate_version / list_estimate_versions - version management
- Triggers for automatic recalculation on line/markup changes

---

*Verified: 2026-01-22T20:15:00Z*
*Verifier: Claude (gsd-verifier)*
