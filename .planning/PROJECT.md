# Kind Creation - Construction Management System

## What This Is

A comprehensive construction management platform for Ross Built, combining a modern React frontend with sophisticated AI-powered document processing. The system handles the full construction workflow: leads, estimates, jobs, purchase orders, invoices, change orders, draws, and closeout - with intelligent automation for invoice extraction, vendor matching, and approval workflows.

## Core Value

**Intelligent invoice processing that learns and improves.** Manual data entry for invoices is the biggest time sink. AI extraction with OCR support, smart matching, and learning from corrections is the force multiplier that makes everything else work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — existing in codebase -->

- ✓ Job/project management with status tracking — existing
- ✓ Vendor directory with contact management — existing
- ✓ Purchase order creation and tracking — existing
- ✓ Invoice upload and basic AI extraction (Lovable gateway) — existing
- ✓ Invoice status workflow (needs_review → approved → in_draw → paid) — existing
- ✓ PDF stamping with approval metadata — existing
- ✓ Vendor/job/PO matching algorithms (fuzzy, Soundex) — existing
- ✓ Cost code management and allocation — existing
- ✓ Draw request management — existing
- ✓ Change order tracking — existing
- ✓ Budget tracking per job — existing
- ✓ Estimate builder with sections and line items — existing
- ✓ Lead/CRM management with kanban board — existing
- ✓ Daily logs and schedule tracking — existing
- ✓ PO email sending via Resend — existing
- ✓ Dashboard with financial metrics — existing

### Active

<!-- Current scope. Building toward these. -->

- [x] Replace Lovable AI gateway with Claude/Anthropic API for invoice extraction
- [ ] Add OCR support for scanned PDFs using Claude Vision
- [ ] Implement AI learning system (corrections improve future extractions)
- [ ] Improve PDF stamp aesthetics (professional appearance)
- [ ] Add vendor alias learning (remember vendor name variations)
- [ ] Add job reference learning (remember job reference patterns)
- [ ] Multi-strategy cost code suggestions from line items and trade types
- [ ] Bulk invoice processing (queue multiple invoices)

### Out of Scope

- Multi-tenant/team features — single company (Ross Built) for now
- Mobile app — web-first, responsive design sufficient
- QuickBooks/accounting integration — future milestone
- Payment processing — out of scope for construction workflow
- Permit tracking automation — manual entry sufficient

## Context

**Origin:** Two existing systems being combined:
1. **Original Node.js project** - Sophisticated AI processing with Claude API, OCR via Claude Vision, multi-strategy matching, AI learning from corrections
2. **Lovable React project** - Modern shadcn/ui frontend with Supabase backend, but limited AI (credit-limited Lovable gateway)

**Goal:** Keep the Lovable frontend architecture but port over the advanced AI capabilities from the original project into Supabase Edge Functions.

**Technical environment:**
- React 18 + TypeScript frontend with Vite
- Supabase for database, auth, storage, and edge functions
- Edge functions run Deno (TypeScript with Deno imports)
- Current AI uses Lovable gateway (Gemini) - needs migration to Claude

**Key files to upgrade:**
- `supabase/functions/extract-invoice/index.ts` - Main extraction logic (~900 lines)
- `supabase/functions/stamp-invoice/index.ts` - PDF stamping (~500 lines)

**Reference implementation:**
- `C:\Users\jaker\Construction-Management-Software\server\ai-processor.js` - Claude-based extraction
- `C:\Users\jaker\Construction-Management-Software\server\ocr-processor.js` - Claude Vision OCR

## Constraints

- **API**: Must use Claude/Anthropic API (user has API key, avoids Lovable credit limits)
- **Runtime**: Edge functions must remain Deno-compatible (Supabase requirement)
- **Architecture**: Keep existing Supabase + React architecture (no server layer)
- **Styling**: Maintain shadcn/ui component patterns and Tailwind conventions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Claude API for extraction | Lovable gateway has credit limits, Claude has OCR capability | Implemented |
| Keep Supabase Edge Functions | Already deployed architecture, Deno is capable | — Pending |
| Port AI logic to TypeScript | Original is JS, Edge Functions are TS | — Pending |
| Store learned mappings in database | Enables persistence across sessions | — Pending |

---
*Last updated: 2026-01-27 after initialization*
