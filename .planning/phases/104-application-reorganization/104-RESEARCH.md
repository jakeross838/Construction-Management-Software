# Phase 104: Application Reorganization & Role-Based Views - Research

**Researched:** 2026-01-21
**Domain:** Navigation Architecture, Role-Based UI, Construction Software UX
**Confidence:** MEDIUM

## Summary

This phase addresses a fundamental navigation reorganization to separate job-specific pages (invoices, draws, schedules, budgets) from global/admin pages (product catalog, vendors, cost codes, employees). The user's core insight is that some features operate within job context while others are company-wide resources.

Research into industry leaders (Procore, Buildertrend, CoConstruct) reveals a consistent two-level architecture pattern: Company Level and Project Level, with navigation that clearly distinguishes between these contexts. The existing codebase already has foundational elements (job sidebar, nav-sidebar.js structure) that can be extended.

**Primary recommendation:** Implement a Procore-style dual-context navigation with explicit "Job Context" and "Company Context" zones, leveraging the existing `JobSidebar` module for job filtering and extending the `nav-sidebar.js` to support context switching.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | Current | Navigation logic | Already used in codebase |
| CSS Custom Properties | Current | Theming context zones | Already in styles.css |
| LocalStorage | Native | State persistence | Already used by JobSidebar |
| URL Params | Native | Deep linking job context | Already in sidebar.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new | - | - | Leverage existing patterns |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom routing | Hash-based routing lib | Unnecessary complexity for static HTML pages |
| React/Vue | Vanilla JS | Would require complete frontend rewrite |

**Installation:**
No new packages required. This phase extends existing navigation infrastructure.

## Architecture Patterns

### Recommended Navigation Structure

Based on Procore and Buildertrend patterns, reorganize from current single-tier navigation to dual-context:

```
Header Navigation
+----------------------------------------------------------------------+
|  [Logo]  | Job Hub | Context Toggle |  [Search]  [Notifications]    |
+----------------------------------------------------------------------+
|                                                                      |
|  JOB CONTEXT (when job-specific)     |  COMPANY CONTEXT              |
|  +--------------------------------+  |  +--------------------------+  |
|  | [Job Sidebar - filter]        |  |  | Admin Settings           |  |
|  |   - Drummond-501              |  |  | Company Settings         |  |
|  |   - Crews-8290                |  |  | Users & Roles            |  |
|  |   - All Jobs                  |  |  | Cost Codes               |  |
|  +--------------------------------+  |  | Vendors                  |  |
|                                      |  | Employees                |  |
|  Job-Specific Pages:                 |  | Product Catalog          |  |
|  - Invoices                          |  | Price Intelligence       |  |
|  - Draws                             |  +--------------------------+  |
|  - Budgets                           |                                |
|  - Schedule                          |  Note: No job sidebar here    |
|  - Daily Logs                        |                                |
|  - Documents                         |                                |
|  - RFIs                              |                                |
|  - Submittals                        |                                |
|  - Punch Lists                       |                                |
+----------------------------------------------------------------------+
```

### Pattern 1: Dual-Context Navigation Architecture

**What:** Separate navigation zones for job-context and company-context pages
**When to use:** Always - this is the primary organizational pattern

**Implementation in nav-sidebar.js:**
```javascript
// Current navGroups structure, reorganized
const navContexts = {
  job: {
    label: 'Job View',
    requiresJobContext: true,
    groups: [
      {
        id: 'project',
        label: 'Project',
        items: [
          { id: 'job-hub', label: 'Job Hub', href: 'job-hub.html' },
          { id: 'job-profile', label: 'Job Profile', href: 'job-profile.html' },
          { id: 'schedule', label: 'Schedule', href: 'schedule.html' },
          { id: 'daily-logs', label: 'Daily Logs', href: 'daily-logs.html' }
        ]
      },
      {
        id: 'finance',
        label: 'Finance',
        items: [
          { id: 'invoices', label: 'Invoices', href: 'index.html' },
          { id: 'pos', label: 'Purchase Orders', href: 'pos.html' },
          { id: 'draws', label: 'Draws', href: 'draws.html' },
          { id: 'budget', label: 'Budgets', href: 'budgets.html' }
        ]
      },
      // ... more job-specific groups
    ]
  },
  company: {
    label: 'Company',
    requiresJobContext: false,
    groups: [
      {
        id: 'resources',
        label: 'Resources',
        items: [
          { id: 'catalog', label: 'Product Catalog', href: 'catalog.html' },
          { id: 'vendors', label: 'Vendors', href: 'vendors.html' },
          { id: 'cost-codes', label: 'Cost Codes', href: 'cost-codes.html' }
        ]
      },
      {
        id: 'team',
        label: 'Team',
        items: [
          { id: 'employees', label: 'Employees', href: 'employees.html' },
          { id: 'crew-schedule', label: 'Crew Scheduling', href: 'crew-schedule.html' },
          { id: 'timesheets', label: 'Timesheets', href: 'timesheets.html' }
        ]
      }
    ]
  }
};
```

### Pattern 2: Context-Aware Job Sidebar

**What:** Show job sidebar only on job-context pages, hide on company pages
**When to use:** To reinforce the context distinction

```javascript
// In sidebar.js - add context awareness
function shouldShowJobSidebar() {
  const currentPage = getCurrentPageFromNav();
  return navContexts.job.groups.some(g =>
    g.items.some(item => item.href === currentPage)
  );
}

function init() {
  if (!shouldShowJobSidebar()) {
    // Don't inject sidebar on company-context pages
    return;
  }
  // ... existing injection logic
}
```

### Pattern 3: Page Classification via Data Attributes

**What:** Mark pages with context and role requirements using HTML data attributes
**When to use:** For future role-based filtering and current context detection

```html
<!-- Job-context page example -->
<body data-page-context="job" data-page-id="invoices" data-role-access="staff,pm,admin">

<!-- Company-context page example -->
<body data-page-context="company" data-page-id="catalog" data-role-access="pm,admin">
```

### Anti-Patterns to Avoid

- **Mixed Context Pages:** Don't put job-specific and company-level items in the same navigation section
- **Hiding vs Reorganizing:** Don't just hide items - fundamentally restructure the navigation hierarchy
- **Deep Nesting:** Avoid more than 2 levels of dropdown - use context switching instead
- **Inconsistent Sidebar:** Don't show job sidebar on company pages (confusing)

## Page Classification

Based on user feedback and construction software patterns:

### Job-Context Pages (Show Job Sidebar)
| Page | File | Rationale |
|------|------|-----------|
| Invoice Dashboard | index.html | Invoices are per-job |
| Purchase Orders | pos.html | POs are job-specific |
| Change Orders | change-orders.html | COs are per-job |
| Draws | draws.html | Draws are per-job |
| Budgets | budgets.html | Budgets are per-job |
| Job Hub | job-hub.html | Primary job view |
| Job Profile | job-profile.html | Job details |
| Schedule | schedule.html | Job schedule |
| Daily Logs | daily-logs.html | Job daily logs |
| Photos | photos.html | Job photos |
| Documents | documents.html | Job documents |
| RFIs | rfis.html | Job RFIs |
| Submittals | submittals.html | Job submittals |
| Inspections | inspections.html | Job inspections |
| Permits | permits.html | Job permits |
| Punch Lists | punch-lists.html | Job punch lists |
| Selections | selections.html | Job selections |
| Leads | leads.html | Pre-job tracking |
| Bids | bids.html | Per-job bids |
| Estimates | estimates.html | Per-job estimates |
| Contracts | contracts.html | Per-job contracts |
| Closeout | closeout.html | Job closeout |
| Warranties | warranties.html | Job warranties |
| Reconciliation | reconciliation.html | Job reconciliation |

### Company-Context Pages (No Job Sidebar)
| Page | File | Rationale |
|------|------|-----------|
| Product Catalog | catalog.html | Company-wide resource |
| Vendors | vendors.html | Company-wide directory |
| Cost Codes | cost-codes.html | Company standard codes |
| Employees | employees.html | Company staff |
| Crew Schedule | crew-schedule.html | Company-wide scheduling |
| Timesheets | timesheets.html | Employee timesheets |
| Companies | companies.html | External company directory |
| Contacts | contacts.html | Company contacts |
| Price Intelligence | price-intelligence.html | Company-wide pricing data |
| Dashboard | dashboard.html | Company overview |
| Business Dashboard | business-dashboard.html | Company metrics |
| Business Planning | business-planning.html | Company planning |
| Financial Periods | financial-periods.html | Company periods |
| Overhead | overhead.html | Company overhead |
| WIP Schedule | wip.html | Company-wide WIP |
| P&L | pnl.html | Company P&L |
| Cash Flow | cash-flow.html | Company cash flow |
| Profitability | profitability.html | Cross-job profitability |

## Role Definitions (Preparation)

Based on Procore and Buildertrend role structures:

### Recommended Roles for Future RBAC Implementation

| Role | Level | Description | Typical Pages |
|------|-------|-------------|---------------|
| Owner | 5 | Company owner, full access | All pages |
| Admin | 4 | System administrator | All pages, settings |
| PM | 3 | Project Manager | Job pages, reports, approvals |
| Supervisor | 2.5 | Field supervisor | Daily logs, schedule, photos |
| Field Crew | 2 | Field workers | Daily logs, timesheets (limited) |
| Accounting | 3 | Financial team | Invoices, draws, payments |
| Client | 1.5 | Homeowner/client | Read-only job progress, selections |
| Architect/Designer | 1.5 | External collaborator | Documents, RFIs, selections |

### Role Page Access Matrix (Preparation for Future Phase)

```javascript
// Add to page data attributes or nav configuration
const PAGE_ROLE_ACCESS = {
  // Financial pages - restrict from field crew, clients
  'index.html': ['owner', 'admin', 'pm', 'accounting'],
  'draws.html': ['owner', 'admin', 'pm', 'accounting'],
  'budgets.html': ['owner', 'admin', 'pm', 'accounting'],

  // Project pages - broader access
  'daily-logs.html': ['owner', 'admin', 'pm', 'supervisor', 'field_crew'],
  'photos.html': ['owner', 'admin', 'pm', 'supervisor', 'field_crew', 'client'],

  // Client-accessible
  'selections.html': ['owner', 'admin', 'pm', 'client', 'designer'],

  // Admin only
  'employees.html': ['owner', 'admin'],
  'cost-codes.html': ['owner', 'admin'],
};
```

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| State persistence | Custom storage | Existing localStorage pattern in sidebar.js | Already implemented, tested |
| URL state | Custom URL manipulation | Existing URL param handling | sidebar.js has ?job= pattern |
| Navigation rendering | New nav component | Extend nav-sidebar.js | Maintains consistency |
| Context detection | Complex page detection | HTML data attributes | Declarative, maintainable |

**Key insight:** The existing codebase has solid foundations (JobSidebar, nav-sidebar.js). Extend these rather than replacing them.

## Common Pitfalls

### Pitfall 1: Breaking Existing Navigation Muscle Memory
**What goes wrong:** Users can't find pages they used to access easily
**Why it happens:** Reorganization changes everything at once
**How to avoid:**
- Keep page URLs the same
- Use clear visual indicators of context
- Consider "legacy nav" mode for transition
**Warning signs:** User confusion in first 2 weeks post-deploy

### Pitfall 2: Inconsistent Job Context Handling
**What goes wrong:** Some job pages don't filter by selected job, others do
**Why it happens:** Not all pages integrated with JobSidebar.onJobChange()
**How to avoid:**
- Audit every job-context page
- Create standardized integration pattern
- Test with specific job selected vs "All Jobs"
**Warning signs:** Data shows all jobs when job is selected

### Pitfall 3: Context Switch Jarring UX
**What goes wrong:** Switching from job to company context feels disconnected
**Why it happens:** No visual continuity, no transition
**How to avoid:**
- Visual indicator of current context
- Consistent header/branding across contexts
- Consider breadcrumb or context pill
**Warning signs:** Users unsure which "mode" they're in

### Pitfall 4: Role Prep Without Auth
**What goes wrong:** Adding role tags to pages but auth not enforcing them
**Why it happens:** Phase 94 not complete
**How to avoid:**
- This phase should only PREPARE for roles
- Use data attributes but don't hide navigation
- Document the role plan, don't implement restrictions
**Warning signs:** Trying to enforce roles before auth exists

## Code Examples

### Context-Aware Navigation Initialization

```javascript
// nav-sidebar.js enhancement
function init() {
  const currentContext = detectPageContext();

  // Update header to show context
  const contextIndicator = createContextIndicator(currentContext);
  document.querySelector('.header-top').appendChild(contextIndicator);

  // Only show relevant navigation items
  renderNavigation(currentContext);
}

function detectPageContext() {
  // Check data attribute first
  const bodyContext = document.body.dataset.pageContext;
  if (bodyContext) return bodyContext;

  // Fall back to URL matching
  const path = window.location.pathname;
  const filename = path.split('/').pop() || 'index.html';

  const companyPages = [
    'catalog.html', 'vendors.html', 'cost-codes.html',
    'employees.html', 'crew-schedule.html', 'timesheets.html',
    'companies.html', 'contacts.html', 'price-intelligence.html',
    'dashboard.html', 'business-dashboard.html'
  ];

  return companyPages.includes(filename) ? 'company' : 'job';
}

function createContextIndicator(context) {
  const indicator = document.createElement('div');
  indicator.className = 'context-indicator';
  indicator.innerHTML = `
    <span class="context-label">${context === 'job' ? 'Job View' : 'Company View'}</span>
    <button class="context-switch" onclick="toggleContext()">
      Switch to ${context === 'job' ? 'Company' : 'Job'} View
    </button>
  `;
  return indicator;
}
```

### Conditional Job Sidebar (sidebar.js modification)

```javascript
// At the start of init()
function init() {
  if (SidebarState.isInitialized) return;

  // Check if this page should have job sidebar
  const pageContext = document.body.dataset.pageContext ||
    detectPageContextFromUrl();

  if (pageContext !== 'job') {
    console.log('[Sidebar] Company context page - sidebar disabled');
    SidebarState.isInitialized = true;
    return;
  }

  // ... rest of existing init
}
```

### Page Data Attributes Standard

```html
<!-- Standard page template for job-context -->
<body data-page-context="job"
      data-page-id="invoices"
      data-page-group="finance"
      data-role-min="staff">
  <!-- page content -->
</body>

<!-- Standard page template for company-context -->
<body data-page-context="company"
      data-page-id="catalog"
      data-page-group="resources"
      data-role-min="pm">
  <!-- page content -->
</body>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat navigation | Context-based navigation | Industry standard 2020+ | Reduces cognitive load |
| Page-level role checks | Permission templates | Procore popularized 2019+ | Easier role management |
| Role hiding | Context separation + role filtering | Current best practice | Cleaner architecture |

**Industry observations:**
- Procore: Company Level vs Project Level with explicit toolbox
- Buildertrend: Role-based dashboards (Admin, PM, Sub, Client portals)
- CoConstruct: Unified interface with role-based filtering (less clear separation)

## Open Questions

Things that couldn't be fully resolved:

1. **Dashboard Placement**
   - What we know: Dashboard shows company-wide stats
   - What's unclear: Should it also be available in job context showing job-specific dashboard?
   - Recommendation: Keep dashboard as company-level; job-hub serves as job-specific dashboard

2. **Leads/Bids Classification**
   - What we know: Pre-construction items, eventually become jobs
   - What's unclear: Are they truly job-context before job exists?
   - Recommendation: Treat as job-context with "All Jobs" being the common state

3. **Cross-Job Reports**
   - What we know: Some pages span multiple jobs (WIP, Profitability)
   - What's unclear: Should these show job sidebar with multi-select?
   - Recommendation: Company-context with optional job filter dropdown (not sidebar)

## Sources

### Primary (HIGH confidence)
- Procore Support Documentation - Permission system, tool organization
  - https://support.procore.com/faq/what-are-permissions-in-procore-and-how-do-they-work
  - https://support.procore.com/faq/how-do-i-navigate-procores-tools
- Existing codebase analysis - nav-sidebar.js, sidebar.js, auth.js

### Secondary (MEDIUM confidence)
- [Buildertrend User Roles Documentation](https://buildertrend.com/help-article/manage-user-roles-and-permissions/)
- [Nielsen Norman Group Menu Design](https://www.nngroup.com/articles/menu-design/)
- [Filter UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-filtering)
- [Navigation UX Best Practices](https://www.pencilandpaper.io/articles/ux-pattern-analysis-navigation)

### Tertiary (LOW confidence)
- WebSearch results on construction software navigation patterns
- General SaaS navigation patterns

## Metadata

**Confidence breakdown:**
- Page classification: HIGH - Based on user feedback and codebase analysis
- Navigation architecture: MEDIUM - Based on industry patterns, specific implementation untested
- Role definitions: MEDIUM - Based on Procore/Buildertrend patterns, adapted for Ross Built
- Code examples: MEDIUM - Conceptual, not tested against actual codebase

**Research date:** 2026-01-21
**Valid until:** 60 days (navigation patterns stable, auth dependency may change)
