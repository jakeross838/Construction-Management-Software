# Phase 106: Estimating Data Model & Architecture - Research

**Researched:** 2026-01-22
**Domain:** PostgreSQL Database Schema Design for Construction Estimating
**Confidence:** HIGH

## Summary

This phase designs a new hierarchical database schema for construction estimates supporting sections, assemblies, line items, allowances, markups, versioning, and status workflows. The existing v2_estimates system provides a foundation but lacks dedicated section tables, proper assembly templates, allowance flags, and separate overhead/profit/contingency tracking.

**Key findings:**
1. The current schema uses a flat line items model with parent_line_id for inline assemblies, but lacks dedicated section grouping and reusable assembly templates
2. Industry best practice uses three-tier hierarchy: Estimate -> Sections -> Items, with assemblies as reusable templates that expand into items
3. Markups should be tracked separately (overhead %, profit %, contingency %) rather than combined into a single markup_percent

**Primary recommendation:** Create new v2_estimate_sections table for organizational groupings, v2_assembly_templates and v2_assembly_template_items for reusable templates, and add is_allowance flag to line items. Extend existing markup columns to separate overhead/profit/contingency.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ | Database | Supabase standard, supports CTEs and recursive queries |
| Supabase | Current | Backend | Project standard for PostgreSQL hosting and API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ltree extension | PG native | Hierarchical path queries | Optional for deep hierarchy querying |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Self-referencing parent_id | Closure table | More complex but faster for deep trees - not needed here |
| ltree paths | Adjacency list | Simpler, sufficient for 3-level hierarchy |

## Architecture Patterns

### Recommended Database Structure

```
Estimates Hierarchy:
v2_estimates (header)
    |
    +-- v2_estimate_sections (organizational groups)
    |       |
    |       +-- v2_estimate_lines (individual items)
    |               |
    |               +-- (parent_line_id for assembly children)
    |
    +-- Markups (overhead_percent, profit_percent, contingency_percent)
    +-- Versioning (version, parent_estimate_id)

Assembly Templates (reusable):
v2_assembly_templates (template header)
    |
    +-- v2_assembly_template_items (template line items)
```

### Pattern 1: Section-Based Line Items

**What:** Estimates contain sections, sections contain line items
**When to use:** All estimates - provides organizational structure like construction phases

**Schema:**
```sql
-- Sections table
CREATE TABLE v2_estimate_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Site Work", "Framing", "Finishes", etc.
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  subtotal DECIMAL(14,2) DEFAULT 0,  -- Cached sum of items
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Line items with section reference
ALTER TABLE v2_estimate_lines
  ADD COLUMN section_id UUID REFERENCES v2_estimate_sections(id) ON DELETE SET NULL;
```

### Pattern 2: Reusable Assembly Templates

**What:** Master templates that expand into multiple line items when applied
**When to use:** Common bundles like "Standard Bathroom", "Kitchen Package"

**Schema:**
```sql
-- Template headers
CREATE TABLE v2_assembly_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- "Bathrooms", "Kitchens", "Framing", etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template items that get cloned into estimates
CREATE TABLE v2_assembly_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES v2_assembly_templates(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);
```

### Pattern 3: Allowance Flag on Items

**What:** Flag to distinguish placeholder amounts from fixed-price items
**When to use:** Items client will select later (flooring, fixtures, appliances)

**Schema:**
```sql
ALTER TABLE v2_estimate_lines
  ADD COLUMN is_allowance BOOLEAN DEFAULT false,
  ADD COLUMN allowance_notes TEXT;  -- "Client to select from catalog"
```

### Pattern 4: Separate Markup Tracking

**What:** Track overhead, profit, and contingency as separate percentages
**When to use:** All estimates - industry standard separation

**Schema:**
```sql
-- Current: markup_percent, contingency_percent
-- Extended:
ALTER TABLE v2_estimates
  ADD COLUMN overhead_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN overhead_amount DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN profit_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN profit_amount DECIMAL(12,2) DEFAULT 0;
  -- contingency_percent/amount already exists
```

**Calculation Order:**
```
subtotal = sum(line_items)
overhead_amount = subtotal * (overhead_percent / 100)
profit_amount = (subtotal + overhead_amount) * (profit_percent / 100)
contingency_amount = subtotal * (contingency_percent / 100)
grand_total = subtotal + overhead_amount + profit_amount + contingency_amount
```

### Pattern 5: Version and Status Workflow

**What:** Track estimate versions and status transitions
**When to use:** All estimates

**Existing columns to preserve:**
- version INTEGER DEFAULT 1
- parent_estimate_id UUID (for version chain)
- status TEXT (draft, sent, approved, converted)

**Enhanced status workflow:**
```
draft -> sent -> approved -> converted (to budget)
         |
         +-> rejected -> draft (revision)
```

### Anti-Patterns to Avoid

- **Deeply nested assemblies:** Keep to 2 levels max (assembly header + children). Deeper nesting complicates calculations and UI.
- **Duplicating section logic in parent_line_id:** Sections are organizational; assemblies are bundled items. Don't conflate them.
- **Calculating totals in application only:** Use database triggers for integrity; cache calculated values.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hierarchical queries | Custom tree traversal | PostgreSQL WITH RECURSIVE CTEs | Optimized, handles cycles |
| Sum calculations | Manual JS loops | Database triggers | Atomic, consistent |
| Version tracking | Custom version table | parent_estimate_id chain | Already implemented |
| Decimal precision | JavaScript floats | DECIMAL(14,2) PostgreSQL | Financial accuracy |

**Key insight:** PostgreSQL's WITH RECURSIVE handles hierarchical queries efficiently. Don't implement tree traversal in JavaScript.

## Common Pitfalls

### Pitfall 1: Orphaned Line Items After Section Deletion

**What goes wrong:** Deleting a section leaves line items without a section
**Why it happens:** CASCADE vs SET NULL foreign key choice
**How to avoid:** Use ON DELETE SET NULL for section_id, items remain but unassigned
**Warning signs:** Items disappearing or null section errors in UI

### Pitfall 2: Circular Assembly References

**What goes wrong:** Assembly A contains Assembly B which contains Assembly A
**Why it happens:** Allowing assemblies to contain other assemblies
**How to avoid:** Only allow regular items within assemblies (no nested assemblies)
**Warning signs:** Infinite loops in total calculation

### Pitfall 3: Stale Cached Totals

**What goes wrong:** Section/estimate totals don't match sum of items
**Why it happens:** Missing or failing trigger on item changes
**How to avoid:** Always update parent totals via trigger on INSERT/UPDATE/DELETE
**Warning signs:** UI totals not matching manual calculations

### Pitfall 4: Markup Calculation Order Confusion

**What goes wrong:** Different total when applying markups in different order
**Why it happens:** Overhead on cost, then profit on (cost + overhead) vs all on cost
**How to avoid:** Document calculation order clearly, use consistent formula
**Warning signs:** Estimates don't match expected margins

### Pitfall 5: Template Item Price Staleness

**What goes wrong:** Template prices become outdated
**Why it happens:** No link from template items to actual material prices
**How to avoid:** Link template items to catalog/cost codes, update from source
**Warning signs:** Estimates significantly under/over market prices

## Code Examples

Verified patterns from official sources and existing codebase:

### Creating Section with Items
```sql
-- Create section
INSERT INTO v2_estimate_sections (estimate_id, name, sort_order)
VALUES ($1, 'Site Work', 1)
RETURNING id;

-- Add items to section
INSERT INTO v2_estimate_lines (
  estimate_id, section_id, cost_code_id,
  description, quantity, unit, unit_cost, amount
)
VALUES ($1, $2, $3, 'Grading and Excavation', 1, 'LS', 15000, 15000);
```

### Expanding Assembly Template into Estimate
```sql
-- Copy template items as new estimate lines
INSERT INTO v2_estimate_lines (
  estimate_id, section_id, cost_code_id, description,
  quantity, unit, unit_cost, amount,
  source, template_id, parent_line_id
)
SELECT
  $estimate_id,
  $section_id,
  ati.cost_code_id,
  ati.description,
  ati.quantity,
  ati.unit,
  ati.unit_cost,
  ati.quantity * ati.unit_cost,
  'template',
  at.id,
  $assembly_header_id  -- The header line created for this assembly instance
FROM v2_assembly_template_items ati
JOIN v2_assembly_templates at ON ati.template_id = at.id
WHERE at.id = $template_id
ORDER BY ati.sort_order;
```

### Calculating Estimate Totals with Separate Markups
```sql
CREATE OR REPLACE FUNCTION recalculate_estimate_totals_v2(p_estimate_id UUID)
RETURNS void AS $$
DECLARE
  v_subtotal DECIMAL(14,2);
  v_overhead_pct DECIMAL(5,2);
  v_profit_pct DECIMAL(5,2);
  v_contingency_pct DECIMAL(5,2);
  v_overhead_amt DECIMAL(14,2);
  v_profit_amt DECIMAL(14,2);
  v_contingency_amt DECIMAL(14,2);
  v_grand_total DECIMAL(14,2);
BEGIN
  -- Sum all line items (excluding assembly header lines to avoid double-counting)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_subtotal
  FROM v2_estimate_lines
  WHERE estimate_id = p_estimate_id
    AND parent_line_id IS NULL;  -- Only top-level items

  -- Get markup percentages
  SELECT overhead_percent, profit_percent, contingency_percent
  INTO v_overhead_pct, v_profit_pct, v_contingency_pct
  FROM v2_estimates
  WHERE id = p_estimate_id;

  -- Calculate markups
  v_overhead_amt := v_subtotal * COALESCE(v_overhead_pct, 0) / 100;
  v_profit_amt := (v_subtotal + v_overhead_amt) * COALESCE(v_profit_pct, 0) / 100;
  v_contingency_amt := v_subtotal * COALESCE(v_contingency_pct, 0) / 100;
  v_grand_total := v_subtotal + v_overhead_amt + v_profit_amt + v_contingency_amt;

  -- Update estimate
  UPDATE v2_estimates
  SET
    subtotal = v_subtotal,
    overhead_amount = v_overhead_amt,
    profit_amount = v_profit_amt,
    contingency_amount = v_contingency_amt,
    total_amount = v_grand_total,
    updated_at = NOW()
  WHERE id = p_estimate_id;

  -- Update section subtotals
  UPDATE v2_estimate_sections sec
  SET subtotal = (
    SELECT COALESCE(SUM(amount), 0)
    FROM v2_estimate_lines
    WHERE section_id = sec.id
      AND parent_line_id IS NULL
  )
  WHERE sec.estimate_id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;
```

### Version Comparison Query
```sql
-- Get line-by-line comparison between two estimate versions
WITH v1 AS (
  SELECT cost_code_id, description, amount
  FROM v2_estimate_lines
  WHERE estimate_id = $version1_id
),
v2 AS (
  SELECT cost_code_id, description, amount
  FROM v2_estimate_lines
  WHERE estimate_id = $version2_id
)
SELECT
  COALESCE(v1.description, v2.description) as description,
  v1.amount as v1_amount,
  v2.amount as v2_amount,
  COALESCE(v2.amount, 0) - COALESCE(v1.amount, 0) as difference
FROM v1 FULL OUTER JOIN v2
  ON v1.cost_code_id = v2.cost_code_id
ORDER BY description;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single markup % | Separate overhead/profit/contingency | Industry standard | Better financial visibility |
| Flat line items | Section grouping | Modern software | Better organization |
| Manual assembly creation | Reusable templates | 2020s | Faster estimate creation |
| Excel-based | Database-driven | 2015+ | Better versioning, collaboration |

**Deprecated/outdated:**
- Combined markup_percent: Keep for backward compatibility but add separate fields
- Storing assemblies only as is_assembly flag: Need proper template table for reuse

## Existing Schema Analysis

### Current v2_estimates Table
- Has: id, job_id, title, version, parent_estimate_id, status, total_amount, markup_percent, contingency_percent
- Missing: overhead_percent/amount, profit_percent/amount (separate from combined markup)
- Status: submitted vs 'sent' - need to align with requirements

### Current v2_estimate_lines Table
- Has: id, estimate_id, cost_code_id, description, quantity, unit, unit_cost, amount
- Has: parent_line_id, is_assembly, hide_components_from_client (inline assemblies)
- Missing: section_id, is_allowance, template_id (for tracing source)

### Current v2_estimate_assemblies Table (migration-084)
- Exists but represents per-estimate assemblies, not reusable templates
- Links to line items via v2_estimate_assembly_items

### Allowances Table (v2_allowances)
- Separate concept - budget per job per category for client selections
- NOT the same as estimate line item allowances (placeholder amounts)
- Estimate line items can BE allowances (is_allowance flag) for pricing

## Migration Strategy

### Phase 1: Add New Tables (Non-breaking)
1. Create v2_estimate_sections table
2. Create v2_assembly_templates table
3. Create v2_assembly_template_items table

### Phase 2: Extend Existing Tables (Non-breaking)
1. Add section_id to v2_estimate_lines (nullable)
2. Add is_allowance, allowance_notes to v2_estimate_lines
3. Add template_id to v2_estimate_lines (for tracing)
4. Add overhead_percent, overhead_amount to v2_estimates
5. Add profit_percent, profit_amount to v2_estimates
6. Update status CHECK constraint to include 'sent'

### Phase 3: Create/Update Functions
1. Update recalculate function for new markup fields
2. Create section subtotal update trigger
3. Create function to expand assembly template into lines

### Phase 4: Seed Template Data
1. Create common assembly templates (Standard Bathroom, Basic Kitchen, etc.)

## Data Integrity Concerns

### Cascade Rules
| Parent | Child | On Delete |
|--------|-------|-----------|
| v2_estimates | v2_estimate_sections | CASCADE |
| v2_estimates | v2_estimate_lines | CASCADE |
| v2_estimate_sections | v2_estimate_lines.section_id | SET NULL |
| v2_assembly_templates | v2_assembly_template_items | CASCADE |

### Constraints
- section_id can be NULL (lines can exist without section)
- cost_code_id can be NULL (custom items without cost code)
- template_id can be NULL (not from template)
- is_allowance defaults to false
- sort_order defaults to 0

### Indexes Needed
```sql
CREATE INDEX idx_estimate_sections_estimate ON v2_estimate_sections(estimate_id);
CREATE INDEX idx_estimate_lines_section ON v2_estimate_lines(section_id);
CREATE INDEX idx_assembly_template_items_template ON v2_assembly_template_items(template_id);
```

## Open Questions

Things that couldn't be fully resolved:

1. **Assembly Template Versioning**
   - What we know: Templates can change over time
   - What's unclear: Should old estimates reference template version or snapshot?
   - Recommendation: Copy template items at expansion time (current approach), don't link to template for ongoing sync

2. **Section Ordering across Cost Codes**
   - What we know: Sections group by phase (Site Work, Framing, etc.)
   - What's unclear: Can a single cost code appear in multiple sections?
   - Recommendation: Allow multiple sections per cost code (same cost code can be in Site Work and Landscaping sections)

3. **Status 'submitted' vs 'sent'**
   - What we know: Current schema uses 'submitted', requirements say 'sent'
   - What's unclear: Are these equivalent or different workflow states?
   - Recommendation: Treat as synonyms, use 'sent' for client-facing consistency

## Sources

### Primary (HIGH confidence)
- Existing codebase: migration-041-estimates.sql, migration-042-estimate-assemblies.sql
- Existing codebase: migration-084-selection-driven-estimation.sql, migration-085 extension
- Existing codebase: server/routes/estimates.js (current API implementation)

### Secondary (MEDIUM confidence)
- PostgreSQL hierarchical data patterns: [Ackee Blog](https://www.ackee.agency/blog/hierarchical-models-in-postgresql)
- Construction markup calculations: [Building Advisor](https://buildingadvisor.com/project-management/bidding/pricing-the-job-overhead-markup/)
- Construction contingency guide: [Buildertrend](https://buildertrend.com/blog/construction-contingency/)
- Assembly best practices: [Beck Technology](https://www.beck-technology.com/blog/how-to-build-assemblies-tips-and-tricks)

### Tertiary (LOW confidence)
- Industry benchmark markups (20-35% typical) - needs validation against local market

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing PostgreSQL/Supabase stack
- Architecture: HIGH - Based on existing schema analysis and industry patterns
- Pitfalls: HIGH - Based on existing codebase and common SQL patterns

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (schema design is stable)
