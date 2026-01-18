# Requirements: Ross Built CMS v1.4

**Defined:** 2026-01-18
**Core Value:** Streamline construction financial workflows from bidding through payment

## v1.4 Requirements

Requirements for v1.4 Price Intelligence. Each maps to roadmap phases.

### Price Database

- [ ] **PRC-01**: User can browse/search master items with vendor price comparison
  - Master item catalog with standard names and units
  - Vendor item aliases map vendor descriptions to master items
  - Price history from invoices, quotes, and manual entry
  - Normalized pricing ($/each, $/lf, $/sf, $/bf)
  - Confidence scoring based on data quality

### Order Optimizer

- [ ] **PRC-02**: User can paste material list and get optimal vendor split recommendations
  - Match input descriptions to master items
  - Apply waste factors by category (lumber 5%, drywall 10%, etc.)
  - Filter by lead time if need-by date specified
  - Optimize for lowest total cost including delivery fees
  - Generate POs directly from optimization results

### Savings Tracker

- [ ] **PRC-03**: User can track savings from optimized orders over time
  - Log savings entries when using optimized orders
  - View savings summary by job, category, and time period
  - Track baseline cost vs actual spend

### Spend Analytics

- [ ] **PRC-04**: User can analyze vendor spend for negotiation leverage
  - Vendor spend breakdown and ranking
  - Category spend analysis
  - Negotiation insights for high-spend vendors

### PO Integration

- [ ] **PRC-05**: User sees price warning when creating PO with better options available
  - Price check when adding/editing PO line items
  - Warning banner if better pricing found
  - View alternatives without leaving PO modal

## v2 Requirements

Deferred to future releases.

### Advanced Features

- **ADV-01**: Mobile native app (if web insufficient)
- **ADV-02**: Multi-company tenancy
- **ADV-03**: Advanced Gantt (milestones, resource leveling)
- **ADV-04**: AI-powered budget forecasting (beyond basic trends)
- **ADV-05**: Quote document OCR extraction (auto-populate prices from uploaded quotes)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time price feeds | No API integration with suppliers (manual/invoice-based) |
| Automated vendor bidding | Manual process works, not replacing workflow |
| Inventory management | Separate domain, defer to v2+ |
| Multi-currency support | Single company, USD only |

## Traceability

Which phases cover which requirements. Updated by create-roadmap.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PRC-01 | TBD | Pending |
| PRC-02 | TBD | Pending |
| PRC-03 | TBD | Pending |
| PRC-04 | TBD | Pending |
| PRC-05 | TBD | Pending |

**Coverage:**
- v1.4 requirements: 5 total
- Mapped to phases: 0 (awaiting roadmap)
- Unmapped: 5

---
*Requirements defined: 2026-01-18*
