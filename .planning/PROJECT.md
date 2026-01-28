# Kind Creation - Construction Management System

## What This Is

A comprehensive construction management platform for Ross Built, combining a modern React frontend with sophisticated AI-powered document processing. The system handles the full construction workflow: leads, estimates, jobs, purchase orders, invoices, change orders, draws, and closeout - with intelligent automation for invoice extraction, vendor matching, and approval workflows.

## Core Value

**Intelligent invoice processing that learns and improves.** Manual data entry for invoices is the biggest time sink. AI extraction with OCR support, smart matching, and learning from corrections is the force multiplier that makes everything else work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable -->

- ✓ Job/project management with status tracking — existing
- ✓ Vendor directory with contact management — existing
- ✓ Purchase order creation and tracking — existing
- ✓ Invoice status workflow (needs_review → approved → in_draw → paid) — existing
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
- ✓ Claude API invoice extraction (replaces Lovable gateway) — v1.0
- ✓ OCR support for scanned PDFs via Claude Vision — v1.0
- ✓ AI learning system (corrections improve future extractions) — v1.0
- ✓ Vendor alias learning (vendor name variations) — v1.0
- ✓ Job reference learning (job reference patterns) — v1.0
- ✓ Multi-strategy cost code suggestions — v1.0
- ✓ Professional PDF stamp aesthetics — v1.0
- ✓ Bulk invoice processing with queue — v1.0

### Active

<!-- Current scope. Building toward these. -->

(None yet — define requirements for next milestone)

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
| Use Claude API for extraction | Lovable gateway has credit limits, Claude has OCR capability | ✓ Good |
| Keep Supabase Edge Functions | Already deployed architecture, Deno is capable | ✓ Good |
| Port AI logic to TypeScript | Original is JS, Edge Functions are TS | ✓ Good |
| Store learned mappings in database | Enables persistence across sessions | ✓ Good |
| Confidence < 0.5 = scanned document | Heuristic detection without separate OCR pipeline | ✓ Good |
| 90% initial confidence, +2% per confirmation | Gradual trust building for learned mappings | ✓ Good |
| Job+vendor history highest priority (0.80-0.95) | Most specific pattern wins for cost code suggestions | ✓ Good |
| Batch size 3, Promise.allSettled | Rate limit respect + fault tolerance for bulk upload | ✓ Good |

## Current State

**Shipped:** v1.0 AI Upgrade (2026-01-28)
**Codebase:** 59,541 lines TypeScript
**Tech stack:** React 18, Vite, Supabase, Claude API, pdf-lib

---
*Last updated: 2026-01-28 after v1.0 milestone*
