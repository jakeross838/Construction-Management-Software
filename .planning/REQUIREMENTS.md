# Requirements: Ross Built CMS v1.6

**Defined:** 2026-01-18
**Core Value:** Streamline construction financial workflows from bidding through payment

## v1.6 Requirements

Requirements for v1.6 Module Expansion. Each maps to roadmap phases.

### Leads/CRM

- [ ] **LED-01**: User can create a lead with contact info (name, email, phone)
- [ ] **LED-02**: User can capture project info (type, budget range, timeline, address)
- [ ] **LED-03**: User can track lead source (website, referral, phone, etc.)
- [ ] **LED-04**: User can view leads in a filterable list by stage and source
- [ ] **LED-05**: User can move leads through 7-stage pipeline (Inquiry → Qualification → Consultation → Design Agreement → Proposal → Contract → Won/Lost)
- [ ] **LED-06**: User can score leads using qualification criteria (budget, timeline, scope, decision-ready, location)
- [ ] **LED-07**: User can create follow-up tasks with due dates for a lead
- [ ] **LED-08**: User can log activities on a lead (calls, emails, meetings, site visits, notes)
- [ ] **LED-09**: User can mark a lead as Won and convert it to a Job (data transfers automatically)
- [ ] **LED-10**: User can mark a lead as Lost with a reason (budget, timing, competitor, etc.)
- [ ] **LED-11**: User can view stage history for a lead (when moved between stages)
- [ ] **LED-12**: User can attach documents to a lead (plans, inspiration, contracts)

### Selections/Allowances

- [ ] **SEL-01**: User can create selection categories (flooring, fixtures, appliances, etc.)
- [ ] **SEL-02**: User can create allowance budgets per job per category
- [ ] **SEL-03**: User can specify allowance type (material-only vs installed)
- [ ] **SEL-04**: User can set selection deadlines per allowance
- [ ] **SEL-05**: User can add selection options to a catalog (item, vendor, price, image)
- [ ] **SEL-06**: User can record client selections with pricing (from catalog or custom)
- [ ] **SEL-07**: User can track selection status (pending, selected, approved, ordered, installed)
- [ ] **SEL-08**: User can view over/under variance per allowance (actual - budget)
- [ ] **SEL-09**: User can view cumulative variance across all allowances for a job
- [ ] **SEL-10**: User can create change order from allowance overage (with markup)
- [ ] **SEL-11**: User can approve selections (builder confirms client choice)
- [ ] **SEL-12**: User can export selections to PDF

### Scaffolded Modules

- [ ] **SCF-01**: RFIs placeholder page exists with basic navigation
- [ ] **SCF-02**: Submittals placeholder page exists with basic navigation
- [ ] **SCF-03**: Tasks placeholder page exists with basic navigation
- [ ] **SCF-04**: Messaging placeholder page exists with basic navigation
- [ ] **SCF-05**: Notifications placeholder page exists with basic navigation
- [ ] **SCF-06**: Warranties placeholder page exists with basic navigation
- [ ] **SCF-07**: Closeout placeholder page exists with basic navigation

### Navigation

- [ ] **NAV-01**: Sidebar is reorganized into logical groups (Sales, Pre-Con, Execution, Field, Finance, Admin, Comms)
- [ ] **NAV-02**: New pages (Leads, Selections, scaffolds) appear in correct sidebar groups
- [ ] **NAV-03**: Existing pages are moved to appropriate groups without breaking navigation

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Leads/CRM Enhancements

- **LED-V2-01**: User receives dashboard alerts for overdue lead tasks
- **LED-V2-02**: User can view lead analytics (conversion rate by source, time in stage)
- **LED-V2-03**: User can configure automated follow-up sequences
- **LED-V2-04**: User can see pipeline value (estimated $ by stage)

### Selections Enhancements

- **SEL-V2-01**: Client-facing selection portal (view allowances, make selections)
- **SEL-V2-02**: User receives alerts for approaching selection deadlines
- **SEL-V2-03**: User can compare selection options side-by-side
- **SEL-V2-04**: User can import selections from vendor quotes

### Full Module Implementations

- **MOD-V2-01**: RFIs - full CRUD, assign, track, resolve
- **MOD-V2-02**: Submittals - submit, review, approve/reject workflow
- **MOD-V2-03**: Tasks - create, assign, due dates, completion tracking
- **MOD-V2-04**: Messaging - in-app threads, notifications
- **MOD-V2-05**: Notifications - centralized inbox, email digest, preferences
- **MOD-V2-06**: Warranties - product tracking, dates, claims
- **MOD-V2-07**: Closeout - certificates, manuals, handover checklist

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Client login/portal | v2 feature - internal use only for v1.6 |
| Email integration (send/receive) | Complexity - log manually for now |
| Calendar sync | External integration - defer to v2 |
| Mobile app | Web works on mobile, native app not needed |
| AI lead scoring | Manual scoring sufficient for v1.6 |
| Automated lead capture (web forms) | Manual entry for v1.6 |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LED-01 | Phase 37 | Pending |
| LED-02 | Phase 37 | Pending |
| LED-03 | Phase 37 | Pending |
| LED-04 | Phase 38 | Pending |
| LED-05 | Phase 37 | Pending |
| LED-06 | Phase 37 | Pending |
| LED-07 | Phase 37 | Pending |
| LED-08 | Phase 37 | Pending |
| LED-09 | Phase 37 | Pending |
| LED-10 | Phase 37 | Pending |
| LED-11 | Phase 37 | Pending |
| LED-12 | Phase 37 | Pending |
| SEL-01 | Phase 39 | Pending |
| SEL-02 | Phase 39 | Pending |
| SEL-03 | Phase 39 | Pending |
| SEL-04 | Phase 39 | Pending |
| SEL-05 | Phase 39 | Pending |
| SEL-06 | Phase 39 | Pending |
| SEL-07 | Phase 39 | Pending |
| SEL-08 | Phase 40 | Pending |
| SEL-09 | Phase 40 | Pending |
| SEL-10 | Phase 39 | Pending |
| SEL-11 | Phase 40 | Pending |
| SEL-12 | Phase 40 | Pending |
| SCF-01 | Phase 41 | Pending |
| SCF-02 | Phase 41 | Pending |
| SCF-03 | Phase 41 | Pending |
| SCF-04 | Phase 41 | Pending |
| SCF-05 | Phase 41 | Pending |
| SCF-06 | Phase 41 | Pending |
| SCF-07 | Phase 41 | Pending |
| NAV-01 | Phase 42 | Pending |
| NAV-02 | Phase 42 | Pending |
| NAV-03 | Phase 42 | Pending |

**Coverage:**
- v1.6 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-18*
*Last updated: 2026-01-18 after initial definition*
