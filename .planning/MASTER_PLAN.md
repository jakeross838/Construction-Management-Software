# Ross Built CMS - Master Plan

## Vision

A complete construction business operating system that manages the entire project lifecycle from lead to warranty closeout.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ROSS BUILT CMS - WORKFLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LEADS ──▶ PRE-CON ──▶ CONSTRUCTION ──▶ CLOSEOUT                  │
│     │          │              │              │                      │
│   • Pipeline   • Estimates    • Schedule     • Punch lists          │
│   • Qualify    • Proposals    • Daily logs   • Final docs           │
│   • Nurture    • Contracts    • Photos       • Warranties           │
│                • Selections   • Draws                               │
│                               • Changes                             │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                    FINANCIAL LAYER (Always Running)                 │
├─────────────────────────────────────────────────────────────────────┤
│   Invoices │ Budget │ Cash Flow │ P&L │ Profitability │ WIP        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Status

All features are documented in `docs/features/`. Each feature folder contains:
- `README.md` - Feature overview, API, database tables
- `PLAN.md` - Feature roadmap and planned improvements (when applicable)

### Core Features (Stable)

| Feature | Status | Docs |
|---------|--------|------|
| Dashboard | ✅ Stable | [docs/features/dashboard/](../docs/features/dashboard/) |
| Jobs | ✅ Stable | [docs/features/jobs/](../docs/features/jobs/) |
| Invoices | ✅ Stable | [docs/features/invoices/](../docs/features/invoices/) |
| Purchase Orders | ✅ Stable | [docs/features/purchase-orders/](../docs/features/purchase-orders/) |
| Draws | ✅ Stable | [docs/features/draws/](../docs/features/draws/) |
| Budget | ✅ Stable | [docs/features/budget/](../docs/features/budget/) |
| Estimates | ✅ Stable | [docs/features/estimates/](../docs/features/estimates/) |
| Schedule | ✅ Stable | [docs/features/schedule/](../docs/features/schedule/) |
| Daily Logs | ✅ Stable | [docs/features/daily-logs/](../docs/features/daily-logs/) |
| Photos | ✅ Stable | [docs/features/photos/](../docs/features/photos/) |

### All Features

See [CLAUDE.md](../CLAUDE.md#feature-documentation) for complete feature index.

---

## Current Focus

**See [CURRENT_SPRINT.md](CURRENT_SPRINT.md) for active work.**

---

## Roadmap

### Near-Term Priorities
1. **Contract Builder Enhancement** - Dynamic form builder, templates
2. **Client Portal** - External client access for selections/approvals
3. **Reporting Suite** - Comprehensive financial and project reports
4. **Mobile Optimization** - Field-friendly interface for daily logs, photos

### Future Considerations
- QuickBooks/Xero deep integration
- Advanced scheduling with resource leveling
- AI-powered cost estimation
- Subcontractor portal

---

## Planning System

### How Planning Works

1. **Master Plan** (this file) - Overall vision and roadmap
2. **Feature Plans** (`docs/features/<feature>/PLAN.md`) - Per-feature improvements
3. **Current Sprint** (`CURRENT_SPRINT.md`) - Active work items

### When Working on a Feature

1. Check `docs/features/<feature>/README.md` for current state
2. Check `docs/features/<feature>/PLAN.md` for planned work (if exists)
3. Update PLAN.md with changes/improvements made
4. Update this Master Plan if roadmap changes

---

## Historical Reference

Archived planning documents are in `.planning/archive/`:
- `archive/milestones/` - v1.x through v3.x milestone plans
- `archive/phases/` - Phase-based development history
- `archive/old-plans/` - Feature-specific historical plans

---

*Last updated: 2026-02-06*
