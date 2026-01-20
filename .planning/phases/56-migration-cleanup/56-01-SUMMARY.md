# Phase 56-01: Migration Cleanup

## Completed: 2026-01-19

### What Was Done

Renamed 8 migration files with duplicate numbers to sequential numbers 067-074:

| Original Name | New Name |
|--------------|----------|
| migration-006-draw-edits.sql | migration-067-draw-edits.sql |
| migration-006-reconciliation.sql | migration-068-reconciliation.sql |
| migration-006-vendor-details.sql | migration-069-vendor-details.sql |
| migration-007-vendor-documents.sql | migration-070-vendor-documents.sql |
| migration-008-co-invoices.sql | migration-071-co-invoices.sql |
| migration-009-co-days.sql | migration-072-co-days.sql |
| migration-025-simplify-allocation-links.sql | migration-073-simplify-allocation-links.sql |
| migration-026-credit-invoices.sql | migration-074-credit-invoices.sql |

### Files Changed

| File | Action |
|------|--------|
| 8 migration files in `database/` | Renamed |

### Duplicate Numbers Resolved

| Original # | Files (first kept, others renamed) |
|-----------|-----------------------------------|
| 006 | billing-tracking (kept), draw-edits, reconciliation, vendor-details |
| 007 | job-change-orders (kept), vendor-documents |
| 008 | draw-workflow-redesign (kept), co-invoices |
| 009 | paid-to-vendor (kept), co-days |
| 025 | split-invoices (kept), simplify-allocation-links |
| 026 | sent-back-tracking (kept), credit-invoices |

### Notes

- Migrations now have unique sequential numbers
- No schema_migrations table updates needed (files hadn't been run yet)
- Future migrations continue from 075+
