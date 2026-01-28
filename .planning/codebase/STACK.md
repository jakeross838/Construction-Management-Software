# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.8 - All application code (`package.json`)

**Secondary:**
- JavaScript - Config files (`eslint.config.js`, `postcss.config.js`)
- SQL - Database migrations (`supabase/migrations/*.sql`)

## Runtime

**Environment:**
- Node.js (browser runtime via Vite)
- Deno - Supabase Edge Functions (`supabase/functions/*/index.ts`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React 18.3 - UI framework (`package.json`)
- React Router 6.30 - Client-side routing (`src/App.tsx`)
- TanStack Query 5.83 - Server state management (`src/App.tsx`)

**UI:**
- shadcn/ui - Component library (Radix primitives in `package.json`)
- Tailwind CSS 3.4 - Styling (`tailwind.config.ts`)
- Lucide React - Icons (`package.json`)

**Testing:**
- Vitest 3.2 - Unit tests (`vitest.config.ts`)
- Testing Library - React testing (`@testing-library/react` in `package.json`)
- jsdom - Browser environment for tests

**Build/Dev:**
- Vite 5.4 - Build tool and dev server (`vite.config.ts`)
- SWC - Fast TypeScript compilation (`@vitejs/plugin-react-swc`)
- PostCSS + Autoprefixer - CSS processing

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` 2.91 - Database and auth client (`src/integrations/supabase/client.ts`)
- `react-hook-form` 7.61 + `zod` 3.25 - Form handling and validation
- `recharts` 2.15 - Data visualization/charts

**Infrastructure:**
- `pdf-lib` - PDF manipulation in edge functions (`supabase/functions/stamp-invoice/index.ts`)
- `jspdf` + `jspdf-autotable` - PDF generation
- `xlsx` - Excel file handling
- `date-fns` - Date manipulation

**UI Utilities:**
- `@dnd-kit/core` + `@dnd-kit/sortable` - Drag and drop (`src/components/estimates/`)
- `embla-carousel-react` - Carousel component
- `sonner` - Toast notifications
- `vaul` - Drawer component
- `cmdk` - Command palette

## Configuration

**Environment:**
- Environment variables via Vite (`import.meta.env`)
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- Edge functions use: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Build:**
- `vite.config.ts` - Vite configuration with path aliases
- `tsconfig.json` - TypeScript config with `@/*` path alias
- `tailwind.config.ts` - Tailwind with custom theme colors
- `vitest.config.ts` - Test configuration

## Platform Requirements

**Development:**
- Any platform with Node.js
- Supabase CLI for local edge function development
- No Docker required

**Production:**
- Lovable/Vercel hosting for frontend
- Supabase for backend (PostgreSQL, Edge Functions, Storage)
- Deno Deploy for edge functions

---

*Stack analysis: 2026-01-27*
*Update after major dependency changes*
