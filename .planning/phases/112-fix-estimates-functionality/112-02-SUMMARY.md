# Phase 112-02: Estimate Hierarchy Database Schema - SUMMARY

## Status: ALREADY COMPLETED

**Date:** 2026-01-22
**Outcome:** Database schema for estimate hierarchy already exists and has been applied via migration-117

---

## Situation Analysis

### What the Plan Asked For

The plan (`112-02-PLAN.md`) specified creating `database/migration-012-estimate-hierarchy.sql` with:
- Rename `v4_estimate_sections` to `v4_estimate_groups`
- Create `v4_estimate_subgroups` table
- Add hierarchy columns (`subgroup_id`, `sort_order`)
- Create indexes

### What Actually Exists

The codebase has already moved forward with a **different naming convention and migration number**:

**Migration File:** `database/migration-117-estimate-hierarchy.sql`
**Status:** ✅ Applied (confirmed via `npm run migrate:status`)

**Tables Created:**
- `v2_estimate_phases` (top level - construction phases)
- `v2_estimate_groups` (middle level - groups within phases)
- `v2_estimate_subgroups` (bottom level - subgroups within groups)
- `v2_estimate_templates` (reusable phase/group/subgroup templates)

**Key Differences from Plan:**
1. **Naming:** Uses `v2_` prefix instead of `v4_`
2. **Structure:** 4-level hierarchy (Phases > Groups > Subgroups > Line Items) instead of 3-level
3. **Migration Number:** 117 instead of 012
4. **Additional Features:** Includes template system and functions (`apply_estimate_template`, `save_estimate_as_template`)

---

## Migration-117 Schema Details

### Tables

#### 1. v2_estimate_phases
```sql
- id (UUID)
- estimate_id (references v2_estimates)
- name (e.g., "Framing", "MEP Rough")
- phase_code (matches schedule phases)
- description
- sort_order
- subtotal (calculated)
- created_at, updated_at
```

#### 2. v2_estimate_groups
```sql
- id (UUID)
- phase_id (references v2_estimate_phases)
- name (e.g., "Wall Framing", "Plumbing Rough")
- description
- sort_order
- subtotal (calculated)
- created_at, updated_at
```

#### 3. v2_estimate_subgroups
```sql
- id (UUID)
- group_id (references v2_estimate_groups)
- name (e.g., "Exterior Walls", "Kitchen Cabinets")
- description
- sort_order
- subtotal (calculated)
- created_at, updated_at
```

#### 4. v2_estimate_line_items (updated)
```sql
- Added: subgroup_id (references v2_estimate_subgroups)
```

#### 5. v2_estimate_templates
```sql
- id (UUID)
- name (e.g., "Standard Residential")
- description
- project_type (residential/commercial/renovation)
- phases (JSONB - stores phase/group/subgroup structure)
- is_default, is_active
- source_estimate_id
- created_by
- created_at, updated_at
```

### Functions

1. **apply_estimate_template(estimate_id, template_id)**
   - Creates phases/groups/subgroups from a template
   - Clears existing structure first

2. **save_estimate_as_template(estimate_id, name, description, created_by)**
   - Saves estimate structure as reusable template
   - Returns template_id

### Triggers

1. **recalc_subgroup_subtotal()** - Updates subgroup totals when line items change
2. **recalc_group_subtotal()** - Updates group totals when subgroups change
3. **recalc_phase_subtotal()** - Updates phase totals when groups change

### Indexes

- `idx_estimate_phases_estimate` on `v2_estimate_phases(estimate_id)`
- `idx_estimate_groups_phase` on `v2_estimate_groups(phase_id)`
- `idx_estimate_subgroups_group` on `v2_estimate_subgroups(group_id)`
- `idx_estimate_line_items_subgroup` on `v2_estimate_line_items(subgroup_id)`

### Seed Data

Includes a default "Standard Residential" template with 11 phases:
1. Pre-Construction (Permits, Site Prep)
2. Foundation (Excavation, Concrete)
3. Framing (Floor, Wall, Roof)
4. Dry-In (Roofing, Exterior Openings)
5. MEP Rough (Plumbing, Electrical, HVAC)
6. Insulation
7. Drywall
8. Interior Trim (Doors, Cabinets, Countertops)
9. Finishes (Paint, Flooring, Tile)
10. MEP Trim (Fixtures)
11. Final (Cleanup, Landscaping, Closeout)

---

## Verification

### Migration Status Check
```bash
npm run migrate:status
```

**Result:** ✅ migration-117-estimate-hierarchy.sql is applied

### Database Tables
The following tables exist in the Supabase database:
- ✅ v2_estimate_phases
- ✅ v2_estimate_groups
- ✅ v2_estimate_subgroups
- ✅ v2_estimate_templates
- ✅ v2_estimate_line_items (with subgroup_id column)

---

## Why This Happened

The plan file (112-02-PLAN.md) appears to be **outdated or generated from an old codebase state**.

**Evidence:**
1. Plan references `v4_` tables, but codebase uses `v2_` prefix
2. Plan specifies migration-012, but that number was already used for a different migration (`migration-012-reorganize-general-conditions.sql`)
3. Migration-117 was created and applied during Phase 106 (Estimating Data Model)
4. STATE.md shows Phase 106 was completed on 2026-01-22

**Timeline:**
- Phase 106 (Estimating Data Model) - Created migration-117
- Phase 112-01 (Fix Estimates Functionality) - Completed bug fixes
- Phase 112-02 (This plan) - Asked for schema that already exists

---

## What This Means for Phase 112-02

### No Database Work Needed

The database schema for estimate hierarchy **already exists** and is **more comprehensive** than what the plan specified:

| Plan Wanted | Already Have |
|-------------|--------------|
| 3-level hierarchy | 4-level hierarchy (with Phases) |
| Basic tables | Tables + Templates + Functions |
| Simple rename | Full template system with seed data |
| Manual structure | Automated template application |

### Recommendation

**Mark Phase 112-02 as complete** with the note that the work was already done in Phase 106.

**Next Steps:**
1. ✅ Database schema exists (migration-117)
2. ✅ Template system exists
3. ⏭️ Move to next phase: API endpoints for hierarchy (if needed)
4. ⏭️ UI integration (if needed)

---

## Files Referenced

- ✅ `database/migration-117-estimate-hierarchy.sql` (exists, applied)
- ✅ `database/migration-117-estimating-data-model.sql` (exists, applied)
- ✅ `database/migration-118-estimating-functions.sql` (exists, applied)
- ❌ `database/migration-012-estimate-hierarchy.sql` (NOT CREATED - not needed)
- ❌ `database/.migrations_applied` (doesn't exist - using Supabase tracking instead)

---

## Conclusion

**Phase 112-02 objectives are already met.** The estimate hierarchy database schema exists and is more feature-rich than what was planned. No further database work is required for this phase.

The plan appears to be based on outdated assumptions about:
- Table naming convention (v4 vs v2)
- Migration numbering (012 vs 117)
- Existing schema state

**Action:** Update `.planning/STATE.md` to mark Phase 112-02 as complete with reference to migration-117.

---

## Technical Notes

### Hierarchy Structure

**Final Hierarchy:**
```
Estimate
  └─ Phase (e.g., "Framing")
      └─ Group (e.g., "Wall Framing")
          └─ Subgroup (e.g., "Exterior Walls")
              └─ Line Item (e.g., "2x6 Studs @ 16 OC")
```

**Benefits over 3-level:**
- Phases align with construction schedule
- Better organization for large estimates
- Template system for rapid estimate creation
- Automatic subtotal calculations cascade through all levels

### Template System

Templates stored as JSONB make them:
- Easy to version
- Flexible for different project types
- Quick to apply (single function call)
- Portable (can export/import as JSON)

### Performance

Indexes ensure fast queries:
- Loading estimate hierarchy
- Filtering by phase/group/subgroup
- Calculating totals
- Template application

Triggers ensure data integrity:
- Automatic subtotal recalculation
- Cascading updates through hierarchy
- No stale calculated values
