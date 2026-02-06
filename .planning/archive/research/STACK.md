# Stack Research

---

# Section A: Financial Management (v2.x Enhancement)

**Project:** Ross Built CMS - Job Costing, Overhead Allocation, Financial Reporting
**Researched:** 2026-01-20
**Overall Confidence:** HIGH

---

## Executive Summary

Adding financial management features (job costing, overhead allocation, P&L reporting) to the existing Node.js/Express + Supabase + vanilla JS stack requires minimal new dependencies. The strategy:

1. **Decimal.js** for all financial calculations (avoids floating-point errors)
2. **Dinero.js** for currency formatting and display
3. **Chart.js** (lightweight, MIT) for financial dashboards
4. **date-fns** for period-based calculations (monthly, quarterly, fiscal)
5. **pdfmake** for PDF financial reports
6. **ExcelJS** (already installed) for Excel exports

---

## Core Technologies

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| **Decimal.js** | ^10.4 | Precision arithmetic for all financial calculations | Industry standard for JavaScript financial math. Used by Prisma ORM. Arbitrary-precision, handles currency without floating-point errors. 18M+ weekly downloads. |
| **Dinero.js** | ^2.0 | Money/currency representation and formatting | Built specifically for monetary values following Martin Fowler's money pattern. Handles currency formatting, immutable, chainable API. |
| **date-fns** | ^3.6 | Period-based date calculations (monthly, quarterly, fiscal) | Modular/tree-shakeable (2KB vs Moment's 60KB). Immutable. Functional API. Perfect for fiscal period calculations. |
| **Chart.js** | ^4.4 | Financial dashboards and job profitability charts | Lightweight, MIT licensed, easy setup. Great for bar/line/pie charts needed for P&L and cost breakdowns. |
| **ExcelJS** | ^4.4 | Excel report generation | Already used in project for G702/G703 exports. Supports formulas, formatting, conditional styling. |
| **pdfmake** | ^0.2 | PDF financial reports (P&L, job cost reports) | Declarative JSON-based API perfect for structured financial statements. Tables, headers, footers built-in. |

---

## Supporting Libraries

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| **lodash** | ^4.17 | Utility functions (groupBy, sumBy for aggregations) | Helpful for grouping costs by category/period |
| **node-cron** | ^3.0 | Scheduled calculations (monthly overhead allocation) | Simple cron syntax for period-end batch jobs |

---

## Time Tracking Integration Options

| Service | API Type | Best For | Notes |
|---------|----------|----------|-------|
| **Clockify** | REST API | Free tier, simple integration | 50 req/sec rate limit. npm: `clockify-ts` |
| **QuickBooks Time** | OAuth2 REST | QuickBooks ecosystem users | Formerly TSheets. Full timesheets/jobcodes/GPS |
| **Harvest** | OAuth2 REST | Project-based billing | 70+ integrations. Good reporting API |
| **Manual Entry** | Custom | Small teams, no external tool | Build simple time entry in existing app |

**Recommendation**: Start with manual time entry in the app. Add Clockify integration later if needed (best free tier, straightforward REST API).

---

## Installation Commands

```bash
# Core financial libraries
npm install decimal.js dinero.js@2 date-fns

# Charting (frontend)
npm install chart.js

# PDF reports (alternative to existing pdf-lib)
npm install pdfmake

# Scheduling (for period-end calculations)
npm install node-cron

# Utility (if not already installed)
npm install lodash
```

**Note**: ExcelJS is already installed in the project.

---

## Overhead Allocation Formulas

Based on construction accounting best practices:

### Labor Burden Rate
```javascript
// Labor burden = additional costs beyond gross wages
// Typically 30-50% of base wage

const Decimal = require('decimal.js');

function calculateBurdenedLabor(hours, hourlyRate, burdenRate = 0.40) {
  const baseLaborCost = new Decimal(hours).times(hourlyRate);
  const laborBurden = baseLaborCost.times(burdenRate);
  const fullyBurdenedLabor = baseLaborCost.plus(laborBurden);

  return {
    baseCost: baseLaborCost.toDecimalPlaces(2).toNumber(),
    burden: laborBurden.toDecimalPlaces(2).toNumber(),
    totalCost: fullyBurdenedLabor.toDecimalPlaces(2).toNumber()
  };
}

// Components of typical 40% burden rate:
// - Payroll taxes (FICA, FUTA, SUTA): ~15-20%
// - Workers' comp: ~8-12%
// - Benefits: ~5-10%
// - Equipment/overhead allocation: ~2-5%
```

### Overhead Allocation by Labor Hours
```javascript
// Overhead Rate = Total Overhead / Total Direct Labor Hours
function allocateOverheadByHours(totalOverhead, jobs) {
  const Decimal = require('decimal.js');

  const totalHours = jobs.reduce((sum, job) => sum + job.laborHours, 0);
  const overheadRate = new Decimal(totalOverhead).dividedBy(totalHours);

  return jobs.map(job => ({
    jobId: job.id,
    laborHours: job.laborHours,
    allocatedOverhead: overheadRate.times(job.laborHours).toDecimalPlaces(2).toNumber()
  }));
}
```

### Overhead Allocation by Direct Costs (Percentage Method)
```javascript
// Overhead Rate = Total Overhead / Total Direct Costs
function allocateOverheadByDirectCosts(totalOverhead, jobs) {
  const Decimal = require('decimal.js');

  const totalDirectCosts = jobs.reduce((sum, job) =>
    sum + job.laborCost + job.materialCost + job.equipmentCost, 0);

  // Example: $200K overhead / $1M direct costs = 20%
  const overheadRate = new Decimal(totalOverhead).dividedBy(totalDirectCosts);

  return jobs.map(job => {
    const jobDirectCosts = job.laborCost + job.materialCost + job.equipmentCost;
    return {
      jobId: job.id,
      directCosts: jobDirectCosts,
      overheadRate: overheadRate.times(100).toDecimalPlaces(2).toNumber(), // as percentage
      allocatedOverhead: overheadRate.times(jobDirectCosts).toDecimalPlaces(2).toNumber()
    };
  });
}
```

---

## Database Schema Additions

```sql
-- Employees (for labor tracking)
CREATE TABLE v2_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT, -- 'carpenter', 'electrician', 'laborer', etc.
    hourly_rate DECIMAL(10,2),
    burden_rate DECIMAL(5,4) DEFAULT 0.4000, -- 40% default
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Labor/time entries
CREATE TABLE v2_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES v2_jobs(id),
    employee_id UUID REFERENCES v2_employees(id),
    cost_code_id UUID REFERENCES v2_cost_codes(id),
    date DATE NOT NULL,
    hours DECIMAL(5,2) NOT NULL,
    hourly_rate DECIMAL(10,2), -- snapshot at time of entry
    burden_rate DECIMAL(5,4), -- snapshot at time of entry
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overhead expense categories
CREATE TABLE v2_overhead_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- 'Rent', 'Utilities', 'Insurance', 'Admin Salary'
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Overhead expenses
CREATE TABLE v2_overhead_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES v2_overhead_categories(id),
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    expense_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Overhead allocations (calculated monthly)
CREATE TABLE v2_overhead_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES v2_jobs(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    allocation_method TEXT NOT NULL, -- 'labor_hours', 'direct_costs'
    allocated_amount DECIMAL(12,2) NOT NULL,
    calculation_details JSONB, -- stores breakdown for audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, period_start, period_end)
);

-- Job profitability snapshots (for trend reporting)
CREATE TABLE v2_job_profitability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES v2_jobs(id),
    as_of_date DATE NOT NULL,
    contract_amount DECIMAL(12,2),
    revenue_to_date DECIMAL(12,2),
    material_costs DECIMAL(12,2),
    labor_costs DECIMAL(12,2),
    labor_burden DECIMAL(12,2),
    equipment_costs DECIMAL(12,2),
    subcontractor_costs DECIMAL(12,2),
    overhead_allocated DECIMAL(12,2),
    total_costs DECIMAL(12,2),
    gross_profit DECIMAL(12,2),
    gross_margin DECIMAL(5,4), -- as decimal, e.g., 0.2500 = 25%
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(job_id, as_of_date)
);

-- Company P&L periods
CREATE TABLE v2_pl_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type TEXT NOT NULL, -- 'monthly', 'quarterly', 'annual'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_revenue DECIMAL(12,2),
    total_direct_costs DECIMAL(12,2),
    total_overhead DECIMAL(12,2),
    gross_profit DECIMAL(12,2),
    net_profit DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(period_type, period_start)
);
```

---

## Alternatives Considered

### Precision Math Libraries

| Library | Why NOT Recommended |
|---------|---------------------|
| **Big.js** | Good but lacks currency features. Decimal.js more widely used (18M vs 13M weekly downloads). |
| **bignumber.js** | Precision in decimal places vs significant digits - less intuitive for money. |
| **currency.js** | Smaller community, less active maintenance than Dinero.js. |
| **financial-number** | Native BigInt based but much smaller ecosystem (6K weekly downloads). |

### Charting Libraries

| Library | Why NOT Recommended |
|---------|---------------------|
| **Highcharts** | Paid license starting at $535/year. Overkill for this use case. |
| **ApexCharts** | Good but known for slower rendering. Chart.js is lighter and sufficient. |
| **D3.js** | Steep learning curve. Too low-level for simple dashboards. |
| **ECharts** | Great but larger bundle size. Better for complex visualizations. |
| **FusionCharts** | Commercial license ($439+/year). Not needed. |

### PDF Libraries

| Library | Why NOT Recommended |
|---------|---------------------|
| **PDFKit** | Imperative API less suited for structured reports like P&L statements. |
| **Puppeteer** | Headless Chrome is heavy/resource-intensive for server PDF generation. |
| **jsreport** | Full reporting server - overkill for this scope. |
| **Carbone** | Template-based but commercial license needed for production. |

### Date Libraries

| Library | Why NOT Recommended |
|---------|---------------------|
| **Moment.js** | Officially deprecated/maintenance mode since 2020. 30x larger than alternatives (60KB vs 2KB). |
| **Day.js** | Good alternative, but date-fns better for tree-shaking and functional programming style. |
| **Luxon** | Good but larger than date-fns. Overkill unless heavy timezone work needed. |

---

## What NOT to Use

| Technology | Why NOT |
|------------|---------|
| **Moment.js** | Deprecated. Use date-fns instead. |
| **Native JavaScript Number for money** | Floating-point errors (0.1 + 0.2 = 0.30000000000004). Always use Decimal.js. |
| **Highcharts/FusionCharts** | Commercial licenses unnecessary for this scope. |
| **Puppeteer for PDF** | Too heavy (headless Chrome). Use pdfmake or existing pdf-lib. |
| **Full accounting integrations** (QuickBooks API, Sage) | Adds complexity. Build custom first, integrate later if needed. |
| **React/Vue charting wrappers** | Project uses vanilla JS. Use Chart.js directly. |
| **Complex ERP systems** (Procore, Viewpoint) | SaaS platforms, not embeddable libraries. |

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ross Built CMS                            │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Vanilla JS)                                       │
│  ├── Chart.js (P&L dashboards, job profitability charts)    │
│  ├── Dinero.js (currency display/formatting)                │
│  └── date-fns (period selection UI, fiscal calendars)       │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js + Express)                                 │
│  ├── Decimal.js (all financial calculations)                │
│  ├── date-fns (period logic, fiscal month boundaries)       │
│  ├── ExcelJS (Excel exports) [existing]                     │
│  ├── pdfmake (PDF financial reports)                        │
│  └── node-cron (scheduled overhead allocation jobs)         │
├─────────────────────────────────────────────────────────────┤
│  Database (Supabase/PostgreSQL)                              │
│  └── DECIMAL(12,2) for all money columns [existing pattern] │
└─────────────────────────────────────────────────────────────┘
```

---

## Sources

### Precision Math
- [Decimal.js GitHub](https://github.com/MikeMcl/decimal.js)
- [Dinero.js - LogRocket Guide](https://blog.logrocket.com/store-retrieve-precise-monetary-values-javascript-dinero-js/)
- [Financial Precision in JavaScript - DEV Community](https://dev.to/benjamin_renoux/financial-precision-in-javascript-handle-money-without-losing-a-cent-1chc)
- [npm trends: Decimal.js vs Big.js vs Dinero.js](https://npmtrends.com/big.js-vs-currency.js-vs-decimal.js-vs-dinero.js-vs-moneysafe)

### Charting
- [JavaScript Charting Libraries Comparison - Embeddable](https://embeddable.com/blog/javascript-charting-libraries)
- [Chart.js vs ApexCharts - StackShare](https://stackshare.io/stackups/apexcharts-vs-js-chart)
- [Comparing JavaScript Charting Libraries - LogRocket](https://blog.logrocket.com/comparing-most-popular-javascript-charting-libraries/)

### PDF Generation
- [PDFKit vs pdfmake vs Puppeteer - LogRocket](https://blog.logrocket.com/best-html-pdf-libraries-node-js/)
- [PDF Generation Libraries Comparison - npm-compare](https://npm-compare.com/html-pdf,pdfkit,pdfmake,puppeteer)
- [Top PDF Libraries 2025 - Nutrient](https://www.nutrient.io/blog/top-js-pdf-libraries/)

### Date Handling
- [date-fns vs Day.js - DhiWise](https://www.dhiwise.com/post/date-fns-vs-dayjs-the-battle-of-javascript-date-libraries)
- [You Don't Need Moment.js - GitHub](https://github.com/you-dont-need/You-Dont-Need-Momentjs)
- [Moment.js Alternatives - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/momentjs-alternatives/)

### Construction Accounting
- [Overhead Allocation for Contractors - CrewCost](https://crewcost.com/blog/what-are-the-methods-of-overhead-allocation/)
- [Labor Burden in Construction - SmartBarrel](https://smartbarrel.io/blog/labor-burden-in-construction/)
- [How to Calculate Overhead Costs - QuickBooks](https://quickbooks.intuit.com/r/expenses/how-to-calculate-and-track-overhead-costs/)
- [How to Allocate Overhead Costs - Construction Cost Accounting](https://www.constructioncostaccounting.com/post/allocate-overhead-costs)

### Time Tracking APIs
- [Clockify API Documentation](https://docs.clockify.me/)
- [Building Clockify Integration - Rollout](https://rollout.com/integration-guides/clockify/sdk/step-by-step-guide-to-building-a-clockify-api-integration-in-js)
- [QuickBooks Time API Reference](https://tsheetsteam.github.io/api_docs/)
- [Harvest Integrations](https://www.getharvest.com/integrations)

---
---
---

# Section B: v3.0 Smart Catalog & Estimation Engine

**Project:** Ross Built CMS v3.0
**Researched:** 2026-01-20
**Overall Confidence:** HIGH (uses existing stack + verified libraries)

---

## Executive Summary

The v3.0 features (estimation, scheduling, document intelligence, trade scorecards) integrate cleanly with your existing Node.js/Express + Supabase + vanilla JS stack. **No major technology changes required.** The strategy is to leverage:

1. **Custom calculation logic** for estimation (no viable off-the-shelf construction estimation libraries exist for Node.js)
2. **Existing Claude API** enhanced with structured prompts for document intelligence
3. **toposort** npm package for dependency resolution and critical path calculations
4. **Chart.js 4.x** (already familiar) extended for all visualizations
5. **PostgreSQL native features** in Supabase for scoring and aggregation

---

## Estimation Calculations

### Recommendation: Custom Calculation Engine

**Why not use existing libraries:** There are no open-source Node.js/JavaScript libraries specifically for construction estimation. Commercial solutions (PlanSwift, Autodesk Estimate, Buildertrend) are SaaS platforms, not embeddable libraries.

**Approach:** Build a custom calculation engine using your existing catalog data.

### Core Data Model

```javascript
// Catalog Item with estimation data
{
  id: 'uuid',
  name: 'string',
  category: 'string',

  // Material costs
  material_unit_cost: 'decimal',
  material_unit: 'string', // 'each', 'sqft', 'lf', 'cy'
  waste_factor: 'decimal', // 1.10 = 10% waste

  // Labor costs
  labor_hours_per_unit: 'decimal',
  labor_rate: 'decimal', // $/hour
  crew_size: 'integer',

  // Equipment
  equipment_cost_per_unit: 'decimal',

  // Markup
  overhead_percent: 'decimal',
  profit_percent: 'decimal'
}
```

### Calculation Functions

```javascript
// Core estimation calculation (implement in Node.js)
function calculateLineItem(catalogItem, quantity) {
  const materialCost = quantity * catalogItem.waste_factor * catalogItem.material_unit_cost;
  const laborHours = quantity * catalogItem.labor_hours_per_unit;
  const laborCost = laborHours * catalogItem.labor_rate;
  const equipmentCost = quantity * catalogItem.equipment_cost_per_unit;

  const directCost = materialCost + laborCost + equipmentCost;
  const overhead = directCost * catalogItem.overhead_percent;
  const profit = (directCost + overhead) * catalogItem.profit_percent;

  return {
    quantity,
    materialCost,
    laborHours,
    laborCost,
    equipmentCost,
    directCost,
    overhead,
    profit,
    totalCost: directCost + overhead + profit
  };
}
```

### Supporting Libraries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **decimal.js** | ^10.4 | Precise decimal arithmetic for money | HIGH |
| **lodash** | ^4.17 | Utility functions for aggregation | HIGH |

**Installation:**
```bash
npm install decimal.js lodash
```

### Cost Database Considerations

**RSMeans/Gordian:** Industry-standard construction cost database with 92,000+ unit cost line items. Available via RSMeans Data Online subscription. **No public API** - requires Gordian partnership for integration. Consider for future enterprise features, but **not required for MVP**.

**Recommendation:** Build your own catalog with user-entered costs. Allow bulk import from CSV. This is how most small-to-mid contractors work anyway.

**Sources:**
- [RSMeans Data from Gordian](https://www.gordian.com/products/rsmeans-data-services/)
- [Construction Cost Insights Q1 2025](https://www.gordian.com/resources/construction-cost-insights-report-q1-2025/)

---

## Scheduling Engine

### Recommendation: toposort + Custom Critical Path

**Why toposort:** Battle-tested npm package (4.8M weekly downloads) for topological sorting of directed acyclic graphs. Perfect for task dependency resolution.

### Core Libraries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **toposort** | ^2.0.2 | Dependency graph resolution | HIGH |
| **date-fns** | ^3.x | Date arithmetic for scheduling | HIGH |

**Installation:**
```bash
npm install toposort date-fns
```

### Implementation Pattern

```javascript
const toposort = require('toposort');
const { addBusinessDays, differenceInBusinessDays } = require('date-fns');

// Task structure
const tasks = [
  { id: 'foundation', name: 'Foundation', duration: 5, dependencies: [] },
  { id: 'framing', name: 'Framing', duration: 10, dependencies: ['foundation'] },
  { id: 'electrical', name: 'Electrical Rough', duration: 5, dependencies: ['framing'] },
  { id: 'plumbing', name: 'Plumbing Rough', duration: 5, dependencies: ['framing'] },
  { id: 'drywall', name: 'Drywall', duration: 7, dependencies: ['electrical', 'plumbing'] }
];

// Build dependency graph for toposort
function buildGraph(tasks) {
  const edges = [];
  tasks.forEach(task => {
    task.dependencies.forEach(dep => {
      edges.push([dep, task.id]);
    });
  });
  return edges;
}

// Get execution order
const edges = buildGraph(tasks);
const order = toposort(edges); // Returns ['foundation', 'framing', 'electrical', 'plumbing', 'drywall']
```

### Critical Path Calculation

```javascript
// Forward pass: calculate earliest start/finish
function forwardPass(tasks, order, startDate) {
  const schedule = {};

  order.forEach(taskId => {
    const task = tasks.find(t => t.id === taskId);
    const deps = task.dependencies;

    let earliestStart = startDate;
    if (deps.length > 0) {
      earliestStart = deps.reduce((latest, depId) => {
        const depFinish = schedule[depId].earlyFinish;
        return depFinish > latest ? depFinish : latest;
      }, startDate);
    }

    schedule[taskId] = {
      earlyStart: earliestStart,
      earlyFinish: addBusinessDays(earliestStart, task.duration)
    };
  });

  return schedule;
}

// Backward pass: calculate latest start/finish and float
function backwardPass(tasks, schedule, order, projectEnd) {
  const reversed = [...order].reverse();

  reversed.forEach(taskId => {
    const task = tasks.find(t => t.id === taskId);
    const successors = tasks.filter(t => t.dependencies.includes(taskId));

    let latestFinish = projectEnd;
    if (successors.length > 0) {
      latestFinish = successors.reduce((earliest, succ) => {
        const succStart = schedule[succ.id].lateStart;
        return succStart < earliest ? succStart : earliest;
      }, projectEnd);
    }

    schedule[taskId].lateFinish = latestFinish;
    schedule[taskId].lateStart = addBusinessDays(latestFinish, -task.duration);
    schedule[taskId].float = differenceInBusinessDays(
      schedule[taskId].lateStart,
      schedule[taskId].earlyStart
    );
    schedule[taskId].critical = schedule[taskId].float === 0;
  });

  return schedule;
}
```

### Why Not Dedicated Gantt Libraries

**DHTMLX Gantt, Bryntum Gantt:** Commercial licenses ($500-$2000+), overkill for generating schedules server-side.

**Frappe Gantt:** Good for visualization but doesn't provide scheduling algorithms - it's display-only.

**Recommendation:** Use toposort for the scheduling math, Frappe Gantt or Chart.js for display.

**Sources:**
- [toposort npm](https://www.npmjs.com/package/toposort)
- [toposort GitHub](https://github.com/marcelklehr/toposort)
- [Critical Path Method Guide](https://www.wrike.com/blog/critical-path-is-easy-as-123/)

---

## Document Intelligence

### Recommendation: Enhance Existing Claude API Integration

**Why:** You already have Claude API integrated. Claude's native PDF support eliminates the need for separate PDF parsing libraries. Use structured prompts with JSON schema enforcement for reliable extraction.

### PDF Processing Approach

**Option 1: Direct Claude PDF Support (Recommended)**

Claude natively processes PDFs up to 100 pages, 32MB. Each page uses 1,500-3,000 tokens for text + image tokens.

```javascript
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

async function extractProposalData(pdfPath) {
  const client = new Anthropic();
  const pdfData = fs.readFileSync(pdfPath).toString('base64');

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfData
          }
        },
        {
          type: 'text',
          text: `Extract all products, quantities, unit prices, and total prices from this vendor proposal.

Return as JSON with this structure:
{
  "vendor": { "name": "", "address": "", "phone": "", "email": "" },
  "proposal_date": "",
  "valid_until": "",
  "project_reference": "",
  "line_items": [
    {
      "description": "",
      "product_code": "",
      "quantity": 0,
      "unit": "",
      "unit_price": 0,
      "total_price": 0,
      "specs": {}
    }
  ],
  "subtotal": 0,
  "tax": 0,
  "total": 0,
  "terms": "",
  "notes": ""
}`
        }
      ]
    }]
  });

  return JSON.parse(message.content[0].text);
}
```

**Option 2: Pre-extract text with pdf-parse (For large batches)**

If processing many PDFs and want to reduce Claude token usage:

```bash
npm install pdf-parse
```

```javascript
const pdfParse = require('pdf-parse');

async function extractTextFromPdf(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}
```

### Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **@anthropic-ai/sdk** | ^0.30+ | Claude API | Always - core AI |
| **pdf-parse** | ^2.4 | Text extraction | Optional - for pre-processing |

### Extraction Schemas

Create typed schemas for different document types:

```javascript
// Proposal extraction schema
const PROPOSAL_SCHEMA = {
  vendor: { name: 'string', contact: 'string' },
  items: [{
    description: 'string',
    quantity: 'number',
    unit: 'string',
    unit_price: 'number',
    total: 'number'
  }],
  totals: { subtotal: 'number', tax: 'number', total: 'number' }
};

// Quote extraction schema
const QUOTE_SCHEMA = {
  contractor: { name: 'string', license: 'string' },
  scope: 'string',
  price: 'number',
  valid_days: 'number',
  inclusions: ['string'],
  exclusions: ['string']
};
```

**Sources:**
- [Claude PDF Support Documentation](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support)
- [pdf-parse npm](https://www.npmjs.com/package/pdf-parse)
- [7 PDF Parsing Libraries for Node.js](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025)

---

## Trade Scoring System

### Recommendation: PostgreSQL-Native Weighted Scoring

**Why:** Supabase PostgreSQL can handle weighted scoring calculations efficiently. Keep scoring logic in the database for consistency and performance.

### Scoring Model

```sql
-- Trade/Vendor scoring dimensions
CREATE TABLE vendor_scores (
  vendor_id UUID REFERENCES vendors(id),
  project_id UUID REFERENCES projects(id),

  -- Scoring dimensions (1-5 scale)
  quality_score DECIMAL(2,1),
  timeliness_score DECIMAL(2,1),
  communication_score DECIMAL(2,1),
  price_competitiveness DECIMAL(2,1),
  safety_score DECIMAL(2,1),

  -- Weights (must sum to 1.0)
  quality_weight DECIMAL(3,2) DEFAULT 0.25,
  timeliness_weight DECIMAL(3,2) DEFAULT 0.25,
  communication_weight DECIMAL(3,2) DEFAULT 0.15,
  price_weight DECIMAL(3,2) DEFAULT 0.20,
  safety_weight DECIMAL(3,2) DEFAULT 0.15,

  -- Calculated
  weighted_score DECIMAL(3,2) GENERATED ALWAYS AS (
    quality_score * quality_weight +
    timeliness_score * timeliness_weight +
    communication_score * communication_weight +
    price_competitiveness * price_weight +
    safety_score * safety_weight
  ) STORED,

  scored_at TIMESTAMP DEFAULT NOW()
);

-- Aggregate vendor score view
CREATE VIEW vendor_scorecard AS
SELECT
  v.id,
  v.name,
  v.trade,
  COUNT(vs.project_id) as projects_completed,
  AVG(vs.weighted_score) as overall_score,
  AVG(vs.quality_score) as avg_quality,
  AVG(vs.timeliness_score) as avg_timeliness,
  AVG(vs.communication_score) as avg_communication,
  AVG(vs.price_competitiveness) as avg_price,
  AVG(vs.safety_score) as avg_safety
FROM vendors v
LEFT JOIN vendor_scores vs ON v.id = vs.vendor_id
GROUP BY v.id, v.name, v.trade;
```

### Scoring Algorithm (Application Layer)

```javascript
// Configurable weights per organization
const DEFAULT_WEIGHTS = {
  quality: 0.25,
  timeliness: 0.25,
  communication: 0.15,
  price: 0.20,
  safety: 0.15
};

function calculateWeightedScore(scores, weights = DEFAULT_WEIGHTS) {
  return Object.keys(weights).reduce((total, dimension) => {
    return total + (scores[dimension] * weights[dimension]);
  }, 0);
}

// Trend detection
function detectTrend(scoreHistory) {
  if (scoreHistory.length < 3) return 'insufficient_data';

  const recent = scoreHistory.slice(-3);
  const slope = (recent[2] - recent[0]) / 2;

  if (slope > 0.2) return 'improving';
  if (slope < -0.2) return 'declining';
  return 'stable';
}
```

### Best Practices Applied

Based on industry research:
- Use 1-5 scale (simpler than 1-10, reduces decision fatigue)
- Weight customization per organization (different priorities)
- Minimum sample size before displaying score (3+ projects)
- Recency weighting optional (more recent scores count more)

**Sources:**
- [Vendor Rating Complete Guide 2025](https://www.kodiakhub.com/blog/vendor-rating-guide)
- [RFP Weighted Scoring Guide](https://www.responsive.io/blog/rfp-weighted-scoring-demystified)
- [Vendor Scorecard Guide 2025](https://www.spendflo.com/blog/vendor-scorecard-guide)

---

## Visualization

### Recommendation: Chart.js 4.x + Frappe Gantt

**Why Chart.js:** You already use it. Version 4.x is current and actively maintained. Handles bar charts, stacked bars, and can be adapted for timelines.

**Why Frappe Gantt:** Zero dependencies, open source, specifically designed for Gantt charts with task dependencies. Better UX than forcing Chart.js into Gantt mode.

### Libraries

| Library | Version | Purpose | Confidence |
|---------|---------|---------|------------|
| **chart.js** | ^4.4 | Bar, line, pie charts for estimates/scorecards | HIGH |
| **frappe-gantt** | ^1.0.4 | Interactive Gantt charts for schedules | HIGH |
| **chartjs-plugin-datalabels** | ^2.2 | Labels on chart elements | HIGH |

**Installation:**
```bash
npm install chart.js frappe-gantt chartjs-plugin-datalabels
```

### Estimate Visualization (Chart.js)

```javascript
// Stacked bar chart for estimate breakdown
const estimateChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['Foundation', 'Framing', 'Electrical', 'Plumbing', 'Finishes'],
    datasets: [
      { label: 'Materials', data: [5000, 12000, 3000, 4000, 8000], backgroundColor: '#3b82f6' },
      { label: 'Labor', data: [8000, 15000, 6000, 7000, 10000], backgroundColor: '#10b981' },
      { label: 'Equipment', data: [2000, 1000, 500, 500, 500], backgroundColor: '#f59e0b' }
    ]
  },
  options: {
    responsive: true,
    scales: {
      x: { stacked: true },
      y: { stacked: true, ticks: { callback: v => '$' + v.toLocaleString() } }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: $${ctx.raw.toLocaleString()}`
        }
      }
    }
  }
});
```

### Schedule Visualization (Frappe Gantt)

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.css">
<script src="https://cdn.jsdelivr.net/npm/frappe-gantt/dist/frappe-gantt.umd.js"></script>

<div id="gantt"></div>

<script>
const tasks = [
  { id: 'foundation', name: 'Foundation', start: '2025-03-01', end: '2025-03-08', progress: 100 },
  { id: 'framing', name: 'Framing', start: '2025-03-09', end: '2025-03-22', progress: 50, dependencies: 'foundation' },
  { id: 'electrical', name: 'Electrical', start: '2025-03-23', end: '2025-03-30', progress: 0, dependencies: 'framing' },
  { id: 'plumbing', name: 'Plumbing', start: '2025-03-23', end: '2025-03-30', progress: 0, dependencies: 'framing' },
  { id: 'drywall', name: 'Drywall', start: '2025-04-01', end: '2025-04-10', progress: 0, dependencies: 'electrical, plumbing' }
];

const gantt = new Gantt('#gantt', tasks, {
  view_mode: 'Week',
  readonly: false,
  on_click: task => console.log('Clicked:', task),
  on_date_change: (task, start, end) => updateTaskDates(task.id, start, end),
  on_progress_change: (task, progress) => updateTaskProgress(task.id, progress)
});
</script>
```

### Scorecard Visualization

```javascript
// Radar chart for vendor scorecard
const scorecardChart = new Chart(ctx, {
  type: 'radar',
  data: {
    labels: ['Quality', 'Timeliness', 'Communication', 'Price', 'Safety'],
    datasets: [{
      label: 'ABC Electric',
      data: [4.5, 4.2, 4.0, 3.8, 4.8],
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
      borderColor: '#3b82f6'
    }]
  },
  options: {
    scales: {
      r: { min: 0, max: 5, ticks: { stepSize: 1 } }
    }
  }
});
```

**Sources:**
- [Chart.js Bar Chart Docs](https://www.chartjs.org/docs/latest/charts/bar.html)
- [Chart.js Stacked Bar](https://www.chartjs.org/docs/latest/samples/bar/stacked.html)
- [Frappe Gantt npm](https://www.npmjs.com/package/frappe-gantt)
- [Frappe Gantt Docs](https://docs.frappe.io/gantt/introduction)
- [Best JavaScript Gantt Libraries 2025](https://www.anychart.com/blog/2025/11/05/best-javascript-gantt-chart-libraries/)

---

## Integration Points

### How Components Connect

```
                    +------------------+
                    |   Supabase DB    |
                    | (PostgreSQL)     |
                    +--------+---------+
                             |
          +------------------+------------------+
          |                  |                  |
    +-----v-----+     +------v------+    +------v------+
    |  Catalog  |     |  Estimates  |    |   Vendors   |
    | (items,   |     | (projects,  |    | (scores,    |
    |  costs)   |     |  line items)|    |  history)   |
    +-----------+     +-------------+    +-------------+
          |                  |                  |
          +------------------+------------------+
                             |
                    +--------v---------+
                    |  Node.js/Express |
                    |  API Server      |
                    +--------+---------+
                             |
     +----------+------------+------------+-----------+
     |          |            |            |           |
+----v----+ +---v----+ +-----v-----+ +----v----+ +----v----+
|Estimation| |Schedule| | Document | | Scoring | |  Charts |
| Engine   | | Engine | | Intel    | | Engine  | |  API    |
|(decimal.js|(toposort,|(Claude API)|(SQL funcs)|(Chart.js)|
| custom)  | |date-fns)|           |           |          |
+----------+ +--------+ +-----------+ +---------+ +---------+
                             |
                    +--------v---------+
                    | Claude API       |
                    | (PDF processing, |
                    |  extraction)     |
                    +------------------+
```

### API Route Structure

```javascript
// Estimation routes
app.post('/api/estimates', createEstimate);
app.get('/api/estimates/:id', getEstimate);
app.post('/api/estimates/:id/line-items', addLineItem);
app.get('/api/estimates/:id/calculate', calculateEstimate);
app.get('/api/estimates/:id/export', exportEstimate);

// Schedule routes
app.post('/api/schedules', createSchedule);
app.get('/api/schedules/:id', getSchedule);
app.post('/api/schedules/:id/tasks', addTask);
app.get('/api/schedules/:id/critical-path', getCriticalPath);
app.get('/api/schedules/:id/gantt', getGanttData);

// Document intelligence routes
app.post('/api/documents/parse', parseDocument);
app.post('/api/documents/extract-proposal', extractProposal);
app.post('/api/documents/extract-quote', extractQuote);

// Vendor scoring routes
app.get('/api/vendors/:id/scorecard', getScorecard);
app.post('/api/vendors/:id/scores', addScore);
app.get('/api/vendors/leaderboard', getLeaderboard);
```

### Data Flow Example: Estimate from Proposal

```
1. User uploads vendor proposal PDF
   |
2. POST /api/documents/extract-proposal
   |-- pdf-parse extracts text (optional)
   |-- Claude API extracts structured data
   |-- Returns JSON with line items
   |
3. User reviews extracted data, creates estimate
   |
4. POST /api/estimates
   |-- Creates estimate header
   |-- Links to project
   |
5. POST /api/estimates/:id/line-items (bulk)
   |-- Matches items to catalog
   |-- Calculates costs with estimation engine
   |
6. GET /api/estimates/:id/calculate
   |-- Aggregates all line items
   |-- Applies markup/overhead
   |-- Returns complete estimate
   |
7. Frontend renders with Chart.js stacked bar
```

---

## Final Recommendations

### Required Dependencies

```bash
# Core calculation
npm install decimal.js

# Scheduling
npm install toposort date-fns

# PDF processing (optional, Claude handles PDFs natively)
npm install pdf-parse

# Visualization
npm install chart.js frappe-gantt chartjs-plugin-datalabels

# Already installed (verify versions)
npm install @anthropic-ai/sdk@latest
```

### Package.json Additions

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "chart.js": "^4.4.0",
    "chartjs-plugin-datalabels": "^2.2.0",
    "date-fns": "^3.0.0",
    "decimal.js": "^10.4.0",
    "frappe-gantt": "^1.0.4",
    "pdf-parse": "^2.4.0",
    "toposort": "^2.0.2"
  }
}
```

### What NOT to Use

| Technology | Why Not |
|------------|---------|
| **PlanSwift, Buildertrend, Autodesk Estimate** | SaaS platforms, not libraries. Can't embed. |
| **DHTMLX Gantt, Bryntum Gantt** | Commercial licenses ($500-2000+). Frappe Gantt is free and sufficient. |
| **RSMeans API** | No public API. Requires Gordian partnership. Build your own catalog. |
| **pdf.js directly** | Claude handles PDFs natively. pdf-parse is simpler if you need pre-extraction. |
| **Complex scheduling libraries (MS Project API)** | Overkill. toposort + custom CPM is sufficient and keeps control in your hands. |
| **Heavy frontend frameworks (React/Vue) for charts** | You're using vanilla JS. Chart.js and Frappe Gantt work standalone. |

### Confidence Summary

| Component | Confidence | Rationale |
|-----------|------------|-----------|
| Estimation Engine | HIGH | Custom logic using decimal.js - standard approach |
| Scheduling Engine | HIGH | toposort is battle-tested (4.8M weekly downloads) |
| Document Intelligence | HIGH | Claude's native PDF support is production-ready |
| Trade Scoring | HIGH | PostgreSQL computed columns - straightforward |
| Visualization | HIGH | Chart.js 4.x and Frappe Gantt are mature, documented |

### Integration Effort Estimate

| Component | Effort | Notes |
|-----------|--------|-------|
| Catalog data model expansion | 1-2 days | Add cost/labor fields to existing schema |
| Estimation calculation engine | 3-5 days | Core math + API endpoints |
| Schedule generation | 3-5 days | toposort integration + CPM |
| Document extraction prompts | 2-3 days | Claude prompt engineering |
| Trade scoring system | 2-3 days | SQL + simple API |
| Visualizations | 3-5 days | Chart.js configs + Frappe Gantt |
| **Total** | **15-23 days** | Assumes existing stack familiarity |

---

## Sources

### Official Documentation
- [Chart.js Documentation](https://www.chartjs.org/docs/)
- [Claude PDF Support](https://platform.claude.com/docs/en/docs/build-with-claude/pdf-support)
- [Frappe Gantt Documentation](https://docs.frappe.io/gantt/introduction)
- [toposort GitHub](https://github.com/marcelklehr/toposort)
- [date-fns Documentation](https://date-fns.org/)
- [decimal.js Documentation](https://mikemcl.github.io/decimal.js/)

### Research Sources
- [RSMeans Data from Gordian](https://www.gordian.com/products/rsmeans-data-services/)
- [Critical Path Method Guide - Wrike](https://www.wrike.com/blog/critical-path-is-easy-as-123/)
- [CPM Still the Gold Standard 2025](https://consultleopard.com/critical-path-method-cpm-scheduling-still-the-gold-standard-in-2025/)
- [Vendor Rating Complete Guide 2025](https://www.kodiakhub.com/blog/vendor-rating-guide)
- [Best JavaScript Gantt Libraries 2025](https://www.anychart.com/blog/2025/11/05/best-javascript-gantt-chart-libraries/)
- [7 PDF Parsing Libraries Node.js 2025](https://strapi.io/blog/7-best-javascript-pdf-parsing-libraries-nodejs-2025)
