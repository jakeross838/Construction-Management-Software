# Phase 107: Assembly Library & Estimate Builder - Research

**Researched:** 2026-01-22
**Domain:** Frontend UI for Construction Estimate Management with Assembly Templates
**Confidence:** HIGH

## Summary

This phase builds the UI layer for the assembly template system and enhanced estimate builder on top of the Phase 106 database schema. The existing estimates UI (`estimates-budget.js`) provides basic estimate CRUD with line items and drag-drop reordering, but lacks: (1) admin UI for managing reusable assembly templates, (2) section-based organization within estimates, (3) assembly expansion workflow, and (4) copy-from-previous-estimate functionality.

**Key findings:**
1. The existing `estimates.js` (3000+ lines) has mature drag-drop reordering for line items using native HTML5 drag events - this pattern can be reused for section reordering
2. Phase 106 created the database tables (`v2_assembly_templates`, `v2_assembly_template_items`, `v2_estimate_sections`) and functions (`expand_assembly_template`, `recalculate_estimate_totals_v3`) that the UI will consume
3. The project uses fullscreen modals with tabs for complex edit flows (see draws.html, PO detail modal) - assembly library should follow this pattern
4. Existing patterns for admin CRUD pages (catalog.js, cost-codes.js) show left sidebar navigation with main content area

**Primary recommendation:** Create a new Assembly Library page (`assembly-library.html`) for admin template management, and extend the existing `estimates-budget.html` with sections, assembly picker, and enhanced estimate builder workflow.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES6+ | Frontend logic | Project standard - no frameworks |
| HTML5 Drag API | Native | Drag-drop reordering | Already used in estimates.js |
| Fetch API | Native | HTTP requests | Project standard |
| CSS Variables | Native | Theming | Defined in styles.css |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| toasts.js | Local | Notifications | User feedback on save/delete |
| modal-helpers.js | Local | Modal open/close | If exists, otherwise inline |
| nav-sidebar.js | Local | Job context | Job selection for estimates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native drag-drop | SortableJS | More features but adds dependency - not needed |
| Vanilla JS | Alpine.js | Reactive but project uses vanilla JS throughout |

**Installation:**
```bash
# No additional packages needed - vanilla JS with existing patterns
```

## Architecture Patterns

### Recommended Project Structure
```
public/
├── assembly-library.html     # NEW: Admin page for templates
├── estimates-budget.html     # EXTEND: Enhanced estimate builder
├── js/
│   ├── assembly-library.js   # NEW: Template CRUD + item management
│   ├── estimates-budget.js   # EXTEND: Sections, assembly picker
│   └── estimate-builder.js   # NEW (optional): Split out builder logic
server/routes/
├── estimates.js              # EXTEND: Section & assembly endpoints
└── assembly-templates.js     # NEW: Template CRUD API
```

### Pattern 1: Assembly Library Admin Page

**What:** Dedicated admin page for creating/editing reusable assembly templates
**When to use:** When admin needs to manage template library
**Structure:**
```
+------------------------+----------------------------------+
| Category Sidebar       | Template List / Editor           |
|------------------------|----------------------------------|
| - Bathrooms           | [Template Name]                  |
| - Kitchens            | [Description]                    |
| - Framing             | [Is Active toggle]               |
|   [+ Add Category]    |                                  |
|                       | Line Items Table:                |
|                       | | # | Cost Code | Desc | Qty | $ ||
|                       | |---|-----------|------|-----|---||
|                       | | 1 | 12101     | ... | 1   |500||
|                       | [+ Add Item] [Save Template]     |
+------------------------+----------------------------------+
```

**Code Pattern (from catalog.js):**
```javascript
// State management
let templates = [];
let categories = [];
let currentTemplateId = null;

// Load and render
async function loadTemplates() {
  const params = new URLSearchParams();
  if (currentCategoryFilter) params.append('category', currentCategoryFilter);
  const res = await fetch(`/api/assembly-templates?${params}`);
  templates = await res.json();
  renderTemplateList();
}

function renderTemplateList() {
  const container = document.getElementById('templateList');
  container.innerHTML = templates.map(t => `
    <div class="template-card" data-id="${t.id}" onclick="openTemplateEditor('${t.id}')">
      <h4>${escapeHtml(t.name)}</h4>
      <span class="badge">${t.item_count} items</span>
      <span class="badge badge-${t.is_active ? 'success' : 'secondary'}">${t.is_active ? 'Active' : 'Inactive'}</span>
    </div>
  `).join('');
}
```

### Pattern 2: Estimate Builder with Sections

**What:** Section-based estimate organization with collapsible groups
**When to use:** All estimate editing
**Structure:**
```
Estimate: Kitchen Remodel v1
+----------------------------------------+
| Section: Demolition         [^] [...]  |
|   - Remove cabinets         $2,500     |
|   - Remove flooring         $1,200     |
|                    Subtotal: $3,700    |
+----------------------------------------+
| Section: Cabinetry          [^] [...]  |
|   [+ Add Assembly] [+ Add Line]        |
|   [Assembly: Standard Kitchen] $15,000 |
|     - Base cabinets         $8,000     |
|     - Wall cabinets         $5,000     |
|     - Hardware              $2,000     |
+----------------------------------------+
| [+ Add Section]                        |
|                                        |
| Subtotal:                   $18,700    |
| Overhead (10%):              $1,870    |
| Profit (15%):                $3,086    |
| Contingency (5%):              $935    |
| GRAND TOTAL:                $24,591    |
+----------------------------------------+
```

**Code Pattern:**
```javascript
function renderSections() {
  const container = document.getElementById('sectionsContainer');
  const sections = currentEstimate.sections || [];

  container.innerHTML = sections.map((section, idx) => `
    <div class="estimate-section" data-section-id="${section.id}">
      <div class="section-header" draggable="true">
        <span class="drag-handle">...</span>
        <input class="section-name-input" value="${escapeHtml(section.name)}"
               onchange="updateSectionName('${section.id}', this.value)">
        <span class="section-subtotal">${formatCurrency(section.subtotal)}</span>
        <button class="btn-icon" onclick="toggleSectionCollapse('${section.id}')">^</button>
        <button class="btn-icon" onclick="openSectionMenu('${section.id}')">...</button>
      </div>
      <div class="section-body" id="section-body-${section.id}">
        <div class="section-actions">
          <button onclick="openAddAssemblyModal('${section.id}')">+ Add Assembly</button>
          <button onclick="openAddLineModal('${section.id}')">+ Add Line Item</button>
        </div>
        <div class="section-lines">
          ${renderSectionLines(section.lines)}
        </div>
      </div>
    </div>
  `).join('');

  container.innerHTML += `
    <button class="btn btn-secondary" onclick="addSection()">+ Add Section</button>
  `;
}
```

### Pattern 3: Assembly Picker Modal

**What:** Modal to browse and add assembly templates to an estimate
**When to use:** When user clicks "Add Assembly" in a section
**Structure:**
```
+---------------------------------------------------+
| Add Assembly to Section: Cabinetry                |
|---------------------------------------------------|
| Search: [____________] Category: [All v]          |
|                                                   |
| +-----------------------------------------------+ |
| | Standard Kitchen                    $15,000   | |
| | 5 items | Kitchen | Active                    | |
| | [Preview] [Add to Estimate]                   | |
| +-----------------------------------------------+ |
| | Master Bathroom                      $8,500   | |
| | 8 items | Bathrooms | Active                  | |
| +-----------------------------------------------+ |
|                                                   |
| [Cancel]                                          |
+---------------------------------------------------+
```

**Code Pattern:**
```javascript
async function openAddAssemblyModal(sectionId) {
  currentSectionId = sectionId;

  // Load available templates
  const res = await fetch('/api/assembly-templates?is_active=true');
  const templates = await res.json();

  renderAssemblyPicker(templates);

  const modal = document.getElementById('assemblyPickerModal');
  modal.style.display = 'flex';
  modal.classList.add('show');
}

async function addAssemblyToEstimate(templateId) {
  const res = await fetch(`/api/estimates/${currentEstimate.id}/expand-assembly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: templateId,
      section_id: currentSectionId
    })
  });

  if (!res.ok) throw new Error('Failed to add assembly');

  showToast('Assembly added to estimate', 'success');
  await reloadEstimate();
  closeAssemblyPickerModal();
}
```

### Pattern 4: Copy from Previous Estimate

**What:** Workflow to duplicate an existing estimate to a new job or version
**When to use:** Starting new estimate from template or copying to different job
**Structure:**
```
+---------------------------------------------------+
| Copy Estimate                                      |
|---------------------------------------------------|
| Source: Kitchen Remodel v3 - Smith Job            |
| Copy to:                                          |
|   ( ) Same job (creates new version)              |
|   (*) Different job: [Johnson Job v]              |
|                                                   |
| Options:                                          |
|   [x] Copy all sections                           |
|   [x] Copy all line items                         |
|   [ ] Reset amounts to template defaults          |
|                                                   |
| [Cancel] [Create Copy]                            |
+---------------------------------------------------+
```

**Code Pattern (from existing estimates.js duplicate flow):**
```javascript
async function duplicateEstimate() {
  const targetJobId = document.getElementById('duplicateJob').value;
  const newTitle = document.getElementById('duplicateTitle').value;

  const res = await fetch(`/api/estimates/${currentEstimate.id}/duplicate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_job_id: targetJobId || null,
      new_title: newTitle,
      created_by: window.currentUser || 'User'
    })
  });

  if (!res.ok) throw new Error('Failed to duplicate');
  const result = await res.json();
  showToast('Estimate copied successfully', 'success');

  // Navigate to new estimate
  closeDuplicateModal();
  await openEstimateDetail(result.estimate.id);
}
```

### Anti-Patterns to Avoid

- **Inline editing without autosave:** Always save on blur/change, not requiring explicit save button for field changes
- **Refreshing entire estimate on every change:** Use optimistic updates, refresh only affected section/totals
- **Modal within modal:** Use single modal with state, not nested modals
- **Loading all templates at once:** Paginate or lazy-load for large template libraries

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-drop reordering | Custom mouse event tracking | HTML5 Drag API (already in estimates.js) | Native, accessible, proven |
| Currency formatting | String concatenation | `formatCurrency()` from existing utils | Consistent, locale-aware |
| Toast notifications | Custom alerts | `showToast()` from toasts.js | Project standard |
| Modal open/close | Direct style manipulation | Existing modal pattern with `.show` class | CSS opacity transition works |
| Section subtotal calculation | Client-side sum | `recalculate_estimate_totals_v3()` DB function | Triggers handle it automatically |

**Key insight:** The database triggers from Phase 106 handle all total calculations. The UI should just call the API and refresh displayed values - don't duplicate calculation logic client-side.

## Common Pitfalls

### Pitfall 1: Modal Not Visible After Opening

**What goes wrong:** Modal appears to not open (display:flex set but opacity:0)
**Why it happens:** CSS uses `.show` class for opacity transition, missing `classList.add('show')`
**How to avoid:**
```javascript
// Always add .show class after setting display
modal.style.display = 'flex';
modal.classList.add('show');
```
**Warning signs:** Click does nothing, no error in console

### Pitfall 2: Stale Totals After Line Item Changes

**What goes wrong:** Totals don't update after adding/editing line items
**Why it happens:** Not refetching estimate after mutation, relying on stale data
**How to avoid:** Always reload estimate data after any mutation:
```javascript
async function addLineItem(...) {
  await fetch(POST ...);
  await reloadCurrentEstimate(); // Refresh all data including computed totals
}
```
**Warning signs:** Subtotals don't match sum of visible items

### Pitfall 3: Drag-Drop Not Working for New Rows

**What goes wrong:** Newly added rows can't be dragged
**Why it happens:** Event listeners attached at page load, not after DOM updates
**How to avoid:** Re-attach drag handlers after rendering:
```javascript
function renderSectionLines(lines) {
  // ... render HTML ...
  setTimeout(() => setupDragDrop(), 0); // Re-attach after DOM update
}
```
**Warning signs:** Original rows draggable, new rows not

### Pitfall 4: Assembly Expansion Creates Duplicates

**What goes wrong:** Adding same assembly twice creates duplicate header lines
**Why it happens:** Not checking if assembly already exists in section
**How to avoid:** Either allow duplicates (valid use case) or check before adding:
```javascript
// Option A: Allow duplicates, show confirmation
if (sectionHasAssembly(sectionId, templateId)) {
  if (!confirm('This assembly is already in this section. Add another?')) return;
}
// Option B: Prevent duplicates
```
**Warning signs:** Same assembly name appears multiple times unexpectedly

### Pitfall 5: Section Reorder Loses Line Items

**What goes wrong:** Moving sections doesn't preserve line item associations
**Why it happens:** Only updating section sort_order, not re-assigning line items
**How to avoid:** Section reorder only changes sort_order - line items stay attached via section_id foreign key
**Warning signs:** Line items disappear after section reorder

## Code Examples

Verified patterns from existing codebase:

### Existing Drag-Drop Pattern (from estimates.js)
```javascript
// Source: public/js/estimates.js lines 1257-1390
let draggedRow = null;

function setupDragDrop() {
  const tbody = document.getElementById('linesTableBody');
  const rows = tbody.querySelectorAll('tr[draggable="true"]');

  rows.forEach(row => {
    const handle = row.querySelector('.drag-handle');
    if (handle) {
      handle.addEventListener('mousedown', () => row.classList.add('drag-ready'));
      handle.addEventListener('mouseup', () => row.classList.remove('drag-ready'));
    }

    row.addEventListener('dragstart', handleDragStart);
    row.addEventListener('dragend', handleDragEnd);
    row.addEventListener('dragover', handleDragOver);
    row.addEventListener('drop', handleDrop);
  });
}

function handleDragStart(e) {
  if (!this.classList.contains('drag-ready')) {
    e.preventDefault();
    return;
  }
  draggedRow = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', this.dataset.lineId);
}

async function handleDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (!draggedRow || this === draggedRow) return;

  // Reorder in DOM
  const tbody = this.parentNode;
  const rows = Array.from(tbody.querySelectorAll('tr[draggable="true"]'));
  const draggedIndex = rows.indexOf(draggedRow);
  const dropIndex = rows.indexOf(this);

  if (draggedIndex < dropIndex) {
    this.parentNode.insertBefore(draggedRow, this.nextSibling);
  } else {
    this.parentNode.insertBefore(draggedRow, this);
  }

  // Persist new order
  await persistLineOrder();
}
```

### Existing Fullscreen Modal Pattern (from estimates-budget.html)
```html
<!-- Source: public/estimates-budget.html lines 637-898 -->
<div id="estimateDetailModal" class="modal modal-fullscreen-dark">
  <div class="modal-content">
    <div class="modal-header">
      <div class="modal-header-left">
        <h2 id="detailTitle">Estimate Details</h2>
        <span class="badge" id="detailStatus">Draft</span>
      </div>
      <button class="close-btn" onclick="closeDetailModal()">&times;</button>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="overview" onclick="switchTab('overview')">Overview</button>
      <button class="tab" data-tab="lines" onclick="switchTab('lines')">Line Items</button>
    </div>

    <div class="modal-body">
      <div id="tab-overview" class="tab-content active">...</div>
      <div id="tab-lines" class="tab-content">...</div>
    </div>

    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeDetailModal()">Close</button>
      <button class="btn btn-primary" onclick="saveEstimate()">Save</button>
    </div>
  </div>
</div>
```

### Existing Reorder API Pattern (from estimates.js)
```javascript
// Source: server/routes/estimates.js lines 1012-1032
// Reorder lines
router.post('/:id/lines/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { line_ids, updated_by } = req.body;

  if (!Array.isArray(line_ids)) {
    throw new AppError('VALIDATION_ERROR', 'line_ids must be an array');
  }

  // Update sort_order for each line
  for (let i = 0; i < line_ids.length; i++) {
    await supabase
      .from('v2_estimate_lines')
      .update({ sort_order: i + 1 })
      .eq('id', line_ids[i])
      .eq('estimate_id', id);
  }

  await logEstimateActivity(id, 'lines_reordered', updated_by || 'System', {});
  res.json({ success: true });
}));
```

## API Endpoints Needed

### New Assembly Template Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/assembly-templates` | List templates with filters (category, is_active) |
| GET | `/api/assembly-templates/:id` | Get single template with items |
| POST | `/api/assembly-templates` | Create template |
| PATCH | `/api/assembly-templates/:id` | Update template |
| DELETE | `/api/assembly-templates/:id` | Soft delete/deactivate template |
| POST | `/api/assembly-templates/:id/items` | Add item to template |
| PATCH | `/api/assembly-templates/:id/items/:itemId` | Update template item |
| DELETE | `/api/assembly-templates/:id/items/:itemId` | Remove template item |
| POST | `/api/assembly-templates/:id/items/reorder` | Reorder template items |

### New/Extended Estimate Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/estimates/:id/sections` | Create section |
| PATCH | `/api/estimates/:id/sections/:sectionId` | Update section (name, sort_order) |
| DELETE | `/api/estimates/:id/sections/:sectionId` | Delete section (lines remain, section_id set null) |
| POST | `/api/estimates/:id/sections/reorder` | Reorder sections |
| POST | `/api/estimates/:id/expand-assembly` | Expand template into section (calls DB function) |
| POST | `/api/estimates/:id/duplicate` | Already exists - copy estimate to same/different job |

## Integration with Phase 106 Database Functions

The UI should call these Phase 106 database functions via API endpoints:

| DB Function | API Wrapper | When Called |
|-------------|-------------|-------------|
| `expand_assembly_template(estimate_id, template_id, section_id, qty_multiplier)` | `POST /api/estimates/:id/expand-assembly` | User adds assembly to section |
| `recalculate_estimate_totals_v3(estimate_id)` | Called automatically by trigger | After any line item change |
| `update_section_subtotal(section_id)` | Called automatically by trigger | After line item in section changes |
| `create_estimate_version(estimate_id, created_by, change_summary)` | `POST /api/estimates/:id/version` | User clicks "Save Version" |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single flat list of lines | Section-grouped lines | This phase | Better organization |
| Manual assembly creation | Reusable template library | This phase | Faster estimate creation |
| One estimate per job | Versioned estimates with copy | Already exists | Better revision tracking |

**Deprecated/outdated:**
- Inline assembly creation via parent_line_id: Still supported but templates preferred for reuse
- Combined markup_percent: Replaced by separate overhead/profit/contingency (Phase 106)

## Open Questions

Things that couldn't be fully resolved:

1. **Assembly Template Categories**
   - What we know: Templates have a `category` text field
   - What's unclear: Should categories be a separate table or just text values?
   - Recommendation: Start with text values, create v2_assembly_categories table later if needed

2. **Section Default Names**
   - What we know: Sections need names like "Site Work", "Framing", etc.
   - What's unclear: Should there be predefined section templates or just free text?
   - Recommendation: Free text for now, consider dropdown with common names

3. **Copy Estimate Behavior for Assemblies**
   - What we know: Copy duplicates all lines
   - What's unclear: Should copied assembly-derived lines maintain template_id reference?
   - Recommendation: Preserve template_id for traceability but lines are independent copies

## Sources

### Primary (HIGH confidence)
- Existing codebase: `public/js/estimates.js` - drag-drop patterns, line item management
- Existing codebase: `public/js/estimates-budget.js` - estimate list/detail UI
- Existing codebase: `public/js/catalog.js` - admin CRUD patterns with sidebar
- Existing codebase: `server/routes/estimates.js` - existing API structure
- Phase 106 PLAN files: Database schema and function definitions

### Secondary (MEDIUM confidence)
- Existing codebase: `public/css/styles.css` - CSS variables and component styles
- CLAUDE.md: Project conventions and patterns

### Tertiary (LOW confidence)
- General construction estimating best practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing vanilla JS patterns
- Architecture: HIGH - Based on existing modal/tab/drag patterns in codebase
- Pitfalls: HIGH - Based on documented issues in CLAUDE.md and codebase comments

**Research date:** 2026-01-22
**Valid until:** 2026-02-22 (UI patterns are stable)
