# Project Brief: Ross Built CMS

## Overview

Construction management software for Ross Built Custom Homes. Manages the full lifecycle from bidding through payment: Bids → Estimates → Budgets → POs → Invoices → Draws → Payment.

**Current Milestone:** v1.1 - Complete Field Features

## Core Value

**Streamline construction financial workflows** - from receiving vendor bids through final payment, with AI-powered invoice processing and AIA G702/G703 pay application generation.

## Current State

The system has functional core features:
- Invoice processing with AI extraction (Claude)
- Purchase Order management with change orders
- Draw/Pay Application management (G702/G703)
- Budget tracking per cost code
- Daily logs, schedules, documents, inspections
- Punch lists with PO retainage integration

**Remaining placeholder features:**
- Bids - Vendor bid collection and comparison
- Estimates - Cost estimation by cost code
- Photos - Project photo documentation

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Frontend | Vanilla JavaScript |
| AI | Claude API (Anthropic) |
| PDF | pdf-lib, pdf-parse |

**Key Patterns:**
- All tables use `v2_` prefix
- Soft deletes via `deleted_at`
- Modal class `.show` required for visibility
- API caching via `window.APICache`

## Constraints

1. **No frameworks** - Keep frontend vanilla JS
2. **Dark theme only** - Use CSS variables, no hardcoded colors
3. **Existing patterns** - Follow conventions in CLAUDE.md
4. **Supabase** - All data through Supabase client
5. **Migration numbering** - Continue from migration-038

## Key Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-17 | v1.1 focuses on Bids, Estimates, Photos | Complete placeholder features before new work |
| 2026-01-17 | Follow existing page patterns | Consistency with inspections.js, punch-lists.js |

## References

- `CLAUDE.md` - Full system documentation
- `.planning/codebase/` - Codebase mapping
- `database/migration-*.sql` - Schema history
