# Requirements: Ross Built CMS v1.7

**Defined:** 2026-01-19
**Core Value:** Foolproof invoice → approval → draw → budget pipeline with accurate data flow

## v1 Requirements

Requirements for v1.7 Data Integrity & AI Accuracy milestone.

### Budget Integrity

- [ ] **BUD-INT-01**: Create `increment_committed_amount` RPC function that atomically updates budget committed amounts when PO approved
- [ ] **BUD-INT-02**: Create `decrement_committed_amount` RPC function that atomically reverses committed amounts when PO voided
- [ ] **BUD-INT-03**: Prevent budget line creation with zero budgeted_amount (require explicit budget before invoicing)
- [ ] **BUD-INT-04**: Sync committed_amount correctly across all PO lifecycle events (create, approve, void, CO approval)

### Invoice Pipeline

- [ ] **INV-INT-01**: Clean up allocations when invoice status transitions to denied/deleted (remove from PO line items, budget lines)
- [ ] **INV-INT-02**: Wrap critical invoice operations in database transactions (approve, allocate, add-to-draw)
- [ ] **INV-INT-03**: Recalculate billed_amount when allocations are modified after invoice added to draw
- [ ] **INV-INT-04**: Validate that allocation sum equals invoice amount before allowing approval

### Draw Accuracy

- [ ] **DRW-INT-01**: Always recalculate draw total from allocations on GET endpoint (don't trust stored total_amount)
- [ ] **DRW-INT-02**: Include all budgeted cost codes in G703 even if no billings yet (show 0% progress)
- [ ] **DRW-INT-03**: Validate draw allocations match source invoice allocations (detect drift)

### PO/CO Linking

- [ ] **PO-INT-01**: Sync PO line item invoiced_amount bidirectionally when allocations change
- [ ] **PO-INT-02**: Track CO invoiced_amount correctly when invoices with CO allocations are approved
- [ ] **PO-INT-03**: Reverse committed_amount in budget when PO is voided (currently orphaned)
- [ ] **PO-INT-04**: Prevent double-counting of CO billings (validate mutual exclusivity of manual vs allocated vs unlinked)

### AI Accuracy

- [ ] **AI-INT-01**: Raise job matching confidence threshold from 0.5 to 0.7 minimum
- [ ] **AI-INT-02**: Improve scanTextForKnownJobs to check more text patterns (ship-to, project, customer fields)
- [ ] **AI-INT-03**: Add robust date validation (reject dates like 2024-05-34, use null instead)
- [ ] **AI-INT-04**: Improve vendor name extraction from top of invoice (not confuse with customer/job)

## v2 Requirements

Deferred to future release.

### Advanced Integrity

- **ADV-INT-01**: Scheduled nightly reconciliation job with alerts
- **ADV-INT-02**: Automatic detection and repair of data inconsistencies
- **ADV-INT-03**: Full audit log of all financial state changes

## Out of Scope

| Feature | Reason |
|---------|--------|
| Retainage calculations | User explicitly excluded |
| Multi-currency support | Single currency (USD) sufficient |
| External sync (QuickBooks) | Future integration milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUD-INT-01 | Phase 43 | Complete |
| BUD-INT-02 | Phase 43 | Complete |
| BUD-INT-03 | Phase 43 | Complete |
| BUD-INT-04 | Phase 43 | Complete |
| INV-INT-01 | Phase 44 | Complete |
| INV-INT-02 | Phase 44 | Complete |
| INV-INT-03 | Phase 44 | Complete |
| INV-INT-04 | Phase 44 | Complete |
| DRW-INT-01 | Phase 45 | Pending |
| DRW-INT-02 | Phase 45 | Pending |
| DRW-INT-03 | Phase 45 | Pending |
| PO-INT-01 | Phase 45 | Pending |
| PO-INT-02 | Phase 45 | Pending |
| PO-INT-03 | Phase 45 | Pending |
| PO-INT-04 | Phase 45 | Pending |
| AI-INT-01 | Phase 46 | Pending |
| AI-INT-02 | Phase 46 | Pending |
| AI-INT-03 | Phase 46 | Pending |
| AI-INT-04 | Phase 46 | Pending |

**Coverage:**
- v1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0 ✓

---
*Requirements defined: 2026-01-19*
*Last updated: 2026-01-19 after Phase 44 complete*
