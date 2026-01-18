# Roadmap: Ross Built CMS v1.4

## Overview

v1.4 Price Intelligence builds a comprehensive price tracking and order optimization system. Six phases: database foundation, price database backend, order optimizer backend, savings & analytics backend, frontend implementation, and PO integration.

## Milestones

- **v1.3 Refinement** - Phases 18-23 (shipped 2026-01-18)
- **v1.4 Price Intelligence** - Phases 24-29 (in progress)

## Phases

- [ ] **Phase 24: Database Foundation** - Schema, tables, materialized views, seed data
- [ ] **Phase 25: Price Database Backend** - Master items API, price history, vendor aliases
- [ ] **Phase 26: Order Optimizer Backend** - Optimization algorithm, waste factors, PO generation
- [ ] **Phase 27: Savings & Analytics Backend** - Savings tracking, spend analytics, negotiation targets
- [ ] **Phase 28: Frontend Implementation** - Price Intelligence page with 4 tabs
- [ ] **Phase 29: PO Integration** - Price check endpoint, warning banners in PO modal

## Phase Details

### Phase 24: Database Foundation
**Goal**: Create database schema for price intelligence system
**Depends on**: Nothing (first v1.4 phase)
**Requirements**: None (infrastructure)
**Success Criteria** (what must be TRUE):
  1. All v2_* tables for price intelligence exist in database
  2. Materialized view v2_current_prices returns latest price per item/vendor
  3. Waste factors seeded with construction category defaults
  4. Vendor table has delivery/lead time columns
**Research**: Unlikely (existing Supabase patterns)
**Plans**: 24-01-PLAN.md (Schema Migration)

### Phase 25: Price Database Backend
**Goal**: API for master items with vendor price comparison
**Depends on**: Phase 24
**Requirements**: PRC-01
**Success Criteria** (what must be TRUE):
  1. User can list/search master items via API
  2. User can view all vendor prices for a master item
  3. Prices are normalized to common units ($/each, $/lf, $/sf)
  4. Confidence scores reflect data quality
**Research**: Unlikely (existing Express patterns)
**Plans**: 25-01-PLAN.md (Price Database API)

### Phase 26: Order Optimizer Backend
**Goal**: Optimization algorithm for material lists
**Depends on**: Phase 25
**Requirements**: PRC-02
**Success Criteria** (what must be TRUE):
  1. User can submit material list and get vendor split recommendations
  2. Waste factors applied by category
  3. Lead time filtering works when need-by date specified
  4. Optimization includes delivery fees in total cost
  5. User can generate POs from optimization results
**Research**: Unlikely (algorithmic, internal patterns)
**Plans**: 26-01-PLAN.md (Order Optimizer API)

### Phase 27: Savings & Analytics Backend
**Goal**: APIs for savings tracking and spend analytics
**Depends on**: Phase 25
**Requirements**: PRC-03, PRC-04
**Success Criteria** (what must be TRUE):
  1. User can log savings entries when using optimized orders
  2. User can view savings by job, category, and time period
  3. User can view vendor spend breakdown and ranking
  4. Negotiation insights surface high-spend vendors
**Research**: Unlikely (existing reporting patterns from v1.3)
**Plans**: 27-01-PLAN.md (Savings & Analytics API)

### Phase 28: Frontend Implementation
**Goal**: Price Intelligence page with 4 tabs
**Depends on**: Phases 25, 26, 27
**Requirements**: PRC-01, PRC-02, PRC-03, PRC-04 (UI)
**Success Criteria** (what must be TRUE):
  1. User can access Price Intelligence from navigation
  2. Price Database tab shows items with vendor price comparison
  3. Order Optimizer tab accepts material list and shows recommendations
  4. Savings Tracker tab shows savings summary and history
  5. Spend Analytics tab shows vendor spend and negotiation insights
**Research**: Unlikely (existing page patterns)
**Plans**: 28-01-PLAN.md (Price Intelligence Page)

### Phase 29: PO Integration
**Goal**: Better-pricing warnings on PO creation
**Depends on**: Phase 25
**Requirements**: PRC-05
**Success Criteria** (what must be TRUE):
  1. Price check API returns better options for PO line items
  2. Warning banner appears in PO modal when better pricing available
  3. User can view alternatives without leaving modal
  4. User can dismiss warnings
**Research**: Unlikely (existing PO modal patterns)
**Plans**: 29-01-PLAN.md (PO Price Warnings)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 24. Database Foundation | 1/1 | Complete | 2026-01-18 |
| 25. Price Database Backend | 1/1 | Complete | 2026-01-18 |
| 26. Order Optimizer Backend | 1/1 | Complete | 2026-01-18 |
| 27. Savings & Analytics Backend | 1/1 | Complete | 2026-01-18 |
| 28. Frontend Implementation | 0/1 | Not started | - |
| 29. PO Integration | 0/1 | Not started | - |

---
*Roadmap created: 2026-01-18*
