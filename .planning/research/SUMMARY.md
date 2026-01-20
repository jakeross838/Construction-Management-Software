# Research Summary: v3.0 Smart Catalog & Estimation Engine

**Synthesized:** 2026-01-20
**Sources:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md

---

## Executive Summary

Ross Built v3.0 transforms the CMS from a construction management tool into a **data-driven estimation and intelligence platform**. The research confirms:

1. **No off-the-shelf solution exists** - Construction estimation libraries for Node.js don't exist. Build custom using decimal.js for precise calculations.

2. **Selection-driven estimation is a genuine differentiator** - Most platforms estimate first, handle selections as change orders. Ross Built's vision of "selections ARE the estimate input" is unique.

3. **Existing stack is sufficient** - Node.js/Express + Supabase + vanilla JS + Claude API handles all v3.0 features with minimal additions (toposort, decimal.js, Frappe Gantt).

4. **Construction Knowledge Base is the secret weapon** - Warnings, quality checks, and tribal knowledge attached to selections differentiate from competitors and reduce costly mistakes.

5. **Feedback loops are underserved** - Industry shows 15-20% improvement in bid accuracy from historical data, but automatic updates from actuals are rare.

---

## Stack Recommendations

### Use (Already Have)
| Technology | Purpose |
|------------|---------|
| Node.js + Express | Backend API |
| Supabase (PostgreSQL) | Database with computed columns, aggregates |
| Vanilla JavaScript | Frontend (no framework switch needed) |
| Claude API | Document intelligence, already proven for invoices |
| Chart.js 4.x | Estimation visualizations (stacked bars, radar charts) |

### Add (Lightweight)
| Library | Version | Purpose |
|---------|---------|---------|
| **decimal.js** | ^10.4 | Precise money math for estimations |
| **toposort** | ^2.0 | Dependency resolution for scheduling |
| **date-fns** | ^3.0 | Date arithmetic for schedule calculations |
| **Frappe Gantt** | ^0.6 | Interactive Gantt charts (free, zero deps) |

### Avoid
| Technology | Why |
|------------|-----|
| RSMeans integration | Requires partnership, enterprise pricing - defer |
| Complex PDF libraries | Claude handles PDFs natively |
| ML frameworks | Overkill for v3.0, feedback loops work with simple rules |

---

## Feature Priorities

### Table Stakes (Must Have)
- Item/Assembly cost catalog with material + labor
- Markup/margin management (support both calculations)
- Allowance tracking with auto-change-orders
- Estimate versioning
- Trade/subcontractor database with insurance tracking
- Document upload and extraction
- Schedule generation with dependencies

### Differentiators (Competitive Advantage)
- **Selection-driven estimation** - Selections ARE the estimate input
- **Schedule auto-generation from selections** - Few do this well
- **Document intelligence to ALL systems** - Every upload enriches everything
- **Construction Knowledge Base** - Warnings, quality checks, tribal knowledge
- **Trade scorecards** - Quantified quality/speed/reliability
- **Feedback loops** - Actuals improve future predictions

### Anti-Features (Do NOT Build)
- Over-detailed line items by default (1,247 screws @ $0.02)
- Complex formula builder (pre-built methods instead)
- Standalone estimates without project link
- Enterprise-grade trade prequalification (overkill for custom builder)
- Manual-only price updates (build data collection from day one)

---

## Architecture Approach

### New Tables Needed
1. **v2_labor_catalog** - Labor hours, durations, rates per item
2. **v2_catalog_dependencies** - Before/after relationships
3. **v2_catalog_knowledge** - Warnings, quality checks, notes
4. **v2_trade_scorecards** - Quality, speed, reliability scores
5. **v2_trade_events** - Individual performance events (aggregate to scores)
6. **v2_document_queue** - AI extraction queue
7. **v2_extraction_results** - Parsed data before routing
8. **v2_price_actuals** - Feedback from invoices
9. **v2_schedule_actuals** - Feedback from completions
10. **v2_estimate_actuals** - Estimate vs actual tracking

### Key Data Flows
1. **Document → Everything**: Upload parses to catalog, pricing, schedule, permits, warranties
2. **Selection → Estimate**: Pick items → quantities → costs → totals
3. **Estimate → Schedule**: Durations + dependencies → timeline + critical path
4. **Actuals → Catalog**: Invoices, completions feed back to improve predictions
5. **Knowledge → Operations**: Warnings/checks feed punch lists, inspections

### Build Order (Dependency-Driven)
1. **Smart Catalog Foundation** - Everything depends on enhanced catalog
2. **Construction Knowledge Base** - Attach warnings/checks to catalog items
3. **Estimate Builder** - Uses catalog + knowledge for calculations
4. **Schedule Generator** - Uses catalog durations + dependencies
5. **Trade Scorecards** - Can build in parallel with 3-4
6. **Document Intelligence** - Benefits from all systems being in place
7. **Feedback Loops** - Requires operational data flowing through all systems

---

## Risk Mitigation

### Critical Pitfalls

| Pitfall | Risk | Prevention |
|---------|------|------------|
| **Calculation errors compound silently** | 2% error × 50 items = disaster | Show calculation breakdown, compare to historical |
| **AI extracts wrong data confidently** | 0.7-0.9% hallucination rate | Confidence scores, human-in-loop for low confidence |
| **Trade scoring gets gamed** | Salespeople optimize for scores, not quality | Multi-dimensional scoring with time decay |
| **Data entry friction causes workarounds** | Users estimate in Excel instead | 3-click entry, bulk import, express mode |
| **Outdated cost data** | Prices change faster than updates | Feedback loops, flag stale data |
| **Feedback loops amplify bad data** | GIGO at scale | Quality gates before training ingestion |

### Cross-Cutting Mitigations
- **Transparency**: Show how calculations work, not just results
- **Human-in-loop**: AI suggests, human approves (especially for knowledge base)
- **Audit trails**: Every change logged
- **Graceful degradation**: Manual fallback always available
- **Start with defaults**: Allow overrides, but don't require them

---

## Construction Knowledge Base

### What Each Selection Should Have
| Type | Examples | Use |
|------|----------|-----|
| **Warnings** | "Subfloor must be level within 3/16" per 10'" | Pre-installation verification |
| **Quality Checks** | "Verify acclimation 48 hours before install" | During/after installation |
| **Pre-Installation** | "Check moisture levels < 3%" | Inspection points |
| **Common Defects** | "Gapping at transitions if expansion not maintained" | Punch list suggestions |
| **Notes/Tips** | "This product requires transition strips at doorways" | Tribal knowledge |
| **Photo Examples** | Good vs bad installation images | Training reference |

### Integration Points
- **Punch Lists**: Auto-suggest items based on selections in that room
- **Daily Logs**: Prompt crew with "check before proceeding" items
- **Inspections**: Pre-populate checklists from selection requirements
- **Warranties**: Track if installation requirements were followed (defense)
- **Training**: New staff learns standards from the catalog

### Population Strategy
1. **Seed from manufacturer specs** - Install requirements, warranty conditions
2. **AI extract from spec sheets** - Parse PDFs for warnings/requirements
3. **Capture from punch lists** - Common defects become warnings for future
4. **Staff input** - Tribal knowledge captured in system
5. **Cross-selection sharing** - Similar products share knowledge (LVP shares with LVP)

---

## Recommended Phase Structure

| Phase | Name | Focus | Dependencies |
|-------|------|-------|--------------|
| **70** | Smart Catalog Foundation | Enhanced catalog with labor/duration/lead time data | None |
| **71** | Construction Knowledge Base | Warnings, quality checks, pre-reqs attached to items | Phase 70 |
| **72** | Selection-Driven Estimation | Pick selections → auto-calculate costs | Phase 70, 71 |
| **73** | Schedule Intelligence | Generate timeline from selections + dependencies | Phase 70, 72 |
| **74** | Trade Scorecards | Quality/speed/reliability metrics | Phase 70 |
| **75** | Document Intelligence | AI parsing to all systems | All previous |
| **76** | Feedback Loops | Actuals → catalog updates | All previous |

---

## Key Decisions Needed

1. **Initial catalog population**: Start empty or seed from common items?
2. **Trade scorecard weights**: Equal weighting or prioritize quality?
3. **Knowledge base approval**: Auto-accept AI suggestions or require review?
4. **Feedback auto-apply threshold**: How confident before auto-updating?
5. **Schedule complexity**: Single project or portfolio/resource leveling?

---

*Research synthesis complete. Ready for requirements definition and roadmap creation.*
