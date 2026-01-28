# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Intelligent invoice processing that learns and improves
**Current focus:** Phase 6 — Bulk Processing (Complete)

## Current Position

Phase: 6 of 6 (Bulk Processing)
Plan: 1 of 1 in current phase
Status: Milestone complete
Last activity: 2026-01-28 — Completed 06-01-PLAN.md

Progress: ██████████ 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 4.8 min
- Total execution time: 0.48 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 | 1 | — | — |
| 2 | 1 | 4 min | 4 min |
| 3 | 1 | 8 min | 8 min |
| 4 | 1 | 5 min | 5 min |
| 5 | 1 | 6 min | 6 min |
| 6 | 1 | 2 min | 2 min |

**Recent Trend:**
- Last 5 plans: 03-01 (8 min), 04-01 (5 min), 05-01 (6 min), 06-01 (2 min)
- Trend: Improving

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Use Claude API for extraction (replaces Lovable gateway)
- Keep Supabase Edge Functions architecture
- Port AI logic from JS to TypeScript
- Use confidence averaging (<0.5) to detect scanned documents
- Track extraction method (pdf_vision vs image_vision) for analytics
- First correction starts at 90% confidence
- Each confirmation adds +2% confidence (max 99%)
- Reset confidence to 90% when different match selected
- Job+vendor historical patterns get highest priority (0.80-0.95 confidence)
- Vendor-only historical patterns get 0.65-0.90 confidence
- Cost code suggestions deduplicated, sorted by confidence, limited to top 5
- Stamp width 220px, line height 1.5, header 24px for professional appearance
- Shadow offset 2px at 50% opacity for subtle depth effect
- Separator lines between content sections for visual organization
- Batch size of 3 files for parallel processing to avoid rate limits
- Promise.allSettled for fault-tolerant bulk operations

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-01-28
Stopped at: Completed 06-01-PLAN.md (Milestone complete)
Resume file: None
