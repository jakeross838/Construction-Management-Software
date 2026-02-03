# MASTER PLAN: Ross Built Construction Management System

## Vision

**A complete construction business operating system** that manages the entire lifecycle from first client contact through warranty closeout - where every document uploaded, every selection made, and every invoice paid makes the system smarter.

---

## The Complete Construction Journey

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            ROSS BUILT CMS - COMPLETE WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │    LEADS     │───▶│  PRE-CON     │───▶│ CONSTRUCTION │───▶│   CLOSEOUT   │          │
│  │   PIPELINE   │    │  AGREEMENT   │    │   CONTRACT   │    │  & WARRANTY  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘          │
│         │                   │                    │                   │                 │
│         ▼                   ▼                    ▼                   ▼                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  - Inquiry   │    │  - Site      │    │  - Schedule  │    │  - Punch     │          │
│  │  - Qualify   │    │    visits    │    │  - Daily     │    │    lists     │          │
│  │  - Nurture   │    │  - Design    │    │    logs      │    │  - Final     │          │
│  │  - Proposal  │    │  - Estimate  │    │  - Photos    │    │    docs      │          │
│  │              │    │  - Permits   │    │  - Draws     │    │  - Warranty  │          │
│  │              │    │              │    │  - Changes   │    │    tracking  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                                         │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                              FINANCIAL LAYER (ALWAYS RUNNING)                          │
│  ═══════════════════════════════════════════════════════════════════════════════════   │
│                                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   INVOICES   │    │   BUDGETS    │    │  CASH FLOW   │    │     P&L      │          │
│  │   & A/P      │    │  & COSTING   │    │  & FORECAST  │    │   & REPORTS  │          │
│  └──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Current System Status

### What's Built (v3.0 Complete)

| Module | Status | Description |
|--------|--------|-------------|
| **Dashboard** | ✅ Complete | Executive overview, job metrics, alerts |
| **Leads/CRM** | ✅ Complete | Pipeline, qualification, activities, conversion |
| **Estimates** | ✅ Complete | Assemblies, cost codes, markups, templates |
| **Selections** | ✅ Complete | Visual catalog, allowances, variance tracking |
| **Jobs** | ✅ Complete | 360° view, status, documents, notes |
| **Schedule** | ✅ Complete | Gantt, dependencies, critical path |
| **Daily Logs** | ✅ Complete | Weather, crew, work performed |
| **Photos** | ✅ Complete | Gallery, tagging, lightbox |
| **Permits** | ✅ Complete | Applications, inspections, tracking |
| **Invoices** | ✅ Complete | AI extraction, OCR, approval workflow |
| **Purchase Orders** | ✅ Complete | CRUD, line items, approval |
| **Draws** | ✅ Complete | G702/G703, funding workflow |
| **Change Orders** | ✅ Complete | Approval workflow, budget updates |
| **Lien Releases** | ✅ Complete | Conditional/unconditional tracking |
| **Budget** | ✅ Complete | Cost codes, committed vs actual |
| **Bids** | ✅ Complete | Comparison, PO conversion |
| **RFIs** | ✅ Complete | Submit, respond, track |
| **Submittals** | ✅ Complete | Upload, review, approve |
| **Warranties** | ✅ Complete | 1-year tracking, claims |
| **Contracts** | 🔶 Basic | CRUD exists, needs templates & builder |
| **Signatures** | ✅ Complete | E-sign infrastructure ready |

### What's In Progress (v3.1)

| Module | Status | Description |
|--------|--------|-------------|
| **Expense Tracking** | ✅ Complete | Labor burden, fleet, overhead |
| **Digital Timesheets** | ✅ Complete | Time entry, approval |
| **Overhead Allocation** | ✅ Complete | % of Labor Hours method |
| **Job Profitability** | 🔶 Planned | True all-in costing |
| **WIP Schedule** | 🔶 Planned | Over/under billing |
| **Company P&L** | 🔶 Planned | Revenue, COGS, net income |
| **Cash Flow** | 🔶 Planned | AR/AP aging, 13-week forecast |
| **Business Planning** | 🔶 Planned | Backlog, KPIs, capacity |

---

## MASTER PLAN PHASES

### MEGA-PHASE 1: Contract Engine & Integration
**Duration: 4-5 weeks**
**Goal: Build complete contract lifecycle management**

This phase creates the contract foundation that ties the entire system together.

#### Phase 1.1: Contract Templates & Builder
**Week 1-2**

| Task | Description | Connects To |
|------|-------------|-------------|
| Contract Templates DB | Store templates with `{{VARIABLE}}` placeholders | - |
| Contract Clauses Library | Reusable clauses (indemnification, warranty, etc.) | - |
| Variable Substitution Engine | Auto-fill from leads, jobs, clients | Leads, Jobs, Clients |
| Contract Builder UI | Visual editor with clause selection | - |
| Florida Lien Law Disclosure | Required pre-signing disclosure modal | Signatures |

**Deliverables:**
- `/api/contract-templates` endpoints
- `/api/contract-clauses` endpoints
- ContractBuilder component
- Variable substitution service
- Default templates (PreConstruction, Construction)

#### Phase 1.2: Contract → Job Flow
**Week 3**

| Task | Description | Connects To |
|------|-------------|-------------|
| Lead → PreCon Agreement | Generate PreCon contract from lead data | Leads Pipeline |
| PreCon → Construction Contract | Convert with all data carried forward | Estimates |
| Contract → Job Conversion | Create job from signed contract | Jobs, Budget |
| Estimate → Budget Transfer | Copy approved estimate to job budget | Budget |

**Deliverables:**
- Lead detail "Create Agreement" action
- Contract generation from templates
- Job creation from contract
- Estimate-to-budget copy function

#### Phase 1.3: Contract Pricing Engine
**Week 4**

| Task | Description | Connects To |
|------|-------------|-------------|
| Contract Pricing Terms | Store fee %, retainage, CO markup tiers | Change Orders |
| Change Order Formula | Cost + Fee + Supervision Adjustment | Budget |
| Supervision Adjustment Calculator | Monthly fee ÷ months × extension | Schedule |
| Contract-Linked COs | COs reference contract pricing terms | Change Orders |

**Deliverables:**
- `contract_pricing_terms` table
- Updated CO form with contract-based pricing
- Automatic markup tier selection
- Schedule impact → cost adjustment

#### Phase 1.4: E-Signature & PDF
**Week 5**

| Task | Description | Connects To |
|------|-------------|-------------|
| PDF Generation Service | Professional contract PDFs | - |
| Signature Request Integration | Use existing signature system | Signatures |
| Lien Disclosure Workflow | Disclosure → Contract signing order | - |
| Signed Document Storage | Store final executed PDFs | Files |

**Deliverables:**
- PDF generation from contract content
- Florida Lien Disclosure modal
- Signature request creation
- Signed PDF storage

---

### MEGA-PHASE 2: Financial Intelligence Completion
**Duration: 3 weeks**
**Goal: Complete job costing and P&L visibility**

#### Phase 2.1: Job Profitability
**Week 6**

| Task | Description | Connects To |
|------|-------------|-------------|
| All-In Job Costing | Direct costs + burden + overhead | Budget, Timesheets |
| Profitability Comparison | Rank jobs by margin | Dashboard |
| Budget vs Actual | Cost code level comparison | Budget |
| Margin Analysis | Gross and net per job | Reports |

**Deliverables:**
- Job profitability API
- Profitability comparison report
- Cost code variance view
- Margin dashboard widget

#### Phase 2.2: WIP Schedule
**Week 7**

| Task | Description | Connects To |
|------|-------------|-------------|
| % Complete Calculation | Costs to date / estimated total | Budget, Draws |
| Earned Revenue | Contract × % complete | Contracts |
| Over/Under Billing Detection | Draws vs earned revenue | Draws |
| WIP Report | Standard contractor WIP format | Reports |

**Deliverables:**
- WIP calculation service
- Over/under billing alerts
- WIP Schedule page
- WIP export (Excel/PDF)

#### Phase 2.3: P&L Dashboard
**Week 8**

| Task | Description | Connects To |
|------|-------------|-------------|
| Revenue Tracking | Contract revenue + change orders | Contracts, COs |
| COGS Breakdown | Materials, labor, subs, equipment | Invoices, Budget |
| Operating Expenses | Overhead by category | Expenses |
| Period Comparison | Month vs month, YoY | - |

**Deliverables:**
- P&L Dashboard page
- Revenue by period chart
- COGS breakdown chart
- Gross/net margin metrics

---

### MEGA-PHASE 3: Cash Flow & Business Planning
**Duration: 2 weeks**
**Goal: Forward-looking financial intelligence**

#### Phase 3.1: Cash Flow Management
**Week 9**

| Task | Description | Connects To |
|------|-------------|-------------|
| AR Aging Report | 0-30, 31-60, 61-90, 90+ days | Draws |
| AP Aging Report | Invoices by due date | Invoices |
| 13-Week Cash Forecast | Project inflows/outflows | Draw schedules |
| Cash Position Dashboard | Current + projected | - |

**Deliverables:**
- AR/AP aging reports
- Cash flow forecast engine
- Cash Flow page
- Forecast alerts (low cash warning)

#### Phase 3.2: Business Planning Suite
**Week 10**

| Task | Description | Connects To |
|------|-------------|-------------|
| Backlog Report | Signed work not completed | Contracts, Jobs |
| KPI Dashboard | Configurable targets | All modules |
| Capacity Planning | Labor hours available vs needed | Timesheets, Schedule |
| Pipeline Visibility | Leads → Bids → Signed → In Progress | Leads, Estimates |

**Deliverables:**
- Business Planning page
- KPI configuration
- Backlog months calculation
- Capacity utilization chart

---

### MEGA-PHASE 4: Client Experience
**Duration: 3 weeks**
**Goal: Client-facing features**

#### Phase 4.1: Client Portal Foundation
**Week 11**

| Task | Description | Connects To |
|------|-------------|-------------|
| Portal Authentication | Separate client login | - |
| Project Dashboard | Client's view of their job | Jobs |
| Photo Gallery | Progress photos by date | Photos |
| Document Access | Shared documents | Files |

**Deliverables:**
- `/portal` routes
- Client authentication
- Project overview page
- Document sharing controls

#### Phase 4.2: Selections & Approvals
**Week 12**

| Task | Description | Connects To |
|------|-------------|-------------|
| Selection Interface | Browse & choose allowance items | Selections |
| Budget Visibility | See remaining allowance | Budget |
| Change Order Review | View and approve COs | Change Orders |
| Draw Visibility | See payment progress | Draws |

**Deliverables:**
- Client selection picker
- Allowance budget display
- CO approval workflow
- Draw status view

#### Phase 4.3: Communication & Messaging
**Week 13**

| Task | Description | Connects To |
|------|-------------|-------------|
| In-App Messaging | Builder ↔ Client chat | - |
| Decision Requests | Items needing client input | Selections, RFIs |
| Notification Preferences | Email, SMS, in-app | Notifications |
| Activity Feed | What happened today | Daily Logs, Photos |

**Deliverables:**
- Messaging interface
- Decision queue
- Notification settings
- Activity timeline

---

### MEGA-PHASE 5: Intelligence & Automation
**Duration: 3 weeks**
**Goal: Make the system smarter with use**

#### Phase 5.1: Document Intelligence Enhancement
**Week 14**

| Task | Description | Connects To |
|------|-------------|-------------|
| Plan Sheet Processing | Extract room dimensions, materials | Plans |
| Specification Parsing | Pull spec items into selections | Selections |
| Contract Extraction | Parse signed contracts for key terms | Contracts |
| Permit Doc Analysis | Extract inspection requirements | Permits |

**Deliverables:**
- Enhanced document AI
- Plan-to-estimate suggestion
- Spec-to-selection import
- Contract term extraction

#### Phase 5.2: Predictive Features
**Week 15**

| Task | Description | Connects To |
|------|-------------|-------------|
| Cost Prediction | Suggest costs based on history | Estimates |
| Duration Estimation | Predict task durations | Schedule |
| Vendor Recommendations | Suggest based on trade scores | Vendors |
| Risk Alerts | Identify potential issues | Dashboard |

**Deliverables:**
- Historical cost lookup
- Duration prediction API
- Vendor scoring recommendations
- Risk scoring engine

#### Phase 5.3: Automation Rules
**Week 16**

| Task | Description | Connects To |
|------|-------------|-------------|
| Trigger Engine | Event → Action automation | All modules |
| Notification Rules | Configurable alerts | Notifications |
| Status Transitions | Auto-advance workflows | Jobs, Tasks |
| Document Generation | Auto-create from triggers | Contracts, POs |

**Deliverables:**
- Automation rules engine
- Rule builder UI
- Common trigger templates
- Audit log of automations

---

### MEGA-PHASE 6: Integrations
**Duration: 4 weeks**
**Goal: Connect to external systems**

#### Phase 6.1: Accounting Integration
**Week 17-18**

| Task | Description | Connects To |
|------|-------------|-------------|
| QuickBooks Sync | Two-way invoice/payment sync | Invoices |
| Chart of Accounts Mapping | Cost codes ↔ QB accounts | Cost Codes |
| Vendor Sync | Bidirectional vendor data | Vendors |
| Job Costing Export | WIP data to QB | Budget |

**Deliverables:**
- QuickBooks OAuth connection
- Sync configuration UI
- Invoice push/pull
- Vendor sync service

#### Phase 6.2: Calendar & Communication
**Week 19**

| Task | Description | Connects To |
|------|-------------|-------------|
| Google/Outlook Calendar | Sync inspections, meetings | Schedule |
| Email Integration | Log email threads to leads/jobs | Leads, Jobs |
| SMS Notifications | Twilio integration | Notifications |
| Slack/Teams Alerts | Channel notifications | - |

**Deliverables:**
- Calendar OAuth
- Email logging service
- SMS provider integration
- Team chat webhooks

#### Phase 6.3: Industry Integrations
**Week 20**

| Task | Description | Connects To |
|------|-------------|-------------|
| Buildertrend Import | Migrate from BT | All modules |
| Procore Sync | Schedule/document exchange | Schedule, Files |
| Material Supplier APIs | Real-time pricing | Price Intelligence |
| Permit Portal API | Auto-submit applications | Permits |

**Deliverables:**
- BT migration tool
- Procore connector
- Supplier API integrations
- Permit submission automation

---

## Module Integration Map

This shows how every module connects to contracts and the financial layer:

```
                                    ┌─────────────────┐
                                    │     LEADS       │
                                    │   (Pipeline)    │
                                    └────────┬────────┘
                                             │
                                             ▼
┌─────────────────┐              ┌─────────────────────┐              ┌─────────────────┐
│    ESTIMATES    │◀────────────▶│     CONTRACTS       │◀────────────▶│      JOBS       │
│  (Cost Build)   │              │  (Legal Binding)    │              │   (Execution)   │
└────────┬────────┘              └──────────┬──────────┘              └────────┬────────┘
         │                                  │                                   │
         │                                  │                                   │
         │    ┌─────────────────────────────┼─────────────────────────────┐    │
         │    │                             │                             │    │
         │    │         FINANCIAL LAYER     │                             │    │
         │    │                             ▼                             │    │
         │    │    ┌─────────────────────────────────────────────┐       │    │
         ▼    │    │                                             │       │    ▼
┌──────────┐  │    │   ┌──────────┐   ┌──────────┐   ┌────────┐ │       │ ┌──────────┐
│  BUDGET  │◀─┼────┼──▶│ INVOICES │   │  DRAWS   │   │   COs  │◀┼───────┼─│ SCHEDULE │
│          │  │    │   │   & AP   │   │  & AR    │   │        │ │       │ │          │
└────┬─────┘  │    │   └────┬─────┘   └────┬─────┘   └────┬───┘ │       │ └────┬─────┘
     │        │    │        │              │              │     │       │      │
     │        │    │        └──────────────┼──────────────┘     │       │      │
     │        │    │                       │                    │       │      │
     │        │    │                       ▼                    │       │      │
     │        │    │              ┌─────────────────┐           │       │      │
     │        │    │              │   CASH FLOW     │           │       │      │
     │        │    │              │   & FORECAST    │           │       │      │
     │        │    │              └────────┬────────┘           │       │      │
     │        │    │                       │                    │       │      │
     │        │    │                       ▼                    │       │      │
     │        │    │              ┌─────────────────┐           │       │      │
     └────────┼────┼─────────────▶│  JOB COSTING    │◀──────────┘       │      │
              │    │              │  & PROFITABILITY │                  │      │
              │    │              └────────┬────────┘                   │      │
              │    │                       │                            │      │
              │    │                       ▼                            │      │
              │    │              ┌─────────────────┐                   │      │
              │    │              │    COMPANY      │                   │      │
              │    │              │      P&L        │                   │      │
              │    │              └─────────────────┘                   │      │
              │    │                                                    │      │
              │    └────────────────────────────────────────────────────┘      │
              │                                                                │
              │                                                                │
              │    ┌───────────────────────────────────────────────────────┐  │
              │    │                   FIELD OPERATIONS                    │  │
              │    │                                                       │  │
              │    │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │  │
              └────┼─▶│  DAILY   │  │  PHOTOS  │  │  PERMITS │  │  RFIs │◀┼──┘
                   │  │   LOGS   │  │          │  │          │  │       │ │
                   │  └──────────┘  └──────────┘  └──────────┘  └───────┘ │
                   │                                                       │
                   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │
                   │  │SUBMITTALS│  │SELECTIONS│  │  PUNCH   │  │ TIME  │ │
                   │  │          │  │          │  │  LISTS   │  │SHEETS │ │
                   │  └──────────┘  └──────────┘  └──────────┘  └───────┘ │
                   │                                                       │
                   └───────────────────────────────────────────────────────┘

                   ┌───────────────────────────────────────────────────────┐
                   │                    CLOSEOUT                           │
                   │                                                       │
                   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │
                   │  │   LIEN   │  │  FINAL   │  │WARRANTY  │  │RETAINA│ │
                   │  │ RELEASES │  │   DOCS   │  │ TRACKING │  │  GE   │ │
                   │  └──────────┘  └──────────┘  └──────────┘  └───────┘ │
                   │                                                       │
                   └───────────────────────────────────────────────────────┘
```

---

## Contract Integration Points

The contract touches almost every part of the system:

### Pre-Contract (Lead Phase)
| Module | Contract Connection |
|--------|---------------------|
| **Leads** | Lead data populates contract variables (name, address, project description) |
| **Estimates** | Estimate total becomes contract amount; line items become exhibits |
| **Selections** | Selection choices inform contract scope and allowance schedules |

### Contract Terms
| Module | Contract Connection |
|--------|---------------------|
| **Change Orders** | Contract defines markup % tiers and supervision adjustment formula |
| **Draws** | Contract defines payment schedule, retainage %, draw frequency |
| **Lien Releases** | Contract includes FL Lien Law disclosure; liens reference contract |
| **Schedule** | Contract defines substantial completion date; delays trigger supervision adjustment |

### Post-Contract (Execution)
| Module | Contract Connection |
|--------|---------------------|
| **Budget** | Contract amount becomes budget; approved estimate lines become budget lines |
| **Job Costing** | Contract profit/fee tracked against actual costs |
| **WIP Schedule** | Contract amount used for % complete and earned revenue calculations |
| **Warranties** | Contract warranty terms (1-year workmanship) drive warranty tracking |

### Financial Reporting
| Module | Contract Connection |
|--------|---------------------|
| **Cash Flow** | Contract draw schedule drives inflow forecast |
| **P&L** | Contract revenue recognized per WIP % complete |
| **Backlog** | Signed contracts minus completed work = backlog |

---

## Implementation Priority

### Critical Path (Must Build First)
1. **Contract Templates & Variables** - Foundation for everything
2. **Contract → Job Flow** - Connects leads to jobs
3. **Contract Pricing Engine** - Drives change order calculations
4. **E-Signature Integration** - Legally binding contracts

### High Value (Build Next)
5. **Job Profitability Reports** - True cost visibility
6. **WIP Schedule** - Over/under billing detection
7. **P&L Dashboard** - Business health visibility
8. **Cash Flow Forecast** - Financial planning

### Strategic (Build When Stable)
9. **Client Portal** - Client-facing experience
10. **Document Intelligence** - AI enhancement
11. **Integrations** - Connect to QuickBooks, etc.
12. **Automation** - Reduce manual work

---

## Success Metrics

### Contract System
| Metric | Target |
|--------|--------|
| Contract creation time | < 10 minutes |
| E-signature completion | < 48 hours |
| Variable accuracy | 100% auto-fill |
| Template reuse rate | > 80% |

### Financial System
| Metric | Target |
|--------|--------|
| Invoice processing time | < 2 minutes |
| Cost allocation accuracy | > 95% |
| Budget variance visibility | Real-time |
| Cash forecast accuracy | ±10% at 4 weeks |

### Client Experience
| Metric | Target |
|--------|--------|
| Selection turnaround | < 24 hours |
| Change order approval | < 72 hours |
| Client satisfaction | > 90% |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Contract legal compliance | Florida Lien Law disclosure mandatory |
| Data accuracy | Validation rules on all financial entries |
| E-signature validity | Full audit trail, IP logging, timestamps |
| Integration complexity | Start with QuickBooks only, expand later |
| Scope creep | Phase-based approach, validate each phase |

---

## Timeline Summary

| Phase | Duration | Focus |
|-------|----------|-------|
| **Mega-Phase 1** | 5 weeks | Contract Engine |
| **Mega-Phase 2** | 3 weeks | Financial Intelligence |
| **Mega-Phase 3** | 2 weeks | Cash Flow & Planning |
| **Mega-Phase 4** | 3 weeks | Client Portal |
| **Mega-Phase 5** | 3 weeks | AI & Automation |
| **Mega-Phase 6** | 4 weeks | Integrations |
| **TOTAL** | **20 weeks** | Full System |

---

## Immediate Next Steps

1. **This Week**: Start Phase 1.1 - Contract Templates
   - Create database migrations
   - Build template CRUD API
   - Create clause library
   - Implement variable substitution

2. **Next Week**: Contract Builder UI
   - Visual template editor
   - Variable insertion toolbar
   - Preview functionality

3. **Week 3**: Lead → Contract Flow
   - "Create Agreement" action on leads
   - Auto-populate from lead data
   - Send for signature

---

*Created: February 3, 2026*
*This plan ties together all existing modules with the new contracts system and completes the financial intelligence layer.*
