# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- PascalCase.tsx for React components (`InvoiceDetailDialog.tsx`, `POFormDialog.tsx`)
- kebab-case for directories (`purchase-orders/`, `daily-logs/`)
- index.ts for barrel exports (`src/components/invoices/index.ts`)

**Functions:**
- camelCase for all functions (`formatCurrency`, `handleSubmit`)
- handle* prefix for event handlers (`handleClick`, `handleStatusChange`)
- use* prefix for hooks (`useInvoices`, `useJob`)

**Variables:**
- camelCase for variables (`selectedJobId`, `filteredInvoices`)
- UPPER_SNAKE_CASE for constants (`TRADE_TYPES`, `SUPPORTED_MIME_TYPES`)

**Types:**
- PascalCase for interfaces and types (`ExtractedInvoiceData`, `MatchedVendor`)
- No I prefix for interfaces
- Descriptive names with domain context (`InvoiceDetails`, `CostCodeSuggestion`)

## Code Style

**Formatting:**
- 2 space indentation
- Single quotes for strings
- Semicolons at end of statements
- No Prettier config file (using ESLint defaults)

**Linting:**
- ESLint with TypeScript plugin (`eslint.config.js`)
- React Hooks plugin for hook rules
- React Refresh plugin for HMR

## Import Organization

**Order:**
1. React imports (`import { useState, useMemo } from 'react'`)
2. External packages (`@tanstack/react-query`, `lucide-react`)
3. Internal modules with alias (`@/components/`, `@/hooks/`)
4. Relative imports (`./utils`, `../types`)

**Path Aliases:**
- `@/` maps to `src/` (configured in `tsconfig.json` and `vite.config.ts`)
- Example: `import { Button } from '@/components/ui/button'`

**Grouping:**
- Blank line between import groups
- Component imports from same directory grouped

## Error Handling

**Patterns:**
- Edge functions: try/catch wrapping entire handler
- Return JSON error responses: `{ error: "message" }`
- UI: Toast notifications via sonner for user feedback

**Error Types:**
- HTTP 400 for validation errors
- HTTP 500 for server errors
- Edge functions log errors to console

## Logging

**Framework:**
- Console.log for edge function debugging
- No structured logging library

**Patterns:**
- Log key operations in edge functions
- Log errors with context before returning

## Comments

**When to Comment:**
- Explain complex algorithms (AI extraction logic)
- Document interface fields
- Mark TODO items for future work

**TODO Comments:**
- Format: `// TODO: description`
- Examples found: "TODO: Create dedicated template editor", "TODO: Replace with actual user"

## Function Design

**Size:**
- Hooks extract data fetching logic
- Components can be long (100-300+ lines for complex forms)

**Parameters:**
- Destructure props in function signature
- Use TypeScript interfaces for complex props

**Return Values:**
- Components return JSX
- Hooks return objects with data and actions

## Module Design

**Exports:**
- Named exports for components
- Barrel files for domain components (`src/components/invoices/index.ts`)

**Component Organization:**
- FormDialog: Modal for create/edit
- DetailDialog/Panel: View with actions
- Table: List with sorting/filtering
- Stats: Summary cards

## React Patterns

**State Management:**
- useState for local UI state
- TanStack Query for server state
- Context for global state (JobContext)

**Data Fetching:**
- Custom hooks wrapping useQuery
- Inline queries in pages acceptable
- Prefetch not currently used

**Form Handling:**
- react-hook-form with zod validation
- Controlled inputs via register
- onSubmit handlers call mutations

## Supabase Patterns

**Queries:**
- Direct client queries in pages
- Select with nested relations: `.select('*, vendors(*), jobs(*)')`
- Filters: `.eq()`, `.in()`, `.ilike()`

**Mutations:**
- useUpdateInvoice pattern for updates
- Optimistic updates not used
- Manual query invalidation

**Edge Functions:**
- Deno imports from esm.sh
- CORS headers on all responses
- Supabase client with service role key

---

*Convention analysis: 2026-01-27*
*Update when patterns change*
