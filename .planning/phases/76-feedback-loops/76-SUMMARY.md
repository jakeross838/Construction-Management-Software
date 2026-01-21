# Phase 76: Feedback Loops - Summary

**Completed:** 2026-01-20
**Migration:** 089

---

## What Was Built

### Database (migration-089-feedback-loops.sql)

1. **v2_price_actuals table**:
   - Tracks actual prices paid vs catalog estimates
   - Variance calculation and percentage
   - Date of actual
   - Source: invoice, po, receipt

2. **v2_duration_actuals table**:
   - Tracks actual installation durations
   - Variance from estimated
   - Crew size used
   - Conditions/factors affecting duration

3. **v2_lead_time_actuals table**:
   - Tracks actual lead times
   - Order date, expected date, actual delivery
   - Variance in days
   - Vendor/supplier tracking

4. **v2_catalog_price_history table**:
   - Historical price changes per catalog item
   - Effective dates
   - Reason for change
   - Source of update (manual, feedback, market)

5. **v2_feedback_rules table**:
   - Configurable auto-update rules
   - Threshold for triggering updates
   - Minimum sample size
   - Approval required flag

6. **Database functions**:
   - `record_price_actual(item_id, actual_price, source_id)` - Log actual
   - `calculate_price_trend(item_id)` - Get price trajectory
   - `suggest_price_update(item_id)` - Recommend catalog update
   - `auto_update_catalog_prices()` - Batch update based on rules

---

## Feedback Types

### 1. Invoice Actuals → Catalog Pricing

When invoice is approved:
- Compare line item prices to catalog
- Record variance
- After N invoices, suggest price update
- Auto-update if variance exceeds threshold

### 2. Delivery Dates → Lead Times

When delivery receipt processed:
- Compare actual delivery to expected
- Record lead time actual
- Update vendor lead time estimates
- Flag vendors with poor accuracy

### 3. Daily Logs → Duration Estimates

When task marked complete:
- Compare actual hours to estimated
- Record duration actual with conditions
- Adjust estimates for similar items
- Factor in crew size variance

### 4. Trade Performance → Scorecards

When job completes:
- Calculate trade performance metrics
- Update vendor scores
- Adjust capacity estimates
- Feed recommendation engine

### 5. Warranty Claims → Product Flags

When warranty issue logged:
- Flag product in catalog
- Add to knowledge base as warning
- Adjust quality tier if pattern emerges
- Notify on future selections

---

## API Endpoints

### Record Actuals
- `POST /api/feedback/price-actual` - Record price actual
- `POST /api/feedback/duration-actual` - Record duration actual
- `POST /api/feedback/lead-time-actual` - Record lead time actual

### Get Feedback
- `GET /api/catalog/:id/price-history` - Price history for item
- `GET /api/catalog/:id/actuals` - All actuals for item
- `GET /api/feedback/pending-updates` - Items needing price updates

### Configure Rules
- `GET /api/feedback/rules` - List feedback rules
- `PATCH /api/feedback/rules/:id` - Update rule settings

### Apply Feedback
- `POST /api/catalog/:id/apply-feedback` - Update item from feedback
- `POST /api/feedback/batch-update` - Apply all pending updates

---

## Auto-Update Rules

Default configuration:

| Metric | Threshold | Sample Size | Auto-Update |
|--------|-----------|-------------|-------------|
| Price | ±10% | 3 invoices | Yes |
| Duration | ±20% | 5 jobs | No (suggest) |
| Lead Time | ±3 days | 3 orders | Yes |

---

## UI Features

### Feedback Dashboard

- Pending updates awaiting approval
- Recent auto-updates log
- Items with significant variance
- Trend charts by category

### Catalog Item Feedback Tab

- Price history graph
- Actual vs estimated comparison
- Suggested updates with rationale
- Apply/dismiss actions

### Vendor Feedback

- Lead time accuracy rating
- Price stability indicator
- Performance trend

---

## Notes

Feedback Loops close the data cycle:
1. **Catalog provides estimates** → Used in quotes and schedules
2. **Work happens** → Invoices, deliveries, daily logs
3. **Actuals captured** → Compared to estimates
4. **Catalog updated** → Better future estimates

This makes the system smarter with each project:
- Prices reflect current market
- Durations reflect actual productivity
- Lead times reflect vendor performance
- Quality tiers reflect real-world performance
