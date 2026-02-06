# Developer Handoff Guide

Welcome to the Ross Built Construction Management Software project. This guide will help you get oriented quickly.

## Quick Start (5 minutes)

### 1. Prerequisites
- Node.js 18+
- Access to Supabase project (ask team lead)
- Anthropic API key (for AI features)

### 2. Setup
```bash
# Clone and install
git clone https://github.com/jakeross838/Construction-Management-Software.git
cd Construction-Management-Software
npm run install:all

# Configure environment
cp .env.example .env
# Edit .env with credentials

# Build and run
npm run build
npm start
# App at http://localhost:3001
```

### 3. Verify It Works
1. Open http://localhost:3001
2. You should see the dashboard
3. Check browser console for errors

---

## Project Structure at a Glance

```
├── CLAUDE.md              # AI context & critical rules (READ THIS)
├── client/src/            # React frontend
│   ├── pages/             # Route pages
│   └── components/        # Feature components
├── server/                # Express backend
│   └── routes/            # API endpoints
├── database/              # SQL migrations
└── docs/features/         # Feature documentation
```

---

## Key Documentation

| What | Where | When to Read |
|------|-------|--------------|
| **Critical Rules** | `CLAUDE.md` | Before making changes |
| **Feature Docs** | `docs/features/` | When working on a feature |
| **Planning** | `.planning/` | For roadmap and history |
| **Archives** | `docs/archive/` | Historical context |

---

## Core Features

The app has 6 core features - each with its own documentation:

| Feature | What It Does | Docs |
|---------|--------------|------|
| **Invoices** | AI-powered invoice processing & approval | `docs/features/invoices/` |
| **Purchase Orders** | PO management & tracking | `docs/features/purchase-orders/` |
| **Draws** | AIA G702/G703 pay applications | `docs/features/draws/` |
| **Jobs** | Construction project management | `docs/features/jobs/` |
| **Budget** | Cost tracking per job/cost code | `docs/features/budget/` |
| **Estimates** | Project estimation & bidding | `docs/features/estimates/` |

---

## Database Quick Reference

Tables use `v2_` prefix. Core tables:
- `v2_jobs` - Projects
- `v2_invoices` - Invoice records
- `v2_purchase_orders` - PO records
- `v2_draws` - Payment applications
- `v2_budget_lines` - Budget by cost code
- `v2_vendors` - Vendor directory
- `v2_cost_codes` - CSI cost codes

Run migrations: `npm run migrate`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend | Node.js + Express |
| Database | Supabase (PostgreSQL) |
| AI | Claude API (invoice extraction) |
| Storage | Supabase Storage (PDFs) |

---

## Common Tasks

### Add a new API endpoint
1. Create/edit file in `server/routes/`
2. Mount route in `server/index.js`
3. Test with curl or browser

### Add a new page
1. Create page in `client/src/pages/`
2. Add route in `client/src/App.tsx`
3. Add navigation in sidebar

### Run database migration
```bash
npm run migrate        # Run pending
npm run migrate:status # Check status
```

---

## Development Tips

1. **Read the feature docs** before changing a feature
2. **Check CLAUDE.md** for critical patterns (modal show/hide, etc.)
3. **Test the full flow**: UI → API → Database → Response → UI
4. **Use existing patterns** - look at similar features first

---

## Getting Help

- **Codebase questions**: Check `docs/features/` for the relevant feature
- **Historical context**: Check `docs/archive/` and `.planning/phases/completed/`
- **Project roadmap**: See `.planning/MASTER_PLAN.md`

---

## What's Next?

1. Read `CLAUDE.md` - especially the Critical Rules section
2. Start the app and click around
3. Pick a feature and read its docs in `docs/features/`
4. Make a small change to get familiar with the workflow

Good luck! 🏗️
