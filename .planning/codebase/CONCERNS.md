# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

**Hardcoded User References:**
- Issue: User identification hardcoded as strings throughout codebase
- Files:
  - `src/components/daily-logs/DailyLogFormDialog.tsx` - `created_by: 'Current User'`
  - `src/components/invoices/InvoiceDetailDialog.tsx` - `approvedBy: 'Jake Ross'`
  - `src/components/selections/SelectionTable.tsx` - `approved_by: 'Current User'`
- Why: No auth system fully implemented
- Impact: No audit trail, no multi-user support
- Fix approach: Implement Supabase Auth user context, use auth.user.id

**AI Gateway Credit Limitations:**
- Issue: Using Lovable AI gateway with limited credits for invoice extraction
- File: `supabase/functions/extract-invoice/index.ts`
- Why: Quick integration during Lovable development
- Impact: Service will stop working when credits exhausted
- Fix approach: Replace with direct Claude/Anthropic API integration

**No OCR for Scanned PDFs:**
- Issue: Scanned PDFs cannot be processed (only digital PDFs work)
- File: `supabase/functions/extract-invoice/index.ts`
- Why: Lovable AI gateway doesn't support image processing
- Impact: Users must manually enter data for scanned invoices
- Fix approach: Add Claude Vision API for OCR preprocessing

## Known Issues

**TODO Items in Code:**
- `src/pages/Estimates.tsx:163` - "TODO: Create dedicated template editor"
- `src/pages/Leads.tsx:168` - "TODO: Navigate to estimate creation with lead data pre-filled"
- `src/pages/LienReleases.tsx:236` - "TODO: Download" (download functionality missing)
- `src/components/leads/LeadKanbanBoard.tsx:129` - "TODO: Create Estimate" (functionality missing)

## Security Considerations

**Open RLS Policies:**
- Risk: All tables have permissive RLS policies ("viewable by everyone", "insertable by anyone")
- Files: `supabase/migrations/20260123211458_*.sql`
- Current mitigation: Single-tenant assumption (one company)
- Recommendations: Add proper user-based RLS when multi-user support added

**Service Role Key in Edge Functions:**
- Risk: Edge functions use service role key (bypasses RLS)
- Files: All `supabase/functions/*/index.ts`
- Current mitigation: Edge functions validate inputs
- Recommendations: Add input validation, rate limiting

## Performance Considerations

**Large Component Files:**
- Files with 500+ lines:
  - `supabase/functions/extract-invoice/index.ts` (~900 lines)
  - `supabase/functions/stamp-invoice/index.ts` (~500 lines)
- Impact: Harder to maintain and test
- Improvement: Extract matching algorithms, validation, and utility functions

**No Data Pagination:**
- Issue: Lists fetch all records without pagination
- Files: `src/pages/Invoices.tsx`, `src/pages/PurchaseOrders.tsx`, etc.
- Impact: Performance degrades with large datasets
- Fix: Add pagination to TanStack Query hooks

## Fragile Areas

**Invoice Extraction Matching Logic:**
- File: `supabase/functions/extract-invoice/index.ts`
- Why fragile: Complex multi-strategy matching (fuzzy, Soundex, learned mappings)
- Common failures: False positives on vendor/job matching
- Safe modification: Add comprehensive unit tests before changes
- Test coverage: No tests currently

**PDF Stamping Layout:**
- File: `supabase/functions/stamp-invoice/index.ts`
- Why fragile: Pixel-precise positioning for stamp elements
- Common failures: Stamp overlaps content, wrong positioning on different page sizes
- Safe modification: Test with various PDF formats and sizes

## Missing Critical Features

**AI Learning System:**
- Problem: No learning from user corrections
- Current workaround: Users manually correct each invoice
- Blocks: Efficiency improvements over time
- Implementation: Track corrections, build learned_mappings table

**Bulk Invoice Processing:**
- Problem: Invoices processed one at a time
- Current workaround: Upload one, wait, upload next
- Blocks: Efficient batch processing
- Implementation: Queue system with parallel processing

**Multi-User Support:**
- Problem: No user-specific data or permissions
- Current workaround: Single user assumption
- Blocks: Team collaboration, audit trails
- Implementation: Supabase Auth integration, user-based RLS

## Test Coverage Gaps

**No Tests Exist:**
- What's not tested: Entire codebase
- Risk: Regressions go unnoticed, refactoring is risky
- Priority: High
- Difficulty: Need to set up mocking for Supabase

**Edge Function Testing:**
- What's not tested: Invoice extraction, PDF stamping, email sending
- Risk: Business-critical logic untested
- Priority: High
- Difficulty: Need Deno test setup, mock Supabase client

**Component Testing:**
- What's not tested: React components, forms, dialogs
- Risk: UI regressions
- Priority: Medium
- Difficulty: Standard Testing Library setup

## Dependencies

**pdf-lib for Stamping:**
- Current version: 1.17.1 (via esm.sh)
- Status: Actively maintained
- Risk: Low

**Lovable AI Gateway:**
- Risk: Credit-limited, external dependency
- Impact: Invoice extraction stops working
- Migration: Replace with Claude API

---

*Concerns audit: 2026-01-27*
*Update as issues are fixed or new ones discovered*
