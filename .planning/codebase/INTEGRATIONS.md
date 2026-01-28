# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**AI/LLM Processing:**
- Lovable AI Gateway - Invoice data extraction
  - Endpoint: `https://api.lovable.dev/v1/ai/chat` (via edge function)
  - Model: gemini-2.0-flash
  - Auth: Lovable project key
  - Used in: `supabase/functions/extract-invoice/index.ts`
  - Note: Has credit limitations, candidate for upgrade to Claude API

**Email:**
- Resend - Purchase order email sending
  - SDK/Client: REST API via fetch
  - Auth: API key in `RESEND_API_KEY` env var
  - Used in: `supabase/functions/send-po-email/index.ts`

## Data Storage

**Database:**
- PostgreSQL on Supabase - Primary data store
  - Connection: via `SUPABASE_URL` env var
  - Client: `@supabase/supabase-js` v2.91
  - Migrations: `supabase/migrations/*.sql`
  - Tables: invoices, vendors, jobs, purchase_orders, cost_codes, draws, change_orders, etc.

**File Storage:**
- Supabase Storage - Document storage
  - Buckets: invoice PDFs, stamped PDFs
  - Auth: Service role key in edge functions
  - Client access: anon key with RLS policies

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (configured but minimal UI)
  - Implementation: `@supabase/supabase-js` client
  - Token storage: localStorage (`src/integrations/supabase/client.ts`)
  - Session management: Auto refresh enabled

**Row Level Security:**
- All tables have RLS enabled
- Current policies: "viewable by everyone", "can be inserted by anyone"
- No user-specific restrictions yet (single-tenant)

## Monitoring & Observability

**Error Tracking:**
- None configured
- Console.log in edge functions

**Analytics:**
- None configured

**Logs:**
- Supabase function logs (via Supabase dashboard)
- Browser console for frontend

## CI/CD & Deployment

**Hosting:**
- Lovable - React app hosting
  - Deployment: Automatic via Lovable platform
  - Environment vars: Configured in Lovable dashboard

**Edge Functions:**
- Supabase Edge Functions - Deno runtime
  - Deployment: via Supabase CLI or dashboard
  - Region: Closest to database

**CI Pipeline:**
- Not configured
- No GitHub Actions workflows

## Environment Configuration

**Development:**
- Required env vars:
  - `VITE_SUPABASE_URL` - Supabase project URL
  - `VITE_SUPABASE_PUBLISHABLE_KEY` - Anon key for client
- Edge function secrets:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (auto-injected)
  - `RESEND_API_KEY` for email

**Production:**
- Same structure as development
- Secrets managed in Supabase dashboard

## Webhooks & Callbacks

**Incoming:**
- None currently configured

**Outgoing:**
- None currently configured

## Database Schema Overview

**Core Financial Tables:**
- `invoices` - Invoice records with status workflow
- `vendors` - Vendor/subcontractor directory
- `jobs` - Project/job tracking
- `purchase_orders` - PO management with line items
- `po_line_items` - PO breakdown by cost code
- `cost_codes` - Cost code master list
- `draws` - Draw request management
- `draw_invoices` - Junction table for draw-invoice relationships
- `change_orders` - Change order tracking
- `invoice_allocations` - Invoice cost code allocations

**Supporting Tables:**
- `leads` - CRM lead tracking
- `employees` - Employee directory
- `daily_logs` - Daily job logging
- `permits` - Permit tracking
- `selections` - Client selection tracking
- `lien_releases` - Lien release tracking
- `estimates` - Project estimates
- `bid_packages` - Bid management

## Integration Points for Enhancement

**Current Limitations:**
1. AI extraction uses Lovable gateway (credit-limited)
2. No OCR for scanned PDFs
3. No AI learning from corrections
4. No webhook integrations

**Planned Integrations:**
1. Claude/Anthropic API for AI extraction
2. Claude Vision for OCR processing
3. Potential Stripe for payment processing
4. Potential QuickBooks/accounting integration

---

*Integration audit: 2026-01-27*
*Update when adding/removing external services*
