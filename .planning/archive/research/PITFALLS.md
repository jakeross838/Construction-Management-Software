# Pitfalls Research: Job Costing & Overhead Allocation System

**Domain:** Construction Financial Management - Custom Home Builder
**Researched:** 2026-01-20
**Project Context:** Ross Built CMS adding job costing with overhead allocation via % of labor hours
**Confidence:** HIGH (based on extensive industry research and documented failures)

---

## Executive Summary

Building a job costing and overhead allocation system for construction carries significant risk because errors directly translate to financial loss and damaged client relationships. The research reveals seven major pitfall categories, each with documented industry failure patterns. The most dangerous pitfalls are subtle: systems that appear to work but silently accumulate errors, overhead allocation methods that reward gaming over accuracy, and period-close processes that miss critical reconciliations.

**Critical insight:** 85% of construction projects go over budget, often because job cost overruns aren't spotted early enough. Spreadsheet-based tracking has an 88% error rate, and payroll processing errors cost 1-8% of total payroll. This is the problem space Ross Built's job costing system must solve.

---

## 1. Critical Pitfalls

### CRITICAL: Overhead Allocation by Direct Cost Percentage

**What goes wrong:** "The most common mistake is allocating overhead as a percentage of job cost. This practice is so universal that we rarely meet a contractor who veers from it. It is also a greatly flawed approach."

**Why it happens:**
- Simple to implement and understand
- Widely taught and accepted in the industry
- Most overhead costs are NOT driven by dollar volume
- They're typically driven by labor hours, equipment usage, job complexity, and duration

**Real-world consequences:**
- Over-estimating costs on material-heavy jobs (win jobs you don't want)
- Under-estimating costs on labor-heavy jobs (lose money on jobs you win)
- "[You] end up winning jobs you don't want (headache jobs) and losing jobs you do want (easily managed jobs)"
- Projects that appear profitable on paper barely break even once all costs are accounted for

**Warning signs:**
- Consistent profit margin variance between project types
- Material-heavy jobs more profitable than expected
- Labor-heavy jobs less profitable than expected
- Users manually adjusting overhead percentages per job

**How to avoid:**
- Use labor hours for labor-intensive projects (custom home building)
- Use machine hours for equipment-heavy operations
- Consider multiple allocation bases for different overhead categories
- Regularly review and adjust allocation methods based on actual results
- Calculate an "Overhead Allocation Factor" and verify it annually

**Phase to address:** Phase 1 - Core job costing setup - Must get allocation method right from start

**Recovery if it happens:**
- Retroactively analyze completed projects to identify systematic bias
- Implement dual-allocation (by cost and by hours) for comparison
- Create overhead allocation audit reports

---

### CRITICAL: Labor Burden Calculation Errors

**What goes wrong:** "A $25-per-hour carpenter actually costs your company closer to $40 per hour when you factor in all the hidden expenses." Most companies underestimate true labor costs by 30-50%.

**Why it happens:**
- Omitting occasional costs (annual bonuses, health insurance contributions)
- Underestimating indirect labor costs (payroll taxes, workers' comp)
- Not accounting for benefits, PTO, training time
- Time tracking errors compound burden calculations

**Industry benchmarks:**
- Non-union contractors: Labor burden typically 24-33% of base wages
- Union contractors: Labor burden typically 60-70% of base wages

**Real-world consequences:**
- "Failure to account for labor burden will create the illusion of profitability while silently draining your bank account"
- Systematic underbidding on labor-heavy projects
- Cash flow surprises when payroll taxes come due
- Incorrect job profitability assessments

**Warning signs:**
- Time tracking shows 5%+ variance from payroll hours
- Labor cost estimates consistently below actuals
- Quarterly tax payments higher than expected
- Job profitability drops after labor burden reconciliation

**How to avoid:**
- Track labor burden and overhead separately
- Recalculate fully burdened labor rate at least annually
- Include ALL costs: FICA, FUTA, SUTA, workers' comp, health insurance, retirement contributions, PTO, training
- Validate time tracking accuracy (buddy punching, rounded entries, delayed submission inflate hours)
- "Labor burden and overhead both represent costs that are not immediately visible... should be tracked separately"

**Phase to address:** Phase 1 - Must be foundational before any labor-based allocation

**Recovery if it happens:**
- Audit last 12 months of projects for true labor burden
- Create burden rate calculator with all cost components
- Implement automatic burden rate updates when insurance/tax rates change

---

### CRITICAL: WIP (Work in Progress) Accounting Errors

**What goes wrong:** "If your cost estimates are incomplete or inaccurate, then your percentage of work complete, estimated profit, earned revenue, and over/under billing calculations will all be wrong."

**Common WIP mistakes:**
1. Incomplete or inaccurate cost tracking
2. Poor expense documentation from project managers
3. Delayed expense tracking (not real-time)
4. Treating contract values as static (ignoring change orders)
5. Recording change order revenue without cost updates
6. Skipping WIP-to-General Ledger reconciliation
7. Infrequent WIP schedule updates (yearly instead of monthly)
8. Manual data entry errors

**Real-world consequences:**
- Overstated percent complete leads to inflated revenues and profits
- Underbillings create cash flow problems and raise red flags with banks/sureties
- Financial statements that don't reflect reality
- Surprise losses at project completion
- Pay app rejections and payment delays

**Warning signs:**
- Large month-end or year-end adjustments
- WIP totals don't match GL Work in Progress accounts
- Projects show profit until final close, then show loss
- Persistent over/under billing patterns
- Accounting and PM teams have different numbers

**How to avoid:**
- Update WIP schedule monthly (minimum quarterly)
- Reconcile WIP to General Ledger every month
- Track expenses in real-time, not batched
- Treat contract value as dynamic (update with every change order)
- Always update cost estimates when adding change order revenue
- "Bring the project and accounting teams together every month to review costs and estimates"

**Phase to address:** Phase 2 - After core job costing, before period close

**Recovery if it happens:**
- Immediate WIP-to-GL reconciliation
- Project-by-project estimate review
- Establish monthly review cadence with PMs

---

### CRITICAL: Period Close Data Timing Issues

**What goes wrong:** "Timing issues are a major problem--even when transactions eventually get assigned to jobs, the timing lag creates periods where job cost reports are dramatically inaccurate."

**Why it happens:**
- Credit card expenses not coded to jobs for days/weeks
- Invoices entered after period close
- Payroll burden calculated after timesheet submission
- Vendor invoices received late
- "For contractors using credit cards for 40-60% of their material purchases, this processing method can leave 25-35% of actual job costs unassigned"

**Real-world consequences:**
- Job looks profitable mid-month, shows loss after reconciliation
- Decisions made on stale/incomplete data
- Period comparisons are meaningless
- Cash flow projections fail

**Warning signs:**
- Large post-close adjustments every month
- Job profitability changes significantly after close
- Credit card reconciliation takes days
- "The project might look highly profitable mid-month, only to show losses after the credit card reconciliation"

**How to avoid:**
- Define clear cutoff dates and enforce them
- Automate credit card expense coding
- Process invoices daily, not batched
- Implement accrual estimates for known but unrecorded costs
- Create "soft close" reports mid-period
- Weekly reconciliation process to catch allocation errors early

**Phase to address:** Phase 2 - Period close procedures

**Recovery if it happens:**
- Create "as-of" reporting with cutoff transparency
- Implement accrual reversal system
- Add data completeness indicators to reports

---

### HIGH: Rounding and Decimal Precision Errors

**What goes wrong:** "Rounding errors can arise during mathematical operations... Over successive calculations, these errors can accumulate and potentially lead to significant inaccuracies in financial results."

**Why it happens:**
- Using floating-point numbers for money calculations
- Rounding at intermediate steps instead of final results
- Inconsistent rounding rules (round up vs. round half-even)
- Currency conversion with insufficient precision
- Database columns with insufficient decimal places

**Real-world consequences:**
- Pennies become dollars when multiplied across thousands of transactions
- Reconciliation failures
- "Inaccurate financial reporting due to rounding errors can affect decision-making, auditing, and regulatory compliance"
- Audit findings for financial statement errors

**Warning signs:**
- Out-of-balance conditions in reports
- Reconciliation discrepancies that are small but persistent
- Sum of line items doesn't match total
- Different rounding in different parts of system

**How to avoid:**
- Use DECIMAL(12,2) for money in database (not FLOAT)
- Round only at the transaction level, as late as possible
- Use consistent rounding rules (banker's rounding / round half-even)
- Store raw values, display rounded values
- Validate: sum of parts equals total
- "Perform the rounding at a transactional level, and as late in the process as possible"

**Phase to address:** Phase 1 - Database schema design - Must be correct from start

**Recovery if it happens:**
- Audit all financial calculations
- Add validation that sums equal totals
- Implement reconciliation reports

---

### HIGH: Double-Counting or Under-Counting Overhead

**What goes wrong:** "When calculating markup and estimating using a fully burdened labor rate, overhead can be added to the sales price twice--in the labor rate and in the markup--resulting in a price much higher than it should be."

**Why it happens:**
- Labor burden vs. overhead distinction not clearly defined
- Different people calculating different rates
- Rates copied from one context to another
- No single source of truth for burden/overhead rates
- "The key point is to account for your payroll taxes and benefits just once when you quote a job"

**Real-world consequences:**
- Overpricing leads to lost bids
- Underpricing leads to lost profit
- Inconsistent margins across jobs
- Unable to explain pricing to clients

**Warning signs:**
- Wide variance in bid success rates
- Margin percentage varies significantly by estimator
- Can't explain where overhead is captured
- Labor rates don't match market

**How to avoid:**
- Document clearly what's in labor burden vs. overhead
- Create a single burden rate calculation that's used everywhere
- Audit estimates for double-counting
- Compare burden + overhead to industry benchmarks
- "Accurately separating labor burden from overhead supports better job costing, more reliable bidding, and clearer financial reporting"

**Phase to address:** Phase 1 - Rate setup and documentation

**Recovery if it happens:**
- Complete burden/overhead audit
- Create burden rate documentation
- Implement validation in estimating

---

### HIGH: Retainage Calculation and Tracking Errors

**What goes wrong:** "More than half of construction companies struggle with manually tracking retainage amounts, with nearly a third reporting it takes 2-3 days to reconcile these figures."

**Common retainage errors:**
- Manual tracking in spreadsheets causes math errors
- Mismatched rates between owner contract and subcontracts
- Sliding-rate triggers missed (10% dropping to 5% at milestones)
- Partial releases not tracked by cost code
- Missing waivers or inspections delay release

**Real-world consequences:**
- "In as many as 30% of projects, stakeholders struggle to get retainage where it needs to go"
- Cash flow impact from delayed releases
- "Get it wrong and you could face legal issues, including property liens"
- Reconciliation nightmare at project close

**Warning signs:**
- Multiple spreadsheet versions (final_final.xlsx)
- Retainage amounts don't reconcile
- Surprise retainage at project completion
- Subcontractor complaints about late payments

**How to avoid:**
- Automate retainage calculation tied to draw amounts
- Build sliding-rate logic into system (milestones trigger rate changes)
- Track retainage by cost code for partial releases
- Integrate waiver tracking with retainage release
- "Modern construction payment software automates this whole process... Built-in checks stop overbilling and reduce errors"

**Phase to address:** Phase 2 - Draw/pay application enhancements

**Recovery if it happens:**
- Complete retainage reconciliation per project
- Implement automated G702/G703 with retainage
- Create retainage aging report

---

## 2. Technical Debt Patterns

### Database Schema Debt

**Pattern:** Starting with denormalized tables for speed, creating update anomalies and inconsistent data.

**What goes wrong:**
- Job totals stored redundantly and get out of sync
- Cost code changes require updates in multiple places
- Historical reports show different numbers than current state

**Prevention:**
- Normalize financial data from start (3NF minimum)
- Use computed/generated columns for derived values
- Implement database-level constraints for financial rules
- Create audit tables for all financial entities

### Integration Debt

**Pattern:** Manual data re-entry between systems instead of proper integration.

**What goes wrong:**
- "When teams manually re-key data between different systems, the risk of human error grows with every entry"
- QuickBooks payroll sync errors cause incorrect journal entries
- Inactive employees or missing data cause sync failures
- Company files over 1.5GB cause performance issues

**Prevention:**
- Design API-first for external integrations
- Implement retry logic with error queuing
- Create reconciliation reports for integrated data
- Log all integration transactions for audit

### Reporting Debt

**Pattern:** Building reports with direct SQL instead of a proper reporting layer.

**What goes wrong:**
- Report performance degrades as data grows
- Reports calculate things differently than screens
- No ability to run historical "as-of" reports
- Report changes require code deployments

**Prevention:**
- Create a data warehouse or reporting layer
- Pre-aggregate common report metrics
- Implement point-in-time reporting capability
- Document all report calculation logic

---

## 3. Performance Traps

### Large Dataset Performance

**What goes wrong:**
- "Large or complex sheets can impact performance"
- Reports timing out during month-end
- UI becomes unresponsive with many jobs/transactions
- Batch processes block user activity

**Industry examples:**
- "A manufacturing company's production analysis report often timed out. Moving the complex calculations to a scheduled job... reduced run time from 8+ minutes to 45 seconds"
- "A retail company's sales invoice posting took 25+ seconds because their inventory costing job was running exactly when the accounting team posted daily invoices"

**Warning signs:**
- Reports taking more than 10 seconds
- Users complaining about slowness at month-end
- Database CPU spikes during reports
- Timeouts during heavy processing

**Prevention strategies:**
- **Database indexing:** "A quick index addition cut screen load times by 80%"
- **Archive closed periods:** Move old data to archive tables
- **Schedule heavy jobs off-hours:** "Run heavy reports during off-hours... stagger jobs to avoid starting multiple resource-intensive tasks simultaneously"
- **Pre-aggregate reporting data:** Calculate summaries in background jobs
- **Pagination:** Never load unbounded datasets

**Phase to address:** Phase 3 - Before data grows large

---

### N+1 Query Patterns

**What goes wrong:**
- Loading job list triggers one query per job for related data
- Report generation makes thousands of individual queries
- Pages with many line items become unusable

**Prevention:**
- Use JOINs or include clauses for related data
- Batch load related entities
- Implement query logging to detect N+1 patterns
- Add performance testing to CI/CD

---

## 4. Security Mistakes (Financial Data)

### Audit Trail Gaps

**What goes wrong:**
- "Some accounting systems allow users to turn their audit trails on and off or delete transactions completely"
- Changes made without attribution
- Historical records altered without trace
- Compliance failures during audits

**Requirements for construction financial systems:**
- Every financial transaction logged with user, timestamp, old value, new value
- Audit logs immutable (append-only)
- Transaction deletion prevented or clearly flagged
- "Audit trail records can also help identify outside data breach issues. Malware and ransomware crimes are on the rise"

**Prevention:**
- Database triggers for audit logging
- Soft-delete only (never hard delete financial data)
- Separate audit database or table
- Regular audit log review
- "Best practices include... separating duties, restricting edits or deletions to the log"

### Access Control Issues

**What goes wrong:**
- PMs can see other PMs' job profitability
- Anyone can approve invoices
- Financial reports accessible to field staff
- No segregation of duties

**Prevention:**
- Role-based access control
- Job-level permissions (PM sees only their jobs)
- Approval hierarchies based on amount
- Segregation: person entering can't approve
- "Dashboard security can also be set by PMs so they only see their jobs"

### Data Export Risks

**What goes wrong:**
- Excel exports contain sensitive financial data
- No logging of who exported what
- Exports not encrypted

**Prevention:**
- Log all data exports
- Mark exported data with watermark/timestamp
- Limit export permissions
- Consider encryption for sensitive exports

---

## 5. UX Pitfalls (for Non-Accountant Users)

### Dashboard Overload

**What goes wrong:**
- Too many numbers overwhelm project managers
- Accounting terminology confuses non-financial users
- Critical issues buried in data noise

**Industry guidance:**
- "Concise Layout: An effective dashboard should present critical information in one or two pages to avoid overwhelming users"
- "The goal of a construction project dashboard is to provide a quick, easily digestible overview"

**Prevention:**
- Role-specific dashboards (PM dashboard vs. Controller dashboard)
- Progressive disclosure (summary first, detail on demand)
- Use visual indicators (red/yellow/green) not just numbers
- Define "what do I need to know?" for each role
- "Self-service analytics for superintendents, PMs, and executives"

### Jargon Confusion

**What goes wrong:**
- PMs don't understand "WIP adjustment" or "over/under billing"
- Field staff can't interpret cost variance reports
- Training required for basic screens

**Prevention:**
- Use plain language with tooltips for technical terms
- Show examples, not just definitions
- Test with actual PMs before release
- Create quick-reference cards for key concepts

### Data Entry Friction

**What goes wrong:**
- "Many budgets exist only as spreadsheets created from an initial estimate. Once the job starts, actual bills and payments drift away"
- System requires too many clicks for common tasks
- Mobile entry is clunky or impossible
- Users enter data in spreadsheets, batch enter summaries

**Warning signs:**
- Low data completeness rates
- Spreadsheets alongside the system
- Complaints about data entry time
- "Getting proof of expenses from project managers can be a struggle"

**Prevention:**
- Design for 3-click common operations
- Mobile-first for field data entry
- Allow photo capture of receipts
- Batch import from spreadsheets
- "Since manual data entry errors are one of the most common mistakes in WIP reports, it stands to reason that automating data entry will result in more accurate (and faster) reports"

---

## 6. "Looks Done But Isn't" Checklist

These are features that pass acceptance testing but fail in production:

### Cost Code Structure
- [ ] Can handle reclassification (move cost from one code to another) with audit trail
- [ ] Supports inactive cost codes (no new transactions, but history preserved)
- [ ] Handles cost code hierarchy for roll-up reporting
- [ ] Prevents deletion of cost codes with transactions

### Job Costing
- [ ] Tracks committed costs (POs) separately from actual costs
- [ ] Handles negative costs (credits, returns) correctly
- [ ] Supports cost transfers between jobs with audit trail
- [ ] Correctly calculates % complete for over-budget jobs (can be >100%)

### Overhead Allocation
- [ ] Handles partial periods (new employee mid-month)
- [ ] Adjusts for paid time off (hours worked vs. hours paid)
- [ ] Recalculates when base hours are corrected
- [ ] Provides variance analysis (expected vs. applied overhead)

### Period Close
- [ ] Prevents backdating transactions into closed periods
- [ ] Handles adjusting entries that span periods
- [ ] Provides "as-of" reporting (see data as it was at close)
- [ ] Supports soft-close (review) vs. hard-close (final)

### Retainage
- [ ] Handles different retainage rates for different cost types
- [ ] Supports milestone-based retainage reduction
- [ ] Tracks released vs. unreleased retainage
- [ ] Integrates with draw/pay application workflow

### Reconciliation
- [ ] Job cost ledger totals match GL work-in-progress
- [ ] Open payables by job matches AP subledger
- [ ] Billed amounts match accounts receivable
- [ ] Retainage accounts reconcile to project-level tracking

### Change Orders
- [ ] Revenue changes update cost estimates automatically (or require manual update)
- [ ] Tracks original contract vs. current contract value
- [ ] Links change order costs to specific change orders
- [ ] Prevents billing change order work before approval

### Multi-Currency/Tax (if applicable)
- [ ] Handles different tax jurisdictions by job location
- [ ] Tracks exchange rates for material purchases
- [ ] Separates taxable vs. non-taxable labor

---

## 7. Pitfall-to-Phase Mapping

| Pitfall | Severity | Phase to Address | Mitigation Focus |
|---------|----------|------------------|------------------|
| Overhead allocation method | Critical | Phase 1 | Labor-hours based allocation |
| Labor burden calculation | Critical | Phase 1 | Comprehensive burden rate setup |
| Decimal precision | High | Phase 1 | DECIMAL types, late rounding |
| Double-counting overhead | High | Phase 1 | Clear burden vs overhead split |
| WIP accounting errors | Critical | Phase 2 | Monthly reconciliation process |
| Period close timing | Critical | Phase 2 | Cutoff enforcement, accruals |
| Retainage tracking | High | Phase 2 | Automated calculation |
| Audit trail gaps | High | Phase 2 | Database triggers, immutable logs |
| Large dataset performance | Medium | Phase 3 | Indexing, archiving, caching |
| Dashboard UX | Medium | Phase 3 | Role-specific views |
| Integration errors | Medium | Phase 3 | Reconciliation reports |
| Report performance | Medium | Phase 3 | Pre-aggregation, scheduling |

### Phase 1 - Foundation (Must Get Right)
1. DECIMAL(12,2) for all money fields
2. Labor burden rate calculation and storage
3. Overhead allocation by labor hours (not cost %)
4. Clear separation of burden vs. overhead
5. Audit trigger for all financial tables
6. Cost code structure with hierarchy support

### Phase 2 - Period Operations
1. WIP calculation and reconciliation
2. Period close with soft/hard close
3. Retainage tracking per draw
4. Cutoff date enforcement
5. Adjusting entry handling
6. GL-to-job-cost reconciliation reports

### Phase 3 - Scale & Polish
1. Performance optimization (indexes, archives)
2. Role-specific dashboards
3. External system integration
4. Advanced reporting (as-of, variance analysis)
5. Mobile-friendly data entry
6. Batch operations for period-end

---

## Sources

### Overhead Allocation
- [Construction Overhead Allocation Methods Explained - Foundation Software](https://www.foundationsoft.com/learn/overhead-allocation-methods/)
- [How to Allocate Overhead to Projects - For Construction Pros](https://www.forconstructionpros.com/profit-matters/article/10632193/how-to-allocate-overhead-to-projects)
- [The Hidden Truth About Overhead Allocation - K38 Consulting](https://www.k38consulting.com/the-hidden-truth-about-overhead-allocation/)
- [Overhead Cost Allocation in Construction - Deltek](https://www.deltek.com/en/construction/accounting/job-costing/overhead-cost)

### Labor Burden
- [How to Determine Your Fully Burdened Labor Rate - Procore](https://www.procore.com/library/fully-burdened-labor-rate)
- [Construction Labor Burden Calculation - eBacon](https://www.ebacon.com/construction/construction-labor-burden-calculation-the-complete-formula/)
- [Construction Labor Burden Explained - Autodesk](https://www.autodesk.com/blogs/construction/construction-labor-burden-explained/)
- [Labor Burden: Definition, Costs, Examples - Construction Coverage](https://constructioncoverage.com/business/labor-burden)

### WIP and Period Close
- [5 Common Mistakes in Construction WIP Accounting - Siteline](https://www.siteline.com/blog/5-common-mistakes-in-construction-wip-accounting-and-how-to-avoid-them)
- [Construction WIP Accounting: Five Common Mistakes - BerryDunn](https://www.berrydunn.com/news-detail/construction-wip-accounting-five-common-mistakes)
- [Common WIP Schedule Mistakes - Dean Dorton](https://deandorton.com/common-wip-schedule-mistakes/)
- [How to Maintain and Review a WIP Schedule - Cray Kaiser](https://craykaiser.com/how-to-maintain-and-review-a-work-in-progress-schedule/)

### Decimal Precision
- [Handling Precision in Financial Calculations - Medium](https://medium.com/@stanislavbabenko/handling-precision-in-financial-calculations-in-net-a-deep-dive-into-decimal-and-common-pitfalls-1211cc5edd3b)
- [Minimizing Rounding Errors in Financial Reporting - Accounting Insights](https://accountinginsights.org/minimizing-rounding-errors-in-financial-reporting/)
- [Rounding for Accounting Accuracy - SYSPRO](https://www.syspro.com/blog/applying-and-operating-erp/rounding-for-accounting-accuracy/)

### Job Cost Reconciliation
- [QuickBooks Job Costing Accuracy - Procuredesk](https://www.procuredesk.com/quickbooks-job-costing-accuracy-construction/)
- [Understanding and Reconciling Job Cost - D Miller Associates](https://www.dmillerassociates.com/2023/09/18/understanding-and-reconciling-job-cost/)
- [Solving Common Job Costing Issues - SVA Consulting](https://accountants.sva.com/biz-tips/solving-common-job-costing-issues-for-construction-companies)

### Retainage
- [Understanding and Preventing Retainage Account Errors - GCPay](https://ww3.gcpay.com/blog/why-retainage-account-errors-keep-happening-in-construction/)
- [Retainage in Construction - NetSuite](https://www.netsuite.com/portal/resource/articles/accounting/retainage.shtml)
- [Construction Retainage 101 - CrewCost](https://crewcost.com/blog/construction-retainage-101-ultimate-guide/)

### Security and Audit
- [Audit Trails & Date Sensitivity - Foundation Software](https://www.foundationsoft.com/learn/audit-trails-date-sensitivity/)
- [Audit Trails: Strengthening Compliance - DocuWare](https://start.docuware.com/blog/document-management/audit-trails)

### Performance
- [Improve Speed and Efficiency in Business Central - BCN](https://www.businesscentralnav.com/blog/optimizing-performance-business-central)
- [Construction Data Management Hidden Costs - Premier Construction](https://premiercs.com/blog/construction-data-management-hidden-costs-your-team-might-be-missing)

### UX and Dashboards
- [Executive Dashboard Software - Foundation Software](https://www.foundationsoft.com/software/executive-dashboard/)
- [Construction Dashboard Software - Anterra](https://anterratech.com/modules/dashboards/)
- [Construction Project Dashboard - ProjectManager](https://www.projectmanager.com/blog/construction-project-dashboard)

### Technical Debt and ERP Failures
- [ERP Integration Challenges: Hidden Costs of Technical Debt - All Consulting Firms](https://www.allconsultingfirms.com/blog/erp-integration-challenges-hidden-costs-of-technical-debt/)
- [5 Lessons Learned from Failed ERP Implementations - CLA](https://godigital.claconnect.com/insights/article/5-lessons-learned-from-failed-erp-implementations/)
- [Five Ways Construction Companies Can Avoid Technical Debt - Project Times](https://www.projecttimes.com/articles/five-ways-construction-companies-can-avoid-technical-debt/)
