# Phase 108: Selections, Allowances & Client Approval - Research

**Researched:** 2026-01-22
**Domain:** Client selection workflow, allowance management, approval workflows
**Confidence:** HIGH

## Summary

Phase 108 connects the existing selections/allowances system (from v2.1 milestones) with the new estimating data model (Phase 106) to enable a complete allowance-to-selection workflow. The codebase already has substantial infrastructure for selections: `v2_selections`, `v2_allowances`, `v2_selection_catalog`, and comprehensive API routes in `server/routes/selections.js`.

**Key findings:**
1. The existing selections system is mature - v2_allowances, v2_selections, v2_selection_catalog tables with full CRUD, variance tracking, status history, and change order creation
2. Phase 106 adds `is_allowance` flag to `v2_estimate_lines` - this needs to be linked to the selections system when estimates convert to contracts
3. Client approval workflow needs a simple checkbox-based approval with timestamp/IP tracking (not full digital signature - that's Phase 78 contracts)
4. Existing v2_selections already has status workflow: pending -> selected -> approved -> ordered -> installed

**Primary recommendation:** Bridge estimate allowances to the existing selections system via a conversion function, add client approval fields to v2_selections, and create a client-facing selection view with role-based access (client can view/select, admin can approve/manage).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 15+ | Database | Project standard via Supabase |
| Supabase | Current | Backend/Auth | Project standard for API and auth |
| Express | 4.x | API routes | Existing `/api/selections/*` routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | Native | Unique IDs | Standard in all tables |
| JSONB | Native | Audit data | For storing snapshot/history data |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple checkbox approval | DocuSign/e-signature | Overkill for selections - save for contracts (Phase 78) |
| Single approval field | Multi-party workflow | Complexity not needed - one client approves |
| Separate client app | Role-based same app | User decided: same app, different permissions |

## Architecture Patterns

### Recommended Project Structure
```
src/
  server/
    routes/
      selections.js          # Existing, extend with client endpoints
  public/
    selections.html          # Existing, add client approval view
    js/
      selections.js          # Existing, extend with approval functions
  database/
    migration-XXX-selections-allowances-phase108.sql
```

### Pattern 1: Estimate Allowance to Selection Conversion

**What:** When an estimate is approved/converted, allowance line items create entries in v2_allowances linked to the job
**When to use:** Estimate approval workflow

**Flow:**
```
v2_estimate_lines (is_allowance=true)
    |
    | Estimate approved
    |
    v
v2_allowances (per job, per category)
    |
    | Client makes selection
    |
    v
v2_selections (actual item chosen)
    |
    | Over budget?
    |
    v
v2_job_change_orders (if post-contract)
```

**Schema bridge:**
```sql
-- Add estimate_line_id to track which estimate line created this allowance
ALTER TABLE v2_allowances
  ADD COLUMN IF NOT EXISTS estimate_line_id UUID REFERENCES v2_estimate_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allowances_estimate_line ON v2_allowances(estimate_line_id);
```

### Pattern 2: Client Approval Fields

**What:** Add approval tracking directly to v2_selections for simple "client approved" workflow
**When to use:** All selection approvals

**Schema:**
```sql
-- Existing columns to use:
-- approved_at TIMESTAMPTZ
-- approved_by TEXT

-- Add for richer tracking:
ALTER TABLE v2_selections
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS client_approval_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_approval_method TEXT CHECK (client_approval_method IN ('checkbox', 'signature', 'email')),
  ADD COLUMN IF NOT EXISTS client_approval_notes TEXT;
```

### Pattern 3: Role-Based Selection View

**What:** Same selections page, different capabilities by role
**When to use:** Client vs admin access to selections

**Existing pattern from `data-role-min="client"`:**
```html
<!-- Already in selections.html -->
<body data-page-context="job" data-page-id="selections" data-page-group="precon" data-role-min="client">
```

**Role capabilities:**
| Role | Can View | Can Select | Can Approve | Can Edit Allowance |
|------|----------|------------|-------------|-------------------|
| Client | Own job only | Yes | Own selections | No |
| PM | All jobs | Yes | Yes | Yes |
| Admin | All jobs | Yes | Yes | Yes |

### Pattern 4: Variance-Triggered Change Order

**What:** When selection exceeds allowance and job is post-contract, prompt for change order
**When to use:** Selection overage after contract signed

**Existing implementation in `selections.js`:**
```javascript
// POST /api/selections/items/:id/create-co already exists
// Creates v2_change_orders entry, links to selection
```

**Enhancement needed:**
- Detect "post-contract" state (job has signed contract or is in construction phase)
- Auto-prompt vs manual CO creation based on company settings

### Pattern 5: Selection Status History (Audit Trail)

**What:** Track all status changes with who/when/what
**When to use:** All selection status transitions

**Already exists:** `v2_selection_status_history` table
```sql
-- From migration-056:
CREATE TABLE v2_selection_status_history (
  id UUID PRIMARY KEY,
  selection_id UUID REFERENCES v2_selections(id),
  from_status TEXT,
  to_status TEXT,
  changed_by TEXT,
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Anti-Patterns to Avoid

- **Separate client portal:** User decided role-based access within same app, not separate portal
- **Complex approval chains:** Keep it simple - one client approval per selection, not multi-party
- **Over-engineering digital signatures:** Simple checkbox + timestamp is sufficient for selections; full e-signature is for contracts
- **Duplicate selection data:** Don't copy selection details - reference v2_selection_catalog

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Selection CRUD | New tables/routes | Existing `/api/selections/*` | Mature, tested, feature-complete |
| Variance calculation | Manual JS math | Database triggers | `update_allowance_totals()` already exists |
| Status transitions | Custom logic | Existing status endpoint | `POST /items/:id/status` handles workflow |
| Change order creation | New CO system | Existing `/items/:id/create-co` | Handles overage calculation, PO linking |
| Catalog browsing | New product page | Existing catalog view | Full filtering, search, images in place |

**Key insight:** The v2.1 selections system is 90% complete. Phase 108 is primarily about bridging to estimates and adding client approval UX.

## Common Pitfalls

### Pitfall 1: Orphaned Allowances After Estimate Changes

**What goes wrong:** Estimate allowance changed/deleted but v2_allowances not updated
**Why it happens:** Missing synchronization between estimate lines and allowances
**How to avoid:** Create explicit "allowance sync" function, not automatic triggers
**Warning signs:** Allowance amounts don't match estimate

### Pitfall 2: Double-Counting Variance

**What goes wrong:** Selection variance counted in both allowance and change order
**Why it happens:** CO created from overage but allowance variance still shows
**How to avoid:** Clear workflow - CO absorbs the variance, allowance shows original budget
**Warning signs:** Financial reports don't balance

### Pitfall 3: Client Sees Internal Notes

**What goes wrong:** `internal_notes` field exposed in client view
**Why it happens:** Single API endpoint serving both roles
**How to avoid:** Role-based response filtering in API
**Warning signs:** Client asks about notes they shouldn't see

### Pitfall 4: Post-Contract Selection Without CO

**What goes wrong:** Client makes selection over budget after contract, no CO created
**Why it happens:** No enforcement of CO workflow
**How to avoid:** Either auto-create CO or block selection until overage acknowledged
**Warning signs:** Budget overruns not tracked as change orders

### Pitfall 5: Approval Without Selection

**What goes wrong:** Allowance marked "complete" but no actual selection recorded
**Why it happens:** Status changed manually, not via selection workflow
**How to avoid:** Status transitions validate data state (complete requires selection)
**Warning signs:** "Complete" allowances with $0 selected

## Code Examples

Verified patterns from existing codebase:

### Creating Selection from Catalog (existing pattern)
```javascript
// From selections.js - POST /api/selections/items
const { data, error } = await supabase
  .from('v2_selections')
  .insert({
    allowance_id,
    catalog_item_id,
    name,
    description,
    model_number,
    vendor_name,
    quantity: qty,
    unit: unit || 'each',
    unit_price: price,
    total_price,
    markup_percent: markup,
    markup_amount,
    final_price,
    image_url,
    client_notes,
    internal_notes
  })
  .select()
  .single();

// Record status history
await supabase.from('v2_selection_status_history').insert({
  selection_id: data.id,
  to_status: 'pending',
  notes: 'Selection created'
});
```

### Client Approval (new pattern to implement)
```javascript
// POST /api/selections/items/:id/client-approve
router.post('/items/:id/client-approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by, notes, ip_address } = req.body;

  // Get current selection
  const { data: current } = await supabase
    .from('v2_selections')
    .select('status, client_approved_at')
    .eq('id', id)
    .single();

  if (!current) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  if (current.client_approved_at) {
    return res.status(400).json({ error: 'Selection already approved' });
  }

  // Update selection with client approval
  const { data, error } = await supabase
    .from('v2_selections')
    .update({
      status: 'approved',
      client_approved_at: new Date().toISOString(),
      client_approved_by: approved_by,
      client_approval_ip: ip_address,
      client_approval_method: 'checkbox',
      client_approval_notes: notes
    })
    .eq('id', id)
    .select()
    .single();

  // Record in status history
  await supabase.from('v2_selection_status_history').insert({
    selection_id: id,
    from_status: current.status,
    to_status: 'approved',
    changed_by: approved_by,
    notes: 'Client approved selection'
  });

  res.json(data);
}));
```

### Convert Estimate Allowances to Job Allowances (new function)
```sql
-- Function to create allowances from estimate lines when estimate is approved
CREATE OR REPLACE FUNCTION convert_estimate_allowances(p_estimate_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_job_id UUID;
  v_line RECORD;
  v_created_count INTEGER := 0;
  v_category_id UUID;
BEGIN
  -- Get job_id from estimate
  SELECT job_id INTO v_job_id
  FROM v2_estimates
  WHERE id = p_estimate_id;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Estimate has no job_id';
  END IF;

  -- Loop through allowance lines
  FOR v_line IN
    SELECT el.id, el.description, el.amount, el.allowance_notes,
           cc.name as cost_code_name
    FROM v2_estimate_lines el
    LEFT JOIN v2_cost_codes cc ON el.cost_code_id = cc.id
    WHERE el.estimate_id = p_estimate_id
      AND el.is_allowance = true
  LOOP
    -- Find or create matching category based on cost code
    SELECT id INTO v_category_id
    FROM v2_selection_categories
    WHERE name ILIKE '%' || COALESCE(v_line.cost_code_name, 'Other') || '%'
    LIMIT 1;

    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id
      FROM v2_selection_categories
      WHERE name = 'Other'
      LIMIT 1;
    END IF;

    -- Create allowance
    INSERT INTO v2_allowances (
      job_id,
      category_id,
      estimate_line_id,
      name,
      description,
      budgeted_amount,
      allowance_type,
      notes
    ) VALUES (
      v_job_id,
      v_category_id,
      v_line.id,
      v_line.description,
      v_line.allowance_notes,
      v_line.amount,
      'material_only',
      'Created from estimate'
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;
```

### Variance Display Pattern (existing CSS)
```css
/* From existing styles */
.variance.over { color: var(--accent-red); }
.variance.under { color: var(--accent-green); }
.variance.on-budget { color: var(--text-secondary); }

.variance-bar.over { background: var(--accent-red); }
.variance-bar.under { background: var(--accent-green); }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate client portal | Role-based same app | User decision | Simpler maintenance, unified UX |
| DocuSign for everything | Checkbox for selections, DocuSign for contracts | Industry standard | Cost savings, speed for simple approvals |
| Manual CO creation | Auto-prompt on overage | Modern construction software | Fewer missed overages |
| Email-based selection | In-app selection + email notifications | 2020s | Better tracking, audit trail |

**Deprecated/outdated:**
- Paper-based selection sheets: Still common but digital is expected
- Separate allowance tracking spreadsheets: Should be integrated

## Existing System Analysis

### v2_allowances Table (migration-056)
Complete implementation with:
- Job and category linking
- Budget vs selected tracking
- Automatic variance calculation via trigger
- Status workflow (pending, in_progress, complete)
- Deadline tracking
- Soft delete support

### v2_selections Table (migration-056)
Complete implementation with:
- Link to allowance and catalog item
- Pricing with markup
- Status workflow (pending, selected, approved, ordered, installed)
- Approval timestamps
- Change order linking
- Client and internal notes

### v2_selection_status_history Table (migration-056)
Full audit trail already in place.

### selections.js Routes
Comprehensive API with:
- Full CRUD for allowances, selections, catalog
- Job summary endpoints
- Create CO from overage
- Stats endpoints
- Catalog browsing with filters

### selections.html / selections.js Frontend
Complete UI with:
- Allowance cards with variance display
- Selection detail modal
- Catalog browsing view
- CO creation modal
- Filter and search

## What Phase 108 Actually Needs to Build

Given the existing system, Phase 108 focuses on:

1. **Bridge to Estimates:** Add `estimate_line_id` to v2_allowances, create conversion function
2. **Client Approval Fields:** Add `client_approved_*` columns to v2_selections
3. **Client Approval Endpoint:** POST /api/selections/items/:id/client-approve
4. **Client View Filtering:** Ensure client role sees only their job, no internal notes
5. **Post-Contract CO Enforcement:** Detect when job is post-contract, enforce CO workflow
6. **Selection Report/Summary:** Client-friendly view of all selections with approval status

## Open Questions

Things that couldn't be fully resolved:

1. **When is a job "post-contract"?**
   - What we know: Job has status field; contract system exists (Phase 78)
   - What's unclear: Exact field/state that indicates contract signed
   - Recommendation: Check for signed contract or job status = 'construction'

2. **Email notifications for selections**
   - What we know: Other areas use email (invoices)
   - What's unclear: Should selection approvals trigger emails?
   - Recommendation: Optional email on selection creation, mandatory on client approval

3. **Bulk selection approval**
   - What we know: Individual selection approval exists
   - What's unclear: Can client approve all pending at once?
   - Recommendation: Add bulk approval endpoint for efficiency

## Sources

### Primary (HIGH confidence)
- Existing codebase: `database/migration-056-selections.sql` - Complete schema
- Existing codebase: `server/routes/selections.js` - Full API implementation
- Existing codebase: `public/selections.html`, `public/js/selections.js` - UI implementation
- Existing codebase: `database/migration-007-job-change-orders.sql` - CO schema

### Secondary (MEDIUM confidence)
- Phase 106 RESEARCH.md - Estimate allowance flag design
- Phase 107 PLAN.md - Assembly integration patterns
- FEATURES.md - Industry expectations for selection portals

### Tertiary (LOW confidence)
- Industry comparison (Buildertrend, CoConstruct) - patterns observed but not verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Supabase/Express stack
- Architecture: HIGH - Building on mature existing system
- Pitfalls: HIGH - Based on existing codebase patterns

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (extending existing stable system)
