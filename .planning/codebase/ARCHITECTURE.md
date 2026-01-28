# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Single Page Application with Serverless Backend

**Key Characteristics:**
- React SPA with client-side routing
- Supabase as Backend-as-a-Service (database, auth, storage)
- Edge Functions for server-side processing (AI extraction, PDF stamping)
- No traditional server layer - direct database access from client

## Layers

**Page Layer:**
- Purpose: Route-specific UI and data orchestration
- Contains: Full page components, data fetching via TanStack Query
- Location: `src/pages/*.tsx`
- Depends on: Components, hooks, contexts
- Used by: React Router (`src/App.tsx`)

**Component Layer:**
- Purpose: Reusable UI components
- Contains: Domain components (invoices, jobs, vendors) and UI primitives
- Location: `src/components/**/*.tsx`
- Depends on: UI components, hooks
- Used by: Pages

**Hook Layer:**
- Purpose: Data fetching and state management
- Contains: TanStack Query hooks for Supabase operations
- Location: `src/hooks/*.ts` (implied, actual queries in pages)
- Depends on: Supabase client
- Used by: Pages and components

**Context Layer:**
- Purpose: Global state (selected job, etc.)
- Contains: JobContext for cross-component job selection
- Location: `src/contexts/*.tsx`
- Used by: All pages for job filtering

**Integration Layer:**
- Purpose: External service clients
- Contains: Supabase client configuration
- Location: `src/integrations/supabase/`
- Used by: Hooks, pages

**Edge Function Layer:**
- Purpose: Server-side processing requiring secrets
- Contains: AI extraction, PDF stamping, email sending
- Location: `supabase/functions/*/index.ts`
- Runtime: Deno
- Depends on: Supabase, external AI APIs

## Data Flow

**Invoice Upload Flow:**

1. User uploads PDF via `InvoiceUploadDialog.tsx`
2. File uploaded to Supabase Storage
3. Edge function `extract-invoice` triggered
4. AI extracts data (vendor, amounts, line items)
5. Matching algorithms find vendor/job/PO
6. Invoice record created in database
7. UI updates via TanStack Query invalidation
8. User reviews and approves/corrects

**Invoice Approval Flow:**

1. User clicks approve in `InvoiceDetailDialog.tsx`
2. Status updated in database
3. Edge function `stamp-invoice` triggered
4. PDF stamped with approval metadata
5. Stamped PDF saved to storage
6. Invoice linked to draw when added

**State Management:**
- Server state: TanStack Query with Supabase queries
- UI state: React useState in components
- Global state: JobContext for selected job filtering
- No Redux or global state library

## Key Abstractions

**Financial Data Hooks:**
- Purpose: Centralized data fetching for financial entities
- Location: `src/hooks/useFinancialData.ts` (referenced in pages)
- Exports: `useInvoices`, `useVendors`, `useJobs`, `usePurchaseOrders`, `useCostCodes`, `useUpdateInvoice`
- Pattern: TanStack Query hooks with Supabase

**Form Dialogs:**
- Purpose: Modal forms for creating/editing entities
- Examples: `JobFormDialog.tsx`, `InvoiceUploadDialog.tsx`, `POFormDialog.tsx`
- Pattern: Dialog with react-hook-form + zod validation

**Detail Panels:**
- Purpose: Read-only detail views with actions
- Examples: `PODetailPanel.tsx`, `DrawDetailPanel.tsx`, `CODetailPanel.tsx`
- Pattern: Slide-over panel with entity data and action buttons

**Tables:**
- Purpose: Sortable, filterable entity lists
- Examples: `POTable.tsx`, `EstimateTable.tsx`, `SelectionTable.tsx`
- Pattern: shadcn Table with selection, sorting, filtering

## Entry Points

**Application Entry:**
- Location: `src/App.tsx`
- Triggers: Browser loads application
- Responsibilities: Provider setup (Query, Job context, Router), route definitions

**Edge Function Entry:**
- Location: `supabase/functions/*/index.ts`
- Triggers: HTTP POST from frontend
- Responsibilities: Process request, interact with Supabase, return response

## Error Handling

**Strategy:** Try/catch at edge function level, toast notifications in UI

**Patterns:**
- Edge functions: try/catch wrapping entire handler, JSON error responses
- UI: sonner toasts for user-facing errors
- TanStack Query: `onError` callbacks for query failures
- Forms: zod validation with inline error messages

## Cross-Cutting Concerns

**Authentication:**
- Supabase Auth with session persistence
- No explicit auth UI yet (app-wide access)
- Row Level Security (RLS) policies on all tables

**Job Filtering:**
- JobContext provides `selectedJobId`
- Pages filter data based on selected job
- Persisted across navigation

**Styling:**
- Tailwind CSS with custom theme (`tailwind.config.ts`)
- CSS variables for colors (dark mode ready)
- shadcn/ui components with consistent styling

---

*Architecture analysis: 2026-01-27*
*Update when major patterns change*
