# Project Brief: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Started as invoice processing, evolved into a complete business operating system, now becoming a **data-driven estimation and intelligence platform** where every document enriches the system and every actual feeds back to improve future predictions.

**Last Milestone:** v2.1 - Selections & Navigation Polish (shipped 2026-01-20)
**Current Milestone:** v3.0 - Smart Catalog & Estimation Engine

## Core Value

**Run your entire construction business from one intelligent system** - where every document uploaded, every selection made, and every invoice paid makes the system smarter. From leads through closeout, with AI-powered data extraction that flows to all connected systems.

## Current Milestone: v3.0 Smart Catalog & Estimation Engine

**Goal:** Build the data infrastructure that turns Ross Built CMS into an estimation and scheduling engine. Every piece of information flows to all relevant systems, and actuals feed back to improve future predictions.

**Vision:** Staff creates estimate → picks selections from growing catalog → system calculates costs with material, labor, lead times → generates schedule by trade → converts to bids, scopes, POs as project progresses. Eventually opens to architects/designers as lead generation channel.

**Target features:**

### Catalog Database Enhancement
- Products with full data: base cost, labor hours, install duration, lead time, waste factor, quality tier
- Physical specs: dimensions, weight, coverage rate
- Dependencies: what must happen before/after installation
- Permit triggers: which products require permits
- Rough-in requirements: what other trades need to prep
- Vendor links: who sells it, their prices, their lead times
- Trade links: who installs it, their rates
- Warranty tracking: terms, manufacturer, duration

### Trade/Vendor Scorecards
- Cost tracking: their rates, bid accuracy vs actuals
- Quality scores: from completed job ratings
- Speed ratings: actual duration vs quoted
- Reliability: on-time delivery, callbacks, warranty claims
- Capacity: current workload, availability windows

### Document Intelligence (AI Parsing)
- Upload any document (appliance proposal, flooring quote, cabinet bid)
- AI extracts: products, prices, lead times, specs, requirements
- Data routes to ALL relevant systems:
  - Catalog: new/updated products
  - Price Intelligence: current market pricing
  - Schedule: lead time implications
  - Permits: requirement flags
  - Rough-ins: prep work for other trades
  - Warranties: terms for closeout

### Estimate Builder
- Pick selections from catalog
- Enter/import house details (sqft, rooms, dimensions)
- System calculates:
  - Material quantities (dimensions × coverage rate)
  - Material costs (qty × price × (1 + waste factor))
  - Labor costs (qty × labor hours × rate)
  - Total installed cost per selection
- Fine-tune with overrides
- Save estimate versions

### Schedule Generator
- Derive timeline from selections
- Sequence trades by dependencies
- Factor in lead times (cabinets = 8-12 weeks!)
- Account for cure times, inspections
- Show critical path

### Optimization Layer (future)
- Toggle priority: Budget / Quality / Timeline
- Auto-recommend trades based on priority
- Show tradeoffs between options

### Downstream Flow
- Estimate → Allowance budgets (when job starts)
- Estimate → Scopes of work (per trade)
- Scopes → Bid requests (to qualified trades)
- Bids → POs (when approved)
- Selections → Change Orders (when over allowance)

### Feedback Loops
- Invoice actuals → update catalog pricing
- Delivery dates → update lead time estimates
- Install durations → update time estimates
- Trade performance → update scorecards
- Warranty claims → flag problematic products

**Deferred to v3.1+:**
- Lead-facing questionnaire and selection portal
- AI floor plan extraction
- Architect/designer portal
- Calendar integrations
- QuickBooks sync

## Current State (v2.1 Shipped)

**Shipped:** 2026-01-20

Visual product catalog with:
- Photo-driven browsing with category hierarchy
- Search and filters (category, vendor, price, room)
- Product detail modal with gallery
- Add/edit products with image upload
- Category management
- Selections linked to jobs via allowances
- Allowance variance tracking with CO generation

## Feature Inventory

Shipped through v2.1 with ~105,000+ lines of JavaScript across 110+ files.

**Fully Complete:**
- Invoices - AI extraction, OCR, approval workflow, PDF stamping, splits, credits
- Purchase Orders - CRUD, line items, approval, change orders, attachments
- Draws - G702/G703, Excel/PDF export, workflow
- Bids - CRUD, documents, comparison, PO conversion
- Estimates - Line items, versioning, bid import, budget conversion
- Price Intelligence - Master items, vendor prices, order optimizer, savings tracker
- Leads/CRM - Pipeline, qualification, activities, job conversion
- Selections/Allowances - Visual catalog, budgets, variance tracking, change orders
- Crew Scheduling - Work requests, auto-scheduling, calendar view
- Permitting - Applications, inspections, documents, status tracking
- Job Hub - 360° view with financials, activity, status
- All scaffold modules (RFIs, Submittals, Tasks, Messaging, Notifications, Warranties, Closeout)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Frontend | Vanilla JavaScript |
| AI | Claude API (Anthropic) |
| PDF | pdf-lib, pdf-parse |
| Charts | Chart.js |

**Key Patterns:**
- All tables use `v2_` prefix
- Soft deletes via `deleted_at`
- Modal class `.show` required for visibility
- API caching via `window.APICache`
- asyncHandler wrapper on all routes

## Constraints

1. **No frameworks** - Keep frontend vanilla JS
2. **Dark theme only** - Use CSS variables
3. **Existing patterns** - Follow conventions in CLAUDE.md
4. **Supabase** - All data through Supabase client
5. **Migration numbering** - Continue from current highest

## Requirements

### Validated (Shipped v1.0-v2.1)

All previous milestone requirements shipped and validated. See MILESTONES.md for history.

### v3.0 Smart Catalog & Estimation Engine (Active)

**Catalog Enhancement:**
- [ ] CAT-ENH-01: Catalog items have labor hours, install duration, lead time fields
- [ ] CAT-ENH-02: Catalog items have waste factor and coverage rate
- [ ] CAT-ENH-03: Catalog items have quality tier (builder/standard/premium)
- [ ] CAT-ENH-04: Catalog items link to compatible trades
- [ ] CAT-ENH-05: Catalog items have permit requirement flags
- [ ] CAT-ENH-06: Catalog items have rough-in requirements
- [ ] CAT-ENH-07: Catalog items have dependency relationships (before/after)
- [ ] CAT-ENH-08: Catalog items have warranty terms

**Trade Scorecards:**
- [ ] TRADE-01: Trade/vendor records with cost, quality, speed, reliability scores
- [ ] TRADE-02: Trade capacity and availability tracking
- [ ] TRADE-03: Trade performance updates from completed work
- [ ] TRADE-04: Trade recommendations based on job requirements

**Document Intelligence:**
- [ ] DOC-INT-01: AI parses uploaded proposals/quotes for product data
- [ ] DOC-INT-02: Parsed data routes to catalog (new/updated products)
- [ ] DOC-INT-03: Parsed data routes to price intelligence
- [ ] DOC-INT-04: Parsed data routes to schedule (lead times)
- [ ] DOC-INT-05: Parsed data flags permit requirements
- [ ] DOC-INT-06: Parsed data captures rough-in requirements
- [ ] DOC-INT-07: Parsed data captures warranty terms

**Estimate Builder:**
- [ ] EST-BLD-01: Create estimate from catalog selections
- [ ] EST-BLD-02: Enter house details (sqft, rooms, dimensions)
- [ ] EST-BLD-03: Auto-calculate material quantities from dimensions
- [ ] EST-BLD-04: Auto-calculate costs (material + labor)
- [ ] EST-BLD-05: Fine-tune estimates with overrides
- [ ] EST-BLD-06: Save and version estimates

**Schedule Generator:**
- [ ] SCHED-01: Generate schedule from estimate selections
- [ ] SCHED-02: Sequence trades by dependencies
- [ ] SCHED-03: Factor lead times into schedule
- [ ] SCHED-04: Show critical path
- [ ] SCHED-05: Account for cure times and inspections

**Downstream Conversion:**
- [ ] FLOW-01: Convert estimate to allowance budgets
- [ ] FLOW-02: Generate scopes of work from estimate
- [ ] FLOW-03: Create bid requests from scopes
- [ ] FLOW-04: Convert approved bids to POs

**Feedback Loops:**
- [ ] FEED-01: Invoice actuals update catalog pricing
- [ ] FEED-02: Actual delivery dates update lead time estimates
- [ ] FEED-03: Actual durations update install time estimates
- [ ] FEED-04: Trade performance updates scorecards
- [ ] FEED-05: Warranty claims flag products

### Out of Scope (v3.0)

| Feature | Reason |
|---------|--------|
| Lead-facing portal | Build internal tool first, validate, then expose |
| AI floor plan extraction | Complex, manual entry works for v3.0 |
| Architect/designer portal | Future lead gen channel after core is solid |
| Calendar integrations | Not critical for estimation engine |
| QuickBooks sync | Separate integration milestone |
| Budget/quality/timeline optimizer | After data collection proves valuable |

## Key Decisions

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-01-20 | v3.0 is major version | Architectural shift to data intelligence platform | — Pending |
| 2026-01-20 | Internal first, leads later | Validate estimation engine before exposing to leads | — Pending |
| 2026-01-20 | Full trade scorecards | Cost + quality + speed + reliability + capacity | — Pending |
| 2026-01-20 | Document intelligence routes to all systems | Every upload enriches entire platform | — Pending |
| 2026-01-20 | Feedback loops from actuals | System gets smarter with use | — Pending |

## References

- `CLAUDE.md` - Full system documentation
- `.planning/codebase/` - Codebase mapping
- `.planning/MILESTONES.md` - Shipped milestones
- `database/migration-*.sql` - Schema history

---
*Last updated: 2026-01-20 — v3.0 Smart Catalog & Estimation Engine started*
