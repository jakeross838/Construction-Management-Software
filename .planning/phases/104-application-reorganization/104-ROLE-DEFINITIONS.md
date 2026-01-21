# Role Definitions for Ross Built CMS

**Created:** Phase 104 - Application Reorganization
**Status:** Documentation only (not enforced until Phase 94 Authentication)

## Overview

These role definitions prepare the groundwork for future role-based access control (RBAC). During Phase 104, pages are tagged with `data-role-min` attributes indicating the minimum role required, but access is NOT enforced until authentication is implemented in Phase 94.

## Role Hierarchy

| Role | Level | Description |
|------|-------|-------------|
| owner | 5 | Company owner, full access to everything |
| admin | 4 | System administrator, can manage settings and users |
| pm | 3 | Project Manager, manages jobs and approvals |
| accounting | 3 | Financial team, handles invoices/draws/expenses |
| supervisor | 2.5 | Field supervisor, manages daily operations |
| field_crew | 2 | Field workers, basic job access |
| client | 1.5 | Homeowner/client, read-only project progress |
| designer | 1.5 | Architect/designer, documents and selections |

## Role Descriptions

### Owner (Level 5)
- Company owner or principal
- Full access to all features
- Can see all financial data including P&L
- Can manage all settings

### Admin (Level 4)
- System administrator
- Manages users, employees, cost codes
- Configures company settings
- Can close financial periods

### Project Manager (Level 3)
- Manages one or more jobs
- Creates POs, approves invoices
- Views job profitability
- Manages job schedules and documents

### Accounting (Level 3)
- Financial team member
- Processes invoices and draws
- Manages expenses
- Views WIP and cash flow

### Supervisor (Level 2.5)
- Field supervisor or foreman
- Manages daily logs and crew
- Views schedule and inspections
- Limited financial visibility

### Field Crew (Level 2)
- Field workers and trades
- Submits timesheets
- Views job hub and daily logs
- Takes and views photos

### Client (Level 1.5)
- Homeowner or project client
- Read-only access to selections
- Views project progress
- Limited document access

### Designer (Level 1.5)
- Architect or designer
- Access to RFIs and submittals
- Views selections
- Limited project documentation

## Page Access Matrix

### Job Context Pages

| Page | Min Role | Notes |
|------|----------|-------|
| job-hub.html | field_crew | Primary job view |
| daily-logs.html | field_crew | Field activity |
| photos.html | field_crew | Job photos |
| schedule.html | supervisor | Job schedule |
| inspections.html | supervisor | Inspection tracking |
| punch-lists.html | supervisor | Quality control |
| documents.html | supervisor | Job documents |
| invoices (index.html) | accounting | Invoice processing |
| draws.html | accounting | Draw management |
| budgets.html | accounting | Budget tracking |
| wip.html | accounting | Company WIP |
| lien-releases.html | accounting | Lien tracking |
| reconciliation.html | accounting | Job reconciliation |
| pos.html | pm | Purchase orders |
| change-orders.html | pm | Change orders |
| rfis.html | pm | RFI management |
| submittals.html | pm | Submittal tracking |
| permits.html | pm | Permit tracking |
| leads.html | pm | Lead tracking |
| job-profile.html | pm | Job details |
| bids.html | pm | Bid management |
| estimates.html | pm | Estimation |
| budget-builder.html | pm | Budget creation |
| contracts.html | pm | Contract management |
| closeout.html | pm | Project closeout |
| warranties.html | pm | Warranty tracking |
| correspondence.html | pm | Communications |
| meetings.html | pm | Meeting notes |
| compliance.html | pm | Compliance tracking |
| selections.html | client | Client selections |

### Company Context Pages

| Page | Min Role | Notes |
|------|----------|-------|
| timesheets.html | field_crew | Personal timesheets |
| crew-schedule.html | supervisor | Crew scheduling |
| dashboard.html | pm | Company overview |
| business-dashboard.html | pm | Business metrics |
| catalog.html | pm | Product catalog |
| vendors.html | pm | Vendor directory |
| companies.html | pm | Company directory |
| contacts.html | pm | Contact management |
| price-intelligence.html | pm | Pricing data |
| profitability.html | pm | Job comparison |
| cost-codes.html | admin | Code management |
| employees.html | admin | Employee management |
| financial-periods.html | admin | Period management |
| overhead.html | admin | Overhead allocation |
| pnl.html | admin | Company P&L |
| cash-flow.html | admin | Cash flow |
| business-planning.html | admin | Business planning |
| expenses.html | accounting | Expense tracking |

## Implementation Notes

1. **Phase 104 (Current)**: Pages tagged with `data-role-min` attributes but access not enforced
2. **Phase 94 (Future)**: Authentication system implementation
3. **Post-94**: RBAC enforcement using data attributes

### Data Attribute Format

```html
<body data-page-context="job|company"
      data-page-id="unique-id"
      data-page-group="group-name"
      data-role-min="role-name">
```

### Role Check Logic (Future Implementation)

```javascript
function canAccess(userRole, requiredRole) {
  const levels = {
    owner: 5, admin: 4, pm: 3, accounting: 3,
    supervisor: 2.5, field_crew: 2, client: 1.5, designer: 1.5
  };
  return levels[userRole] >= levels[requiredRole];
}
```

## Future Considerations

1. **Multi-role users**: Some users may have multiple roles (e.g., PM + Accounting)
2. **Job-specific roles**: A user might be PM on some jobs, supervisor on others
3. **Permission granularity**: May need finer-grained permissions (view vs edit)
4. **Audit logging**: Track who accessed what when

---

*This document will be referenced by Phase 94 (User Authentication & RBAC) implementation.*
