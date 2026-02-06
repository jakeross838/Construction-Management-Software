# Features Research: v3.0 Smart Catalog & Estimation Engine

**Domain:** Construction estimation and intelligence platform
**Researched:** 2026-01-20
**Overall Confidence:** HIGH (verified across multiple industry sources and leading platforms)

---

## Estimation Features

### Table Stakes

Features users expect from any serious construction estimation software. Missing these means the product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Item/Assembly Cost Catalog** | Foundation of all estimates; every competitor has one | Medium | Must support both raw items and pre-built assemblies (e.g., "Standard Bathroom" = fixtures + tile + labor) |
| **Material Takeoff** | Core estimating function - calculate quantities from plans | Medium | Can start manual, but digital measurement tools expected |
| **Labor Cost Calculation** | Labor is 40-60% of project cost | Medium | Must handle different labor rates by trade, region, skill level |
| **Markup/Margin Management** | Builders need to set profit margins correctly | Low | Critical: support both markup % and margin % (different calculations - 25% markup = 20% margin) |
| **Allowances** | Standard practice for unspecified items (fixtures, finishes) | Medium | Track allowance vs actual, auto-generate change orders for overages |
| **Cost Categories** | Organize costs by division (CSI MasterFormat standard) | Low | At minimum: materials, labor, subcontractor, equipment, overhead |
| **Estimate Templates** | Reuse common project types (bathroom remodel, kitchen, addition) | Low | Time saver; every major platform offers this |
| **Estimate Versioning** | Track changes between proposal revisions | Medium | Clients expect to see what changed between V1 and V2 |
| **PDF Proposal Generation** | Professional output for client delivery | Low | Customizable templates with company branding |
| **Estimate vs Actual Tracking** | Compare what was quoted vs what was spent | Medium | Basic job costing; feeds into profitability analysis |

### Differentiators

Features that set the product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-Powered Takeoff** | 40-60% time reduction vs manual measurement | High | Leaders like Beam AI, STACK, Togal.ai offer this; market differentiator |
| **Selection-Driven Estimation** | Staff picks catalog items, costs auto-calculate | Medium | This is Ross Built's core vision - unique workflow |
| **Real-Time Pricing Updates** | Costs reflect current market rates | High | RSMeans charges premium for this; integration with suppliers is complex |
| **Schedule Generation from Selections** | Estimate auto-generates project timeline | High | Few platforms do this well; major differentiator |
| **Specification Sheet Auto-Generation** | Selections create spec documents automatically | Medium | Reduces manual documentation work |
| **Multi-Scenario Comparison** | "What if" analysis for different selection packages | Medium | Let clients compare Standard vs Premium options |
| **Predictive Cost Modeling** | Use historical data to predict costs before full takeoff | High | AI/ML opportunity; industry growing at 24.6% CAGR |
| **Allowance Budget Guardrails** | Only show selections within budget range | Low | Buildertrend offers this; prevents overage surprises |

### Anti-Features

Features to deliberately NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Over-Detailed Line Items by Default** | Overwhelms clients; "1,247 screws @ $0.02" is noise | Provide detail levels: Summary / Detailed / Full Breakdown |
| **Manual Material Price Entry Only** | Goes stale immediately; leads to inaccurate bids | Build supplier integrations or database sync from day one |
| **Generic Percentage Markups** | 20% on everything is wrong; different trades have different margins | Support category-specific markup rules |
| **Standalone Estimates (No Project Link)** | Estimates that don't flow into actual job tracking are useless | Always connect estimate to project from the start |
| **Complex Formula Builder** | Builders aren't Excel power users; they'll make errors | Pre-built calculation methods with clear inputs |
| **Single Markup Method** | Confusing markup vs margin causes lost profit | Support both, with clear calculator showing the math |

---

## Trade Management Features

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Trade/Subcontractor Database** | Central place to store all subs | Low | Name, contact, trades, insurance info |
| **Insurance/License Tracking** | Liability protection; clients expect this | Medium | COI expiration alerts are table stakes |
| **Bid Solicitation** | Request quotes from multiple subs | Medium | Email/portal-based bid requests |
| **Work Order Management** | Assign work to trades with clear scope | Medium | What, when, where, how much |
| **Payment Tracking** | Track what's owed to subs | Medium | Retention handling is construction-specific |
| **Performance Notes** | Track quality, timeliness, communication | Low | Simple rating/notes per trade |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Trade Scoring System** | Quantified performance metrics (like COMPASS Q Score) | High | Financial health + safety + timeliness = composite score |
| **Bid History Analysis** | Track how often trades bid, win, and perform on budget | Medium | Valuable data for choosing preferred trades |
| **Automated Bid Comparison** | Side-by-side comparison of trade bids | Medium | Normalize line items to compare apples-to-apples |
| **Pre-Qualification Workflows** | Automated vetting before adding to preferred list | High | Leaders: Vertikal PreQual, Autodesk TradeTapp, Highwire |
| **Trade Cost Benchmarking** | "This electrician is 15% above your average" | Medium | Requires historical data accumulation |
| **Schedule Integration** | Trade availability synced with project schedule | Medium | Reduce scheduling conflicts |
| **Document Collection Portal** | Self-service portal for trades to upload docs | Medium | Reduces admin chase work |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Over-Complex Prequalification** | Small custom builders don't need enterprise-grade vetting | Start simple (insurance + license check), add complexity later |
| **Trade Rating Without Context** | "3.5 stars" means nothing without specifics | Track specific dimensions: quality, timeliness, communication, pricing |
| **Manual Insurance Expiration Tracking** | Error-prone, gets forgotten | Automated alerts + renewal reminders mandatory |
| **Separate Trade Database Per Project** | Duplicates effort, loses institutional knowledge | One master trade database, project assignments are relationships |

---

## Document Intelligence Features

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Document Upload & Storage** | Central repository for all project docs | Low | PDFs, images, specs, contracts |
| **Basic OCR/Text Extraction** | Search within uploaded documents | Medium | Must work on scanned PDFs, handwritten notes |
| **Document Categorization** | Proposals, invoices, contracts, change orders | Low | Auto-suggest categories based on content |
| **Search Across Documents** | Find "granite countertop" across all project docs | Medium | Full-text search is expected |
| **Versioning** | Track document revisions | Low | V1, V2, V3 with dates and who uploaded |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Proposal/Bid Parsing** | Extract line items, costs, scope from uploaded bids | High | AI/NLP required; Datagrid, Mastt, Civils.ai doing this |
| **Invoice Data Extraction** | Auto-populate cost tracking from invoices | High | Ross Built already has v2.0 invoice processing |
| **Contract Clause Detection** | Flag risky terms, payment terms, warranty clauses | High | Document Crunch specializes in this |
| **Specification Extraction** | Pull material specs from uploaded documents | High | Feed catalog with verified data from actual specs |
| **Cross-Document Correlation** | Link invoice to original estimate line item | High | Powerful for estimate vs actual analysis |
| **Natural Language Queries** | "What was the allowance for kitchen cabinets?" | High | Civils.ai-style conversational interface |
| **Database Enrichment** | Every document uploaded improves the system | High | Core vision: documents feed catalog and pricing |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Manual Data Entry from Documents** | Defeats the purpose; slow and error-prone | AI extraction with human verification |
| **Siloed Document Processing** | Extract data but don't connect to catalog/estimates | Every extraction should update structured data |
| **Over-Confident Extraction** | AI extracts wrong data confidently | Show confidence scores, require human verification for low-confidence items |
| **Document-Only Intelligence** | Documents as static files, not learning fuel | Every document teaches the system pricing, patterns, terms |

---

## Scheduling Features

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Task/Phase Management** | Break project into schedulable units | Medium | Phases > Tasks > Subtasks hierarchy |
| **Timeline/Gantt View** | Visual project schedule | Medium | Industry-standard visualization |
| **Dependency Management** | Task B can't start until Task A finishes | Medium | Critical path awareness |
| **Trade Assignment** | Which sub does which task | Low | Link tasks to trade database |
| **Schedule Templates** | Reuse project type schedules (bathroom remodel = typical 3-week template) | Low | Time saver; every major platform offers this |
| **Schedule Sharing** | Share with clients and subs | Low | Client portal, email updates |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Selection-Driven Scheduling** | Selections auto-generate lead time tasks | High | Core Ross Built vision; unique in market |
| **Material Lead Time Integration** | Custom vanity = 8 weeks lead time auto-scheduled | High | Requires supplier lead time database |
| **Auto-Schedule from Estimate** | Estimate line items become schedule tasks | High | Buildxact does this; major time saver |
| **Weather-Adjusted Scheduling** | Account for seasonal conditions | Medium | Exterior work winter buffers |
| **Sub Availability Integration** | Check trade availability before scheduling | Medium | Requires trade calendar integration |
| **Critical Path Highlighting** | Show which tasks drive the timeline | Medium | Helps prioritize decisions |
| **Client Decision Deadlines** | Selection due dates that protect schedule | Medium | "Choose cabinets by X date or schedule slips Y weeks" |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Over-Detailed Task Breakdown** | 500 tasks for a bathroom is unmanageable | Appropriate granularity: 20-50 tasks for most projects |
| **Schedule Without Buffer** | Every project has delays | Build in contingency time automatically |
| **Manual Schedule Updates Only** | Real projects change constantly | Auto-adjust downstream tasks when changes occur |
| **Disconnected Schedule and Budget** | Schedule changes should trigger cost changes | Integrated schedule-cost model |
| **Complex Resource Leveling** | Enterprise PM feature builders won't use | Simple trade conflict detection instead |

---

## Feedback Loop Features

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Estimate vs Actual Report** | Basic job costing; what did we quote vs spend | Medium | Per-project variance analysis |
| **Cost Category Breakdown** | See variance by materials, labor, subs, etc. | Medium | Identify where estimates are off |
| **Project Profitability Report** | Did we make money on this job? | Medium | Revenue - All Costs = Profit |
| **Historical Project Archive** | Past projects available for reference | Low | Searchable project database |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic Cost Database Updates** | Actuals improve future estimates | High | Core Ross Built vision; very few platforms do this well |
| **Variance Pattern Detection** | "Kitchen cabinets consistently 15% over estimate" | High | ML opportunity; proactive warnings |
| **Supplier Performance Tracking** | Which suppliers deliver on price/time | Medium | Aggregate invoice data by supplier |
| **Regional Cost Intelligence** | Costs vary by geography; learn local pricing | High | Valuable for multi-location builders |
| **Predictive Contingency** | "Similar projects ran 8% over; recommend 10% contingency" | High | Data-driven contingency setting |
| **Estimator Performance Metrics** | Which estimators are most accurate | Medium | Team improvement tool |
| **Seasonal Cost Patterns** | Material costs vary by season; learn patterns | High | Lumber spikes in spring; plan accordingly |
| **Document-to-Database Pipeline** | Invoices auto-update pricing database | High | Continuous learning from operations |

---

## Client Portal Features (Future: Leads/Architects)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Selection Portal** | Clients browse and choose finishes | Medium | Image-based, organized by room/category |
| **Budget Visibility** | Show allowance and running total | Low | Transparency prevents surprises |
| **Selection Confirmation** | Digital approval/signature | Low | Legal protection + clear record |
| **Progress Photos** | See construction progress | Low | Simple photo gallery per project |
| **Document Access** | View contracts, change orders, invoices | Low | Read-only portal access |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Visual Selection Experience** | Room-based visualization of choices | High | Houzz Pro and Buildern do this well |
| **Budget Impact Calculator** | "Upgrading to marble adds $3,500" | Medium | Real-time cost feedback |
| **Decision Deadline Tracking** | Clear due dates with schedule impact warnings | Medium | "Decide by Friday or construction delays 2 weeks" |
| **Architect Collaboration** | Architects can add/approve specifications | Medium | Future value; differentiated workflow |
| **Lead Intake Workflow** | Prospective clients can start project planning | Medium | Future revenue stream |
| **Selection Comparison** | Side-by-side Standard vs Premium packages | Medium | Helps clients make decisions |

---

# Job Costing & Financial Management Features

**Domain:** Construction financial management and job costing
**Researched:** 2026-01-20
**Context:** Ross Built CMS for custom home builder adding expense tracking, overhead allocation, job profitability, company P&L, and business planning

---

## Table Stakes (Users Expect These)

Features that contractors expect from any serious construction accounting/job costing system. Missing these creates friction.

| Feature | Why Expected | Complexity | Implementation Notes |
|---------|--------------|------------|---------------------|
| **Job Cost Tracking** | Foundation of construction accounting - every dollar tied to a job | Medium | Already have v2_invoices with job_id; need expense tracking |
| **Budget vs Actual Reports** | Contractors live by variance analysis | Medium | Compare budgeted_amount vs actual spend by cost code |
| **WIP (Work-in-Progress) Schedule** | Required for % completion accounting; shows over/under billing | High | Earned revenue vs billed to date; critical for cash flow |
| **Cost Code Breakdown** | Organize costs by CSI divisions (materials, labor, equipment, subs) | Low | Already have v2_cost_codes; ensure consistent categorization |
| **Labor Cost Tracking** | Labor is 40-60% of project cost; must track by job | Medium | Need timesheet integration or manual hour entry |
| **Subcontractor Payment Tracking** | Track what's owed to subs; retention handling | Medium | Already tracking via POs; need retention calculation |
| **Job Profitability Report** | "Did we make money on this job?" - revenue minus all costs | Medium | Requires complete cost capture including allocated overhead |
| **Cash Flow Visibility** | 1 in 5 contractors struggle with cash flow; critical metric | High | Receivables aging, payables timing, draw forecasting |
| **G702/G703 Reports** | AIA billing format; industry standard for draws | Low | Already implemented in draws.html |
| **Expense Categorization** | Direct costs vs indirect costs vs overhead | Low | Clear separation enables proper allocation |
| **Accounts Payable Tracking** | What do we owe and when | Medium | Invoice due dates, aging reports |
| **Accounts Receivable Tracking** | What are we owed and when | Medium | Draw status, payment collection timing |

---

## Labor Burden Calculation

**Industry Insight:** Labor burden adds 24-70% on top of base wages. Contractors who ignore this underestimate job costs by 15-35%.

### Burden Components

| Component | Typical % | Required/Optional | Notes |
|-----------|-----------|-------------------|-------|
| **Payroll Taxes (FICA, FUTA, SUTA)** | 10-15% | Required | Social Security 6.2%, Medicare 1.45%, Unemployment varies |
| **Workers' Compensation Insurance** | 5-20% | Required (most states) | Varies dramatically by trade (office 0.5% vs roofing 20%+) |
| **Health Insurance** | 8-15% | Optional but common | Major cost for larger crews |
| **Retirement/401k** | 3-6% | Optional | Employer match if offered |
| **Paid Time Off** | 4-8% | Optional | Vacation, holidays, sick time |
| **Training** | 1-3% | Optional | Safety certifications, skill development |
| **Equipment/Tools** | 2-5% | Sometimes | Small tools, PPE, consumables |

### Calculation Methods

| Method | Description | Best For | Ross Built Recommendation |
|--------|-------------|----------|---------------------------|
| **Fixed Percentage** | Add flat % (e.g., 30%) to all labor | Simple operations, similar work | Good for v1; easy to understand |
| **Detailed Burden Rate** | Calculate actual costs per employee | Larger crews, varied trades | v2+ when tracking actual costs |
| **Per-Hour Burden** | Total burden / billable hours = $/hour | T&M billing, precise costing | Good for field crews |

**Formula:** `Fully Burdened Rate = (Base Wage + Burden Costs) / Billable Hours`

**Example:** Carpenter at $25/hr base:
- Payroll taxes: $4/hr (16%)
- Workers' comp: $3/hr (12%)
- Benefits: $2/hr (8%)
- Equipment: $1/hr (4%)
- **Burdened Rate: $35/hr (40% burden)**

### Table Stakes for Labor Burden

| Feature | Why Expected | Notes |
|---------|--------------|-------|
| **Configurable Burden Rate** | Every company has different costs | Default 30-35% with adjustment |
| **Apply Burden Automatically** | Don't make users calculate manually | When entering labor hours, show burdened cost |
| **Burden Visibility** | Users need to understand where money goes | Breakdown view: "Base: $25 + Burden: $10 = $35" |
| **Quarterly Review Reminder** | Rates change; AGC says 12-18% better cost control with quarterly updates | Prompt to review burden settings |

---

## Overhead Allocation Methods

**Industry Insight:** Overhead is typically 10-20% of direct costs. Failure to allocate leads to distorted job profitability - projects look profitable until the company loses money.

### Overhead Categories

| Category | Examples | Allocation Approach |
|----------|----------|---------------------|
| **Office Overhead** | Rent, utilities, office staff, software, insurance | Allocate by % of direct costs or labor hours |
| **Fleet/Vehicle** | Trucks, fuel, maintenance, insurance | Allocate by job usage or % of direct costs |
| **Equipment** | Tools, machinery, depreciation | Allocate by equipment hours used on job |
| **Management** | Owner time, PM time not charged to specific job | Allocate by labor hours or project size |
| **General Admin** | Accounting, HR, legal, marketing | Allocate by revenue % or direct cost % |

### Allocation Methods Comparison

| Method | How It Works | Pros | Cons | Best For |
|--------|--------------|------|------|----------|
| **% of Direct Costs** | Overhead / Total Direct Costs = % applied to each job | Simple, easy to implement | May not reflect actual consumption | Most custom builders |
| **% of Labor Hours** | Overhead / Total Labor Hours = $/hour applied to each job | Labor-intensive work fairly allocated | Doesn't work for subcontractor-heavy jobs | Labor-heavy operations |
| **% of Labor Dollars** | Overhead / Total Labor $ = % applied to each job | Accounts for wage differences | Similar to labor hours limitation | When crews have different rates |
| **Activity-Based Costing (ABC)** | Allocate by specific activities that drive costs | Most accurate | Complex, requires detailed tracking | Enterprise, not for SMB |
| **Square Footage** | For similar projects, allocate by size | Simple comparison | Doesn't work for varied project types | Production builders |

**Ross Built Recommendation:** Start with **% of Direct Costs** (simplest, most common). Formula:
```
Overhead Rate = Annual Overhead / Annual Direct Costs
Example: $200,000 overhead / $1,000,000 direct costs = 20%
Applied: Job with $50,000 direct costs gets $10,000 overhead allocation
```

### Table Stakes for Overhead Allocation

| Feature | Why Expected | Notes |
|---------|--------------|-------|
| **Company Overhead Rate Setting** | Configure the % to apply | Single global setting for v1 |
| **Automatic Allocation** | Apply to jobs without manual entry | When job closes or on-demand calculation |
| **Show Allocated vs Direct** | Users need to see breakdown | "Direct: $45K, Overhead: $9K, Total: $54K" |
| **Exclude from Client Billing** | Overhead is internal costing, not line item | Don't show overhead allocation on invoices/draws |

---

## Job Profitability Reports

### Required Report: Job Cost Summary

| Section | Data Points | Notes |
|---------|-------------|-------|
| **Revenue** | Contract amount, change orders, total revenue | What client is paying |
| **Direct Costs** | Materials, labor (burdened), subcontractors, equipment | Costs directly tied to job |
| **Gross Profit** | Revenue - Direct Costs | Before overhead allocation |
| **Gross Margin %** | Gross Profit / Revenue * 100 | Industry target: 18-35% for residential |
| **Allocated Overhead** | Job's share of company overhead | Based on allocation method |
| **Net Job Profit** | Gross Profit - Allocated Overhead | True profitability |
| **Net Margin %** | Net Job Profit / Revenue * 100 | Industry target: 5-15% net |

### Required Report: WIP (Work-in-Progress) Schedule

**Critical for:** Percentage of completion accounting, cash flow management, identifying billing issues

| Column | Calculation | Purpose |
|--------|-------------|---------|
| **Contract Amount** | Original + approved change orders | Total expected revenue |
| **Estimated Costs at Completion** | Budget + anticipated overruns | Total expected costs |
| **% Complete** | Costs to Date / Estimated Costs at Completion | How far along the job is |
| **Earned Revenue** | Contract Amount * % Complete | Revenue earned based on work done |
| **Billed to Date** | Sum of all invoices/draws submitted | What has been billed |
| **Over/Under Billing** | Billed to Date - Earned Revenue | Positive = overbilled, Negative = underbilled |

**Industry Insight:** Underbilling is common and dangerous - it means you've done work but haven't billed for it, creating cash flow problems.

### Required Report: Budget vs Actual

| Column | Data | Notes |
|--------|------|-------|
| **Cost Code** | Organized by CSI division | 06100 Rough Carpentry, etc. |
| **Budgeted Amount** | Original estimate | What was planned |
| **Committed** | POs + contracts issued | What's promised to subs/suppliers |
| **Actual to Date** | Invoices paid + accrued | What's been spent |
| **Projected at Completion** | Actual + remaining committed | Where we're heading |
| **Variance** | Budgeted - Projected | Positive = under budget |
| **Variance %** | Variance / Budgeted * 100 | Red flag if >5-10% |

---

## Company P&L (Profit & Loss)

### Standard Construction P&L Structure

| Line Item | Description | Notes |
|-----------|-------------|-------|
| **Revenue** | | |
| Contract Revenue | Sum of job billings | What clients are paying |
| Change Order Revenue | Additional approved work | Track separately for analysis |
| Other Income | Interest, equipment rental | Non-job revenue |
| **Total Revenue** | | |
| | | |
| **Cost of Goods Sold (Direct Costs)** | | |
| Materials | Job materials purchased | From invoices with cost codes |
| Direct Labor | Burdened labor costs | Field crew wages + burden |
| Subcontractor Costs | Sub invoices | From PO/invoice system |
| Equipment Costs | Job-specific equipment | Rental, fuel for job |
| Other Direct Costs | Permits, inspections | Job-specific |
| **Total COGS** | | |
| | | |
| **Gross Profit** | Revenue - COGS | |
| **Gross Margin %** | GP / Revenue | Target: 20-35% |
| | | |
| **Operating Expenses (Overhead)** | | |
| Office Salaries | Non-field staff | Admin, PM salaries |
| Office Rent/Utilities | Facility costs | |
| Insurance (General) | GL, E&O, auto | Not workers' comp (that's burden) |
| Fleet/Vehicle | Trucks, fuel, maintenance | Company vehicles |
| Software/Technology | Accounting, PM software | |
| Professional Services | Accounting, legal | |
| Marketing | Advertising, website | |
| Other G&A | Office supplies, etc. | |
| **Total Operating Expenses** | | |
| | | |
| **Operating Income** | GP - Operating Expenses | |
| **Operating Margin %** | OI / Revenue | Target: 5-12% |
| | | |
| Interest Expense | Loans, lines of credit | |
| Taxes | Income taxes | |
| **Net Income** | | |
| **Net Margin %** | NI / Revenue | Target: 3-8% |

### Key P&L Metrics for Builders

| Metric | Calculation | Target | Red Flag |
|--------|-------------|--------|----------|
| **Gross Margin** | Gross Profit / Revenue | 20-35% | <15% |
| **Overhead Ratio** | Operating Expenses / Revenue | 10-20% | >25% |
| **Net Margin** | Net Income / Revenue | 5-10% | <3% |
| **Direct Labor %** | Direct Labor / Revenue | 15-25% | >35% |
| **Material %** | Materials / Revenue | 25-40% | Varies by project type |

---

## Cash Flow Forecasting

### Key Cash Flow Metrics

| Metric | Calculation | Why It Matters |
|--------|-------------|----------------|
| **Days Sales Outstanding (DSO)** | (AR / Revenue) * Days in Period | How fast you collect; target <45 days |
| **Days Payables Outstanding (DPO)** | (AP / COGS) * Days in Period | How fast you pay; optimize timing |
| **Cash Conversion Cycle** | DSO - DPO + Days Inventory | Time from spending to collecting |
| **Backlog Value** | Signed contracts not yet completed | Future revenue pipeline |
| **Backlog Months** | Backlog / Average Monthly Revenue | How many months of work secured |

### Cash Flow Forecasting Components

| Component | Data Needed | Forecast Method |
|-----------|-------------|-----------------|
| **Inflows** | | |
| Draw Receipts | Draw schedule, payment terms | Project draws by expected payment date |
| Progress Billings | % complete, billing schedule | Monthly billings based on progress |
| Retainage Release | Retention %, release timing | Typically at project completion |
| | | |
| **Outflows** | | |
| Payroll | Crew size, pay schedule | Weekly/biweekly payroll projection |
| Subcontractor Payments | PO amounts, payment terms | As work completes, net 30 typical |
| Material Payments | Purchase orders, terms | Based on delivery schedule |
| Overhead | Monthly recurring costs | Fixed amount per month |
| Equipment | Rental/purchase schedule | Based on project schedule |

### Table Stakes for Cash Flow

| Feature | Why Expected | Notes |
|---------|--------------|-------|
| **13-Week Cash Forecast** | Standard planning horizon | Rolling weekly view |
| **Scenario Modeling** | "What if this draw is delayed?" | Toggle scenarios on/off |
| **AR Aging Report** | Who owes what and how old | 0-30, 31-60, 61-90, 90+ days |
| **AP Aging Report** | What we owe and when due | Plan payment timing |

---

## KPI Dashboard

### Essential Construction KPIs

| KPI | Formula | Target | Update Frequency |
|-----|---------|--------|------------------|
| **Gross Profit Margin** | Gross Profit / Revenue | 20-35% | Monthly |
| **Net Profit Margin** | Net Income / Revenue | 5-10% | Monthly |
| **Budget Variance** | (Actual - Budget) / Budget | <5% | Weekly |
| **Schedule Adherence** | On-time tasks / Total tasks | >95% | Weekly |
| **Cash Position** | Current cash balance | Positive | Daily |
| **Backlog Value** | Sum of unsigned + signed work | 6-12 months revenue | Monthly |
| **DSO (Days Sales Outstanding)** | AR collection speed | <45 days | Monthly |
| **Labor Productivity** | Output / Labor hours | Improving trend | Weekly |
| **Change Order Rate** | CO value / Original contract | <5-10% | Per project |
| **WIP Variance** | Over/under billing position | Near zero | Monthly |

### Dashboard Visualization

| Widget | Type | Data |
|--------|------|------|
| **Cash Position** | Single number + trend | Current cash, 30-day change |
| **Active Jobs** | Count + value | # jobs, total contract value |
| **This Month Revenue** | Gauge vs target | Actual vs plan |
| **Gross Margin Trend** | Line chart | Last 6-12 months |
| **AR Aging** | Stacked bar | 0-30, 31-60, 61-90, 90+ |
| **Job Profitability** | Table | Top 5/Bottom 5 by margin |
| **Backlog** | Funnel | Leads > Bids > Signed > In Progress |
| **Upcoming Draws** | List | Next 30 days draw schedule |

---

## Differentiators (Competitive Advantage)

Features that set Ross Built apart from competitors:

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic Expense-to-Job Allocation** | AI suggests job assignment for expenses | High | Extend existing invoice AI to all expenses |
| **Real-Time Job Profitability** | See margin as costs come in, not at end | Medium | Update job profit on every invoice/expense |
| **Integrated Invoice-to-Budget** | Invoice allocations auto-update budget tracking | Medium | Already have pieces; connect the dots |
| **Smart Overhead Warnings** | Alert when overhead ratio is unhealthy | Low | Simple threshold monitoring |
| **Cash Flow Projection from Draws** | Auto-forecast based on draw schedule | Medium | Use existing draw data + payment history |
| **Variance Pattern Detection** | "Electrical costs trending 15% over on all jobs" | High | ML on historical data |
| **One-Click Month-End** | Generate WIP, P&L, job reports automatically | Medium | Consolidate existing reports |
| **Mobile Expense Capture** | Photo receipt -> AI extraction -> job assignment | High | Extend invoice processing to receipts |

---

## Anti-Features (Commonly Requested, Often Problematic)

Features to deliberately NOT build or defer:

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full General Ledger** | Complex, need accountant expertise, QuickBooks already does this | Integration sync with QuickBooks/Xero |
| **Payroll Processing** | Highly regulated, liability, specialty software exists | Integrate with Gusto/ADP/Paychex |
| **Multi-Company/Multi-Entity** | Adds massive complexity | Focus on single company initially |
| **Activity-Based Costing (ABC)** | Overkill for custom builders; too complex | Simple % allocation methods |
| **Complex Depreciation Schedules** | Accounting function, not job costing | Track equipment costs, let accountants depreciate |
| **Bank Reconciliation** | Core accounting function | Leave to QuickBooks integration |
| **Tax Preparation** | Specialized, liability | Export data for accountant |
| **Inventory Management** | Custom builders don't stock materials | Track when ordered/installed |
| **Complex Multi-Level Approval Workflows** | Overhead for small teams | Simple approve/deny for small builders |
| **Timesheet Approval Workflows** | Extra friction for small crews | Trust or verify afterward |

---

## Feature Dependencies

Understanding what must be built before other features:

```
Level 0 (Foundation - Already Built):
├── v2_jobs, v2_vendors, v2_cost_codes
├── v2_invoices with allocations
├── v2_purchase_orders with line items
└── v2_draws with G702/G703

Level 1 (Expense Tracking):
├── Expense categories (overhead types)
├── Non-invoice expense entry
├── Labor hour tracking
└── Labor burden configuration
    ↓
Level 2 (Allocation & Costing):
├── Overhead allocation settings
├── Auto-allocation engine
└── Burdened labor calculation
    ↓
Level 3 (Job Profitability):
├── Job cost summary report
├── Budget vs actual by cost code
└── WIP schedule calculation
    ↓
Level 4 (Company Financials):
├── Company P&L
├── Cash flow forecast
└── AR/AP aging reports
    ↓
Level 5 (Business Intelligence):
├── KPI dashboard
├── Trend analysis
├── Pipeline/capacity planning
└── Predictive insights
```

---

## MVP Definition

### v1 MVP (Essential Job Costing)

**Goal:** Track all costs by job, calculate job profitability, basic overhead allocation

| Feature | Priority | Complexity | Notes |
|---------|----------|------------|-------|
| Expense entry (non-invoice costs) | P0 | Low | Simple form: amount, job, cost code, date |
| Labor hour tracking | P0 | Medium | Hours by job/cost code, manual entry |
| Labor burden rate config | P0 | Low | Single company-wide % setting |
| Overhead rate config | P0 | Low | Single company-wide % setting |
| Job cost summary | P0 | Medium | Revenue, direct costs, burden, overhead, profit |
| Budget vs actual report | P0 | Medium | By cost code, per job |
| Basic company P&L | P1 | Medium | Revenue - COGS - Overhead = Profit |

### v1.x (Enhanced Reporting)

| Feature | Priority | Notes |
|---------|----------|-------|
| WIP schedule | P1 | % complete, over/under billing |
| AR aging report | P1 | Draws by age |
| AP aging report | P1 | Invoices by due date |
| Cash position tracking | P1 | Current cash, forecast |
| Multiple burden rates | P2 | By employee or trade |
| Overhead by category | P2 | Office, fleet, equipment separately |

### v2+ (Business Intelligence)

| Feature | Priority | Notes |
|---------|----------|-------|
| KPI dashboard | P1 | Key metrics at a glance |
| Cash flow forecast | P2 | 13-week projection |
| Pipeline tracking | P2 | Leads, bids, backlog |
| Capacity planning | P2 | Resource vs upcoming work |
| Variance pattern detection | P3 | ML-powered insights |
| QuickBooks sync | P2 | Two-way data sync |
| Mobile expense capture | P3 | Photo -> AI -> job assignment |

---

## Competitor Feature Analysis

### Procore

**Target:** Large commercial/industrial contractors
**Pricing:** Custom annual contracts based on construction volume; unlimited users

| Strength | Weakness for Custom Builders |
|----------|------------------------------|
| Comprehensive project management | Overkill for residential |
| Deep integrations (Sage, Viewpoint) | Expensive for small volume |
| AI features (Copilot, Helix) | Complex interface |
| Excellent mobile app | Learning curve |
| Real-time cost tracking | Designed for large teams |

**Job Costing Features:**
- Commitment tracking (subcontracts, POs)
- Budget forecasting with real-time updates
- WIP reporting
- Direct ERP integrations
- My Time for labor tracking with geofencing

### Buildertrend

**Target:** Residential builders and remodelers
**Pricing:** ~$199-$499/month (after CoConstruct acquisition: $399-$699/month for unlimited)

| Strength | Weakness |
|----------|----------|
| Residential-focused features | Limited complex financial tools |
| Client communication portal | No AIA billing format |
| Reasonable pricing | Poor data export/portability |
| Job costing budget tools | Limited forecasting |
| Selection management | Forces sub subscriptions |

**Limitations Noted:**
- "Financial tools aren't designed for complex workflows"
- "Limited support for forecasting, multi-project oversight, or compliance-heavy billing"
- Data export is extremely difficult ("manually exporting everything one item at a time")
- Navigation described as "counter-intuitive and redundant"

### CoConstruct

**Target:** Custom home builders and remodelers
**Pricing:** $399-$699/month (Essential to Advanced)

| Strength | Weakness |
|----------|----------|
| Custom builder-specific features | Limited integrations (QuickBooks/Xero only) |
| Excellent client portal/CRM | Higher price point |
| Selection-driven workflows | Acquired by Buildertrend (uncertainty) |
| Budget and change order tracking | Learning curve |
| Higher user satisfaction (4.7/5 vs Procore 4.48/5) | |

**Key Differentiators:**
- CRM capabilities for lead management
- Self-service client portal for selections and updates
- Job costing with QuickBooks integration

### Foundation Software

**Target:** Small to mid-sized contractors
**Pricing:** Subscription-based, module pricing (lower than Sage)

| Strength | Weakness |
|----------|----------|
| Construction-specific accounting | Steep learning curve |
| Deep job costing | Desktop-focused |
| Customizable reports | Setup is challenging |
| Hundreds of built-in reports | Not cloud-native |
| Strong payroll for construction | |

**Job Costing Features:**
- Flexible report designer
- Bonding reports
- Cost code phases
- Change order processing
- WIP reports
- Overhead allocation

### Sage 300 CRE (Timberline)

**Target:** Midsize to large contractors and real estate
**Pricing:** Enterprise pricing

| Strength | Weakness |
|----------|----------|
| Enterprise-grade accounting | Expensive |
| AIA billing | Complex |
| Deep financial reporting | Requires training |
| Multi-company support | Overkill for custom builders |
| Industry standard | Legacy architecture |

### Summary: Ross Built Opportunity

| Gap in Market | Ross Built Can Address |
|---------------|------------------------|
| Buildertrend lacks AIA billing | Already have G702/G703 |
| Competitors have data portability issues | Build open data from start |
| Procore too complex for custom builders | Keep interface simple |
| CoConstruct has limited integrations | Build modern API-first |
| Foundation has steep learning curve | Modern UX design |
| No one does AI invoice processing well | Already differentiating |
| Overhead allocation is manual everywhere | Automatic allocation |

---

## Key Insights

### Critical Findings for Ross Built Financial Features

1. **Labor Burden is Non-Negotiable**
   - Contractors who estimate without burden underestimate by 35-60%
   - Simple 30% default with adjustment is sufficient for v1
   - Quarterly review improves cost control 12-18%

2. **Overhead Allocation Must Be Automatic**
   - Most contractors allocate overhead unevenly or not at all
   - Distorts job profitability - jobs look profitable while company loses money
   - Simple % of direct costs method is sufficient for custom builders

3. **WIP Schedule is Critical**
   - Required for % completion accounting
   - Identifies over/under billing issues
   - Key for cash flow management
   - 1 in 5 contractors struggle with cash flow

4. **Don't Build Accounting Features**
   - QuickBooks/Xero already handle general ledger, bank rec, taxes
   - Build job costing intelligence that accounting software lacks
   - Integration is the answer, not replacement

5. **Cash Flow Visibility Wins Loyalty**
   - Cash flow problems are the #1 killer of construction businesses
   - Simple AR/AP aging + 13-week forecast provides huge value
   - Most competitors are weak here

6. **Custom Builders Need Simple, Not Enterprise**
   - Procore/Sage are overkill
   - Buildertrend financial tools are too basic
   - Sweet spot: sophisticated job costing with simple UX

### Recommended Build Order

1. **Phase 1: Expense & Labor Tracking**
   - Non-invoice expense entry
   - Labor hour tracking
   - Burden rate configuration

2. **Phase 2: Overhead Allocation**
   - Overhead rate configuration
   - Automatic allocation engine
   - Job cost summary with allocated overhead

3. **Phase 3: Job Reports**
   - Budget vs actual by cost code
   - WIP schedule
   - Job profitability ranking

4. **Phase 4: Company Financials**
   - Company P&L
   - AR/AP aging
   - Basic cash flow forecast

5. **Phase 5: Dashboard & Intelligence**
   - KPI dashboard
   - Trend analysis
   - Predictive insights

---

## Sources

### Job Costing & WIP
- [Buildertrend: Work in Progress Reporting](https://buildertrend.com/blog/work-in-progress-reporting/)
- [Foundation Software: Job Costing](https://www.foundationsoft.com/software/job-costing/)
- [FastEasy Accounting: Job Costing WIP Reports](https://www.fasteasyaccounting.com/job-costing-w-i-p-reports-quickbooks)
- [Ressio: Custom Home Builder Finances](https://www.ressiosoftware.com/insights/how-builder-bookkeep-helps-custom-home-builders-take-control-of-their-finances)

### Labor Burden
- [Autodesk: Construction Labor Burden Explained](https://www.autodesk.com/blogs/construction/construction-labor-burden-explained/)
- [SmartBarrel: Labor Burden in Construction](https://smartbarrel.io/blog/labor-burden-in-construction/)
- [Procore: Fully Burdened Labor Rate](https://www.procore.com/library/fully-burdened-labor-rate)
- [eBacon: Labor Burden Calculation Formula](https://www.ebacon.com/construction/construction-labor-burden-calculation-the-complete-formula/)
- [Miter: Fully-Burdened Labor Costs 101](https://www.miter.com/resources/fully-burdened-labor-costs-101/)
- [MEP Academy: Construction Labor Rates with Burden](https://mepacademy.com/how-to-figure-construction-labor-rates-with-burden/)

### Overhead Allocation
- [Deltek: Overhead Cost Allocation in Construction](https://www.deltek.com/en/construction/accounting/job-costing/overhead-cost)
- [Foundation: Overhead Allocation Methods Explained](https://www.foundationsoft.com/learn/overhead-allocation-methods/)
- [CrewCost: Methods of Overhead Allocation](https://crewcost.com/blog/what-are-the-methods-of-overhead-allocation/)
- [Buildertrend: Cost Allocation](https://buildertrend.com/blog/cost-allocation/)
- [SmartBarrel: Construction Overhead](https://smartbarrel.io/blog/construction-overhead/)
- [RedHammer: Overhead Allocation Best Practices](https://www.redhammer.io/blog/overhead-allocation-in-construction-best-practices)

### Cash Flow & Forecasting
- [Procore: Construction Cash Flow Projection](https://www.procore.com/library/construction-cash-flow-projection)
- [Float App: Architecture & Construction](https://www.floatapp.com/architecture-construction)
- [Bauwise: Construction Cash Flow Forecasting](https://www.bauwise.com/construction-cash-flow-forecasting/)
- [Planyard: Construction Cash Flow Forecasting Software](https://planyard.com/construction-cash-flow-forecasting-software)
- [CMiC: Forecasting Management Software](https://cmicglobal.com/resources/article/Forecasting-Management-Software-A-Comprehensive-Look)

### Profit Margins
- [ServiceTitan: Construction Profit Margin](https://www.servicetitan.com/blog/construction-profit-margin)
- [Jobber: Calculate Profit Margins on Construction Jobs](https://www.getjobber.com/academy/contracting/calculate-profit-margins-on-construction-jobs/)
- [CrewCost: Guide to Construction Profit Margin](https://crewcost.com/blog/am-i-running-a-healthy-business-a-guide-to-construction-profit-margin)
- [FastEasy Accounting: Gross Profit Margin for Contractors](https://www.fasteasyaccounting.com/blog/deep-dive-into-gross-profit-margin-for-construction-contractors-0)
- [NextInsurance: Contractor Overhead and Profit Margin](https://www.nextinsurance.com/blog/typical-contractor-overhead-profit-margin/)

### KPIs
- [Procore: 8 Key Construction KPIs](https://www.procore.com/library/construction-kpis)
- [Autodesk: Construction KPIs](https://www.autodesk.com/blogs/construction/construction-kpis/)
- [Buildern: 5 Financial Construction KPIs](https://buildern.com/resources/blog/financial-construction-kpis/)
- [SmartPM: Top 12 Construction KPIs](https://smartpm.com/blog/12-fundamental-key-performance-indicators-in-construction)
- [Ajelix: 15 KPIs for Construction](https://ajelix.com/bi/kpis-for-construction/)

### Competitor Analysis
- [Buildertrend vs Procore 2026](https://buildern.com/resources/blog/buildertrend-vs-procore/)
- [Procore vs CoConstruct](https://www.selecthub.com/construction-management-software/procore-vs-coconstruct/)
- [CoConstruct vs Buildertrend](https://cmfusion.com/blog/coconstruct-vs-buildertrend)
- [Foundation Software Reviews 2026](https://www.capterra.com/p/2032/FOUNDATION/)
- [Best Construction Accounting Software 2026](https://www.permitflow.com/blog/construction-accounting-software)
- [Buildertrend Reviews](https://www.softwareadvice.com/construction/buildertrend-profile/reviews/)
- [Sage + Procore Integration](https://www.sage.com/en-us/sage-construction/procore/)

### Financial Best Practices
- [Performance Financial: Accounting Tips for Custom Home Builders](https://www.performancefinancialllc.com/blog-posts/top-accounting-tips-for-custom-home-builders)
- [Prince CPA: Key Financial Reports for Builders](https://princecpagroup.com/homebuilder-accounting-key-financial-reports-every-builder-needs/)
- [Pro Builder: Financial Management 101](https://www.probuilder.com/financial-management-101-home-builders)
- [Asnani CPA: Bookkeeping Tips for Custom Home Builders](https://www.asnanicpa.com/post/bookkeeping-tips-for-custom-home-builders-managing-your-financial-foundation)
- [RedHammer: Top 10 Construction Accounting Tips](https://www.redhammer.io/blog/top-10-construction-accounting-tips-for-homebuilders)

### Implementation & Common Mistakes
- [Construction Dive: Software Implementation Mistakes](https://www.constructiondive.com/news/mistakes-software-implementation-construction/730695/)
- [RedHammer: Pitfalls of Bad Implementation](https://www.redhammer.io/blog/the-pitfalls-of-a-bad-implementation-how-to-avoid-common-mistakes)
- [Construction Cost Accounting: 11 Mistakes & Solutions](https://www.constructioncostaccounting.com/post/accounting-for-construction-companies-mistakes-and-solution)
- [MN Advisors: Common Accounting Mistakes](https://www.mnadvisors.com/blog/post/six-common-accounting-mistakes-construction-companies-need-to-avoid)
