# Requirements: Ross Built CMS v1.8

**Defined:** 2026-01-19
**Core Value:** Comprehensive data linkage with variance detection, quick fixes, and correlated data across POs, invoices, draws, and budgets.

## v1 Requirements

Requirements for v1.8 Invoice Variance & Data Linkage milestone.

### Variance Detection

- [x] **VAR-01**: Polish variance detection service - test thoroughly, refine line item matching algorithms, ensure VPO matching works
- [x] **VAR-02**: Add UI to create Change Order or VPO directly from variance warning banners in invoice modal
- [x] **VAR-03**: Complete VPO UI integration - ensure VPO section visible in PO modal, test create/edit/void workflows

### Cost Code Linkage

- [ ] **CCL-01**: Improve AI cost code assignment accuracy on invoice processing - use vendor trade, description keywords
- [ ] **CCL-02**: Validate PO line items have proper cost codes on creation - warn or require cost code selection
- [ ] **CCL-03**: Fix line item matching between invoices and PO line items - improve text similarity, amount matching
- [ ] **CCL-04**: Validate G703 cost code accuracy - ensure all allocated codes appear, totals match

### Data Correlation

- [ ] **COR-01**: Validate PO ↔ Invoice ↔ Draw linkage consistency - detect orphaned allocations, broken links
- [ ] **COR-02**: Ensure CO/VPO totals reflected correctly in PO totals, budget committed amounts, and reports
- [ ] **COR-03**: Integrate variance detection with price intelligence - flag when invoice line exceeds known best price
- [ ] **COR-04**: Budget vs actual accuracy validation - committed vs billed vs paid tracking

### AI PO Generation

- [ ] **AIPO-01**: Refine document upload auto-PO generation - improve line item extraction from proposals/quotes
- [ ] **AIPO-02**: Improve cost code assignment on AI-generated PO line items - use description keywords, vendor trade
- [ ] **AIPO-03**: Better linking of AI-generated POs to vendors (fuzzy match) and jobs (from document context)

### Quick Fixes

- [ ] **FIX-01**: One-click to fix broken linkages from error displays - reassign cost code, change PO link, etc.
- [ ] **FIX-02**: Bulk correction tools for common issues - batch reassign cost codes, batch fix allocations
- [ ] **FIX-03**: Clear error messages showing what's wrong and how to fix - actionable guidance, not just errors

## v2 Requirements

Deferred to future release.

### Advanced Features

- **ADV-01**: Scheduled nightly data integrity check with email alerts
- **ADV-02**: Historical variance trend analysis and reporting
- **ADV-03**: Machine learning for cost code prediction improvement

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-company tenancy | Single company use case |
| External integrations (QuickBooks) | Future milestone |
| Mobile native app | Web works on mobile |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VAR-01 | 47 | Complete |
| VAR-02 | 47 | Complete |
| VAR-03 | 47 | Complete |
| CCL-01 | 48 | Pending |
| CCL-02 | 48 | Pending |
| CCL-03 | 48 | Pending |
| CCL-04 | 48 | Pending |
| COR-01 | 49 | Pending |
| COR-02 | 49 | Pending |
| COR-03 | 49 | Pending |
| COR-04 | 49 | Pending |
| AIPO-01 | 50 | Pending |
| AIPO-02 | 50 | Pending |
| AIPO-03 | 50 | Pending |
| FIX-01 | 51 | Pending |
| FIX-02 | 51 | Pending |
| FIX-03 | 51 | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-01-19*
