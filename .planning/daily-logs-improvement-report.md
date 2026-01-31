# Daily Logs Improvement Report (Final)
**Date:** January 31, 2026
**Model:** 99% Subcontracted Labor
**Goal:** Uniform, accurate, AI-refined daily logs that drive analytics

---

## Core Philosophy

```
PM enters rough data → AI refines & standardizes → Clean, uniform logs → Powerful analytics
```

The PM's job is to capture **what happened**. AI's job is to make it **consistent and professional**.

---

## Part 1: Bugs Fixed

| Bug | Status |
|-----|--------|
| Date display off-by-one (timezone) | ✅ Fixed |
| Stats not refreshing after mutations | ✅ Fixed |
| Dialog too small | ✅ Fixed (now max-w-6xl, 95vh) |

---

## Part 2: AI Processing on Log Completion

### What AI Does When PM Clicks "Complete":

**1. Text Standardization**
```
PM enters:                          AI outputs:
─────────────────────────────────────────────────────────
"framing guys finished 2nd flr"  →  "Completed second floor framing"
"elec rough in master bed"       →  "Electrical rough-in: Master bedroom"
"waitng on plumbr - no show"     →  "Awaiting plumber (no-show today)"
"drywall dlvry - 50 shts"        →  "Drywall delivery received: 50 sheets"
```

**2. Spelling & Grammar Correction**
- Fix typos automatically
- Proper capitalization
- Complete sentences

**3. Terminology Standardization**
```
PM enters:                          AI outputs:
─────────────────────────────────────────────────────────
"sheetrock", "drywall", "gyp"    →  "Drywall" (pick one term)
"electric", "electrical", "elec" →  "Electrical"
"rough in", "rough-in", "R/I"    →  "Rough-in"
"2nd floor", "second flr", "2F"  →  "Second floor"
```

**4. Format Consistency**
- Bullet points for multiple items
- Consistent date formats
- Standardized measurements (LF, SF, etc.)

**5. Professional Tone**
```
PM enters:                          AI outputs:
─────────────────────────────────────────────────────────
"plumber was a no show again     →  "Plumber absent (no call/no show).
this is getting ridiculous"          Third occurrence this month.
                                     Impact: Inspection delayed."
```

### How It Works Technically:

```javascript
// On log completion, before saving:
async function processLogWithAI(log) {
  const prompt = `
    Standardize this daily log entry. Fix typos, use consistent
    terminology, professional tone. Keep facts accurate.

    Work Completed: ${log.work_completed}
    Tomorrow's Plan: ${log.work_planned}
    Delays/Issues: ${log.delays_issues}
    Safety Notes: ${log.safety_notes}

    Also standardize crew work descriptions:
    ${log.crew.map(c => c.notes).join('\n')}
  `;

  const refined = await claude.process(prompt);

  return {
    ...log,
    work_completed: refined.work_completed,
    work_planned: refined.work_planned,
    delays_issues: refined.delays_issues,
    // ... etc
    ai_processed: true,
    ai_processed_at: new Date()
  };
}
```

### PM Experience:

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPLETING DAILY LOG                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⏳ Processing with AI...                                    │
│                                                              │
│  ✓ Checking spelling and grammar                            │
│  ✓ Standardizing terminology                                │
│  ✓ Formatting for consistency                               │
│  ✓ Reviewing crew descriptions                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ PREVIEW CHANGES                                         │ │
│  │                                                         │ │
│  │ Work Completed:                                         │ │
│  │ - Before: "framing guys did 2nd flr, almost done"      │ │
│  │ + After:  "Second floor framing near completion (95%)" │ │
│  │                                                         │ │
│  │ Delays:                                                 │ │
│  │ - Before: "plumbr no show again"                       │ │
│  │ + After:  "Plumber absent (no call/no show). Second    │ │
│  │           occurrence. Delaying rough inspection."       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [Accept Changes]              [Edit Manually]    [Cancel]   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What AI Does NOT Change:
- Numbers (worker counts, percentages, quantities)
- Vendor names
- Dates
- Facts (just presentation)

---

## Part 3: Complete Feature List

### A. Data Entry Enhancements

| # | Feature | Purpose |
|---|---------|---------|
| 1 | **Larger dialog window** | More space to see all fields (DONE - now 6xl width) |
| 2 | **Pre-populate from schedule** | Auto-show today's scheduled subs |
| 3 | **"Same as yesterday" button** | Quick duplicate for similar days |
| 4 | **Voice-to-text input** | Faster entry on mobile/tablet |
| 5 | **Photo auto-categorization** | AI detects if photo is progress/delivery/safety |

### B. Crew Tracking (Subcontractor-Focused)

| # | Feature | Purpose |
|---|---------|---------|
| 6 | **Worker count vs expected** | Track if sub brought full crew |
| 7 | **Progress % linked to PO** | Track burn rate on each PO |
| 8 | **Work quality rating** | Good / Acceptable / Needs rework |
| 9 | **"Ready for next trade" checkbox** | Unlocks dependent schedule tasks |
| 10 | **Scope item description** | What specific work was done |

### C. Absent Crew Tracking

| # | Feature | Purpose |
|---|---------|---------|
| 11 | **Called ahead vs No-show** | Reliability scoring |
| 12 | **Expected worker count** | Calculate lost productivity |
| 13 | **Schedule impact level** | None / Minor / Major / Critical |
| 14 | **Reschedule date** | When will they return |
| 15 | **Absence pattern alerts** | Flag subs with repeated no-shows |

### D. Schedule Integration

| # | Feature | Purpose |
|---|---------|---------|
| 16 | **Auto-update task progress** | Log complete → schedule updates |
| 17 | **Unscheduled work detection** | Prompt to add to schedule |
| 18 | **Dependency unlocking** | "Ready for next trade" enables successors |
| 19 | **Variance alerts** | Flag when progress < planned |
| 20 | **Schedule conflict warnings** | Multiple subs need same area |

### E. AI Processing

| # | Feature | Purpose |
|---|---------|---------|
| 21 | **Typo correction** | Professional logs every time |
| 22 | **Terminology standardization** | Same words across all logs |
| 23 | **Format consistency** | Uniform bullet points, dates, etc. |
| 24 | **Professional tone** | Appropriate for client/bank review |
| 25 | **Preview before save** | PM can review AI changes |

### F. Vendor Performance Scorecards

| # | Feature | Purpose |
|---|---------|---------|
| 26 | **Reliability score** | % of days showed when scheduled |
| 27 | **Capacity score** | % of expected workers brought |
| 28 | **Quality score** | Inspection pass rate |
| 29 | **Schedule impact score** | Days blocking other trades |
| 30 | **Overall weighted score** | Single number for comparison |
| 31 | **Historical trend charts** | Performance over time |
| 32 | **Cross-job comparison** | Same sub on different jobs |

### G. Reports & Analytics

| # | Feature | Purpose |
|---|---------|---------|
| 33 | **Auto weekly PM report** | Generated from log data |
| 34 | **PO burn rate dashboard** | Progress vs billing |
| 35 | **Workers on site trend** | Chart over time |
| 36 | **Weather impact analysis** | Days lost, cost impact |
| 37 | **Sub attendance heatmap** | Visual reliability by sub |
| 38 | **Export to PDF/Excel** | Share with bank, client |

### H. Mobile/UX Improvements

| # | Feature | Purpose |
|---|---------|---------|
| 39 | **Responsive mobile layout** | PM can log from job site |
| 40 | **Offline mode with sync** | Works without cell service |
| 41 | **Camera integration** | Take photos directly in app |
| 42 | **Quick entry mode** | Minimal taps for basic log |
| 43 | **Required field enforcement** | Ensure consistent data capture |

---

## Part 4: Database Schema Changes

### New Tables

```sql
-- 1. Daily sub performance (auto-populated on log complete)
CREATE TABLE v2_daily_sub_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID REFERENCES v2_daily_logs,
  vendor_id UUID REFERENCES v2_vendors,
  job_id UUID REFERENCES v2_jobs,
  log_date DATE,

  -- Attendance
  was_scheduled BOOLEAN,
  showed_up BOOLEAN,
  called_ahead BOOLEAN,

  -- Capacity
  expected_workers INTEGER,
  actual_workers INTEGER,

  -- Progress
  po_id UUID REFERENCES v2_purchase_orders,
  percent_complete_start INTEGER,
  percent_complete_end INTEGER,
  progress_today INTEGER,

  -- Quality
  work_quality TEXT,
  ready_for_next_trade BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vendor scorecards (calculated weekly)
CREATE TABLE v2_vendor_scorecard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES v2_vendors,
  job_id UUID REFERENCES v2_jobs,
  period_start DATE,
  period_end DATE,

  -- Scores (0-100)
  reliability_score DECIMAL(5,2),
  capacity_score DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  schedule_score DECIMAL(5,2),
  overall_score DECIMAL(5,2),

  -- Raw data
  days_scheduled INTEGER,
  days_showed INTEGER,
  days_no_show INTEGER,
  inspections_passed INTEGER,
  inspections_failed INTEGER,

  calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI processing log
CREATE TABLE v2_daily_log_ai_processing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID REFERENCES v2_daily_logs,

  -- Original text
  original_work_completed TEXT,
  original_work_planned TEXT,
  original_delays_issues TEXT,

  -- AI refined text
  refined_work_completed TEXT,
  refined_work_planned TEXT,
  refined_delays_issues TEXT,

  -- Metadata
  changes_made JSONB,
  accepted_by_user BOOLEAN,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Columns to Add

```sql
-- v2_daily_log_crew
ALTER TABLE v2_daily_log_crew
  ADD COLUMN expected_workers INTEGER,
  ADD COLUMN work_quality TEXT CHECK (work_quality IN ('good', 'acceptable', 'needs_rework')),
  ADD COLUMN ready_for_next_trade BOOLEAN DEFAULT false,
  ADD COLUMN scope_item TEXT;

-- v2_daily_logs
ALTER TABLE v2_daily_logs
  ADD COLUMN ai_processed BOOLEAN DEFAULT false,
  ADD COLUMN ai_processed_at TIMESTAMPTZ;
```

### Enhanced Absent Crews Structure

```typescript
// Update TypeScript interface (no schema change needed - it's JSONB)
interface AbsentCrew {
  vendor_id: string;
  reason: 'called_ahead' | 'no_call_no_show' | 'weather' | 'material_delay' | 'waiting_on_other_trade' | 'scheduling_conflict' | 'other';
  expected_workers: number;        // NEW
  schedule_impact: 'none' | 'minor' | 'major' | 'critical';  // NEW
  reschedule_date?: string;        // NEW
  notes: string;
}
```

---

## Part 5: Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [x] Fix date bug
- [x] Fix stats refresh bug
- [x] Larger dialog window
- [ ] Add `work_quality` field to crew
- [ ] Add `ready_for_next_trade` field
- [ ] Add `expected_workers` field
- [ ] Enhance absent crew structure
- [ ] Add schedule task dropdown to crew form

### Phase 2: AI Processing (Week 3-4)
- [ ] Create AI processing endpoint
- [ ] Implement text standardization prompt
- [ ] Build preview UI for AI changes
- [ ] Store original + refined text
- [ ] Handle accept/reject flow

### Phase 3: Schedule Sync (Week 5-6)
- [ ] Pre-populate log from schedule
- [ ] Auto-update tasks on completion
- [ ] Detect unscheduled work
- [ ] Create variance alerts
- [ ] Unlock dependent tasks

### Phase 4: Vendor Scorecards (Week 7-8)
- [ ] Create daily performance table
- [ ] Build scorecard calculation job
- [ ] Design scorecard UI
- [ ] Add to vendor detail page
- [ ] Historical trend charts

### Phase 5: Reports (Week 9-10)
- [ ] Auto-generate weekly report
- [ ] PO burn rate dashboard
- [ ] Export functionality
- [ ] Weather impact analysis

### Phase 6: Mobile & Polish (Week 11-12)
- [ ] Mobile responsive layout
- [ ] Quick entry mode
- [ ] Voice-to-text integration
- [ ] Offline mode
- [ ] Required field validation

---

## Part 6: Success Metrics

After 3 months of use, measure:

| Metric | Target |
|--------|--------|
| Log completion rate | >95% of work days |
| AI acceptance rate | >90% of refinements accepted |
| Schedule accuracy | <10% variance from planned |
| Sub reliability visibility | Scorecards for all active subs |
| PM time saved | 30min/day on log entry |
| Report generation | Auto weekly reports for all jobs |

---

## Part 7: Sample Workflow

### PM's Daily Routine (5-10 minutes):

**4:00 PM - Open Daily Log**
```
┌─────────────────────────────────────────────────────────────────┐
│ DAILY LOG - Drummond-501 74th St - Friday, Jan 31, 2026        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 🌧️ Weather: Rainy, 61°F (auto-fetched)                          │
│                                                                  │
│ TODAY'S SCHEDULED CREWS:                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✅ ABC Framing         4 workers    [✓ Showed]              │ │
│ │    PO-001 | Rough framing | Was 87% → Now [95]%             │ │
│ │    Work: [finished 2nd flr framing________________]         │ │
│ │    Quality: ● Good ○ OK ○ Rework   ☑ Ready for drywall     │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ✅ XYZ Electric        2 workers    [✓ Showed]              │ │
│ │    PO-002 | Rough electrical | Was 55% → Now [62]%          │ │
│ │    Work: [wiring master bed and bath______________]         │ │
│ │    Quality: ● Good ○ OK ○ Rework   ☐ Ready for insulation  │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ ❌ 123 Plumbing        Expected 2   [✗ No Show]             │ │
│ │    Reason: [No call/no show ▼]  Impact: [Critical ▼]       │ │
│ │    Reschedule: [02/03/2026]                                 │ │
│ │    Notes: [left vm with owner, 2nd no show this wk__]       │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ WORK SUMMARY:                                                   │
│ Completed: [framing done, elec continuing rough in___]          │
│ Tomorrow:  [drywall delivery, start hanging if ready_]          │
│ Issues:    [plumber no show delaying inspection______]          │
│                                                                  │
│ 📷 Photos: [3 attached]     🗑️ ☐ Dumpster exchanged            │
│                                                                  │
│        [Cancel]              [Save Draft]     [Complete ✓]      │
└─────────────────────────────────────────────────────────────────┘
```

**4:05 PM - Click Complete → AI Processing**
```
┌─────────────────────────────────────────────────────────────────┐
│                      AI REFINEMENT PREVIEW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ WORK COMPLETED:                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Before: "framing done, elec continuing rough in"            │ │
│ │                                                              │ │
│ │ After:  "• Second floor framing completed (95%)             │ │
│ │          • Electrical rough-in continuing: Master bedroom   │ │
│ │            and bathroom (62%)"                               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ DELAYS/ISSUES:                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Before: "plumber no show delaying inspection"               │ │
│ │                                                              │ │
│ │ After:  "Plumber (123 Plumbing) absent - no call/no show.  │ │
│ │          Second occurrence this week. Impact: Rough         │ │
│ │          plumbing inspection delayed. Rescheduled for       │ │
│ │          02/03/2026."                                        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ CREW NOTES:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ABC Framing:                                                 │ │
│ │ Before: "finished 2nd flr framing"                          │ │
│ │ After:  "Completed second floor framing"                    │ │
│ │                                                              │ │
│ │ XYZ Electric:                                                │ │
│ │ Before: "wiring master bed and bath"                        │ │
│ │ After:  "Rough wiring: Master bedroom and master bathroom"  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│           [Edit Manually]                    [Accept & Save ✓]  │
└─────────────────────────────────────────────────────────────────┘
```

**4:06 PM - Done!**
- Log saved with professional formatting
- Schedule auto-updated (framing 95%, electrical 62%)
- Drywall task unlocked (framing ready)
- Plumber flagged for reliability issues
- Weekly report data collected

---

## Summary

| Category | Features |
|----------|----------|
| **Data Entry** | Larger dialog, pre-populate from schedule, voice input, quick duplicate |
| **Crew Tracking** | Worker counts, quality ratings, ready-for-next-trade, PO burn rate |
| **Absent Tracking** | Called ahead vs no-show, impact level, reschedule date, patterns |
| **AI Processing** | Typo fix, terminology standardize, format consistency, preview changes |
| **Schedule Sync** | Auto-update progress, detect unscheduled, unlock dependencies, variance alerts |
| **Scorecards** | Reliability, capacity, quality, schedule impact, overall score |
| **Reports** | Auto weekly report, PO burn rate, weather impact, export |
| **Mobile** | Responsive, offline, camera, quick entry |

**Total: 43 features across 6 implementation phases**

---

*Final Report - January 31, 2026*
