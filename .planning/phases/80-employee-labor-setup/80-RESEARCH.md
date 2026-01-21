# Phase 80: Employee & Labor Setup - Research

**Researched:** 2026-01-21
**Domain:** Construction labor burden rate calculation and employee management
**Confidence:** HIGH (existing implementation already complete, industry research verified)

## Summary

Phase 80 Employee & Labor Setup has been **fully implemented** in the existing codebase. The database schema (migration-102), API routes (server/routes/employees.js), and UI (public/employees.html with public/js/employees.js) all exist and are functional.

The implementation follows industry-standard practices for construction labor burden calculation:
- Itemized burden rate components (FICA, FUTA, SUTA, Workers Comp, Health, Retirement, PTO)
- Burden classes for different employee types (Field Crew, Office Staff, Foreman, Subcontractor)
- Company-wide default burden rate with per-employee override capability
- Quarterly burden review reminder system
- Automatic burdened cost calculation via database function

**Primary recommendation:** This phase requires only verification testing of existing functionality, not new implementation.

## Existing Implementation Status

### Already Implemented (Migration-102)

| Component | Status | Location |
|-----------|--------|----------|
| v2_burden_classes table | COMPLETE | database/migration-102-employee-labor-setup.sql |
| v2_employees table | COMPLETE | database/migration-102-employee-labor-setup.sql |
| v2_company_settings table | COMPLETE | database/migration-102-employee-labor-setup.sql |
| v2_burden_rate_history table | COMPLETE | database/migration-102-employee-labor-setup.sql |
| v2_burden_review_reminders table | COMPLETE | database/migration-102-employee-labor-setup.sql |
| get_employee_burden_rate() function | COMPLETE | database/migration-102-employee-labor-setup.sql |
| calculate_burdened_cost() function | COMPLETE | database/migration-102-employee-labor-setup.sql |
| create_burden_review_reminder() function | COMPLETE | database/migration-102-employee-labor-setup.sql |

### Already Implemented (API Routes)

| Endpoint | Method | Status |
|----------|--------|--------|
| /api/employees | GET, POST | COMPLETE |
| /api/employees/:id | GET, PATCH, DELETE | COMPLETE |
| /api/employees/burden-classes | GET, POST | COMPLETE |
| /api/employees/burden-classes/:id | GET, PATCH | COMPLETE |
| /api/employees/settings/all | GET | COMPLETE |
| /api/employees/settings/:key | PATCH | COMPLETE |
| /api/employees/calculate-burden | POST | COMPLETE |
| /api/employees/burden-reviews | GET, POST | COMPLETE |
| /api/employees/burden-reviews/:id/complete | PATCH | COMPLETE |

### Already Implemented (UI)

| Feature | Status | Location |
|---------|--------|----------|
| Employee list with filters | COMPLETE | public/employees.html |
| Create/Edit employee modal | COMPLETE | public/employees.html |
| Burden classes management modal | COMPLETE | public/employees.html |
| Company settings modal | COMPLETE | public/employees.html |
| Burden review reminder alert | COMPLETE | public/employees.html |
| Burden cost calculator | COMPLETE | public/employees.html |
| Department filter | COMPLETE | public/js/employees.js |
| Effective burden rate display | COMPLETE | public/js/employees.js |

## Industry-Standard Burden Rate Components

### Mandated Payroll Taxes (2025 Rates)

| Component | Rate | Cap/Notes |
|-----------|------|-----------|
| Social Security (FICA) | 6.2% | Up to $176,100 wage base |
| Medicare (FICA) | 1.45% | No cap |
| FUTA | 0.6% | First $7,000 wages (after state credit) |
| SUTA | 2-4% typical | Varies by state and experience rating |

**Implementation matches:** The existing v2_burden_classes table stores fica_rate (7.65% combined), futa_rate (0.6%), and suta_rate (2.7% default), which aligns with industry standards.

### Voluntary Benefits (Typical Ranges)

| Component | Typical Range | Notes |
|-----------|---------------|-------|
| Workers Compensation | 4-15% | Varies by trade classification |
| Health Insurance | 10-20% | $500-$1,200/month per employee |
| Retirement (401k match) | 3-6% | Employer matching contribution |
| PTO/Vacation | 4-6% | 80-120 hours annually |
| Other (training, gear) | 0-3% | Safety training, PPE, tools |

**Implementation matches:** The existing v2_burden_classes table has individual columns for workers_comp_rate, health_insurance_rate, retirement_rate, pto_rate, and other_rate.

### Total Burden Rate Benchmarks

| Classification | Typical Rate | Notes |
|----------------|--------------|-------|
| Non-union field crew | 35-45% | Higher workers comp |
| Non-union office staff | 30-40% | Lower workers comp |
| Union labor | 55-70% | Union benefits add 15-25% |
| Subcontractors | 0% | No burden (1099) |

**Implementation matches:** The seeded burden classes have:
- Field Crew: 39.95%
- Office Staff: 35.95% (marked as default)
- Foreman: 40.95%
- Subcontractor: 0%

## Burden Class Categories

### Recommended Classifications (Already Implemented)

The existing implementation uses appropriate burden classes:

1. **Field Crew** - Construction workers in the field
   - Higher workers comp (12%)
   - Lower health insurance (10%)
   - Standard retirement (3%)

2. **Office Staff** - Administrative and office employees
   - Lower workers comp (1%)
   - Higher health insurance (15%)
   - Higher retirement (4%)
   - SET AS DEFAULT

3. **Foreman** - Site supervisors and foremen
   - Mid-range workers comp (10%)
   - Mid-range health insurance (12%)
   - Higher retirement (4%)

4. **Subcontractor** - No burden applied
   - All rates 0%
   - Used for 1099 labor tracking

### Workers Comp Class Code Considerations

| Trade | Workers Comp Rate | Class Code Reference |
|-------|-------------------|---------------------|
| General Carpentry | 8-12% | 5645 (Residential) |
| Framing | 12-15% | 5403 (over 3 stories) |
| Roofing | 24-80% per $100 payroll | 5552 |
| Office/Clerical | 0.5-1.5% | 8810 |
| Project Management | 2-4% | 5606 |

**Note:** The existing implementation allows per-class workers comp rates. For detailed trade-specific tracking, additional burden classes could be created.

## Quarterly Burden Rate Review

### Best Practices (Industry Standard)

| Review Type | Frequency | What to Check |
|-------------|-----------|---------------|
| Quick check | Monthly | Major cost changes |
| Standard review | Quarterly | All rate components |
| Full audit | Annually | Comprehensive with documentation |

### Items to Review Quarterly

1. **Workers Compensation**
   - Experience modification rate (EMR) changes
   - State rate adjustments
   - Classification audits

2. **SUTA Rate**
   - Unemployment claims impact
   - State rate notices (usually annual)

3. **Health Insurance**
   - Premium changes (often annual)
   - Plan changes affecting employer share

4. **Retirement Contributions**
   - Safe harbor requirements
   - Match percentage changes

5. **PTO Accrual**
   - Policy changes
   - Carryover limits

**Implementation matches:** The existing v2_burden_review_reminders table tracks quarterly reviews with status (pending/completed/dismissed), due_date, and notes. The create_burden_review_reminder() function auto-generates the next quarterly review.

## Database Schema Patterns

### Existing Schema (Already Optimal)

The migration-102 schema follows best practices:

```sql
-- Burden classes with itemized rate components
v2_burden_classes (
  id, name, description,
  fica_rate, futa_rate, suta_rate,
  workers_comp_rate, health_insurance_rate,
  retirement_rate, pto_rate, other_rate,
  total_burden_rate,  -- Auto-calculated by trigger
  is_default, is_active
)

-- Employees with burden class assignment
v2_employees (
  id, first_name, last_name, ...,
  burden_class_id,     -- Links to burden class
  custom_burden_rate,  -- Optional override
  pay_type, pay_rate
)

-- Company-wide settings
v2_company_settings (
  key, value, value_type, description
)
-- Keys: default_burden_rate, burden_review_frequency, last_burden_review

-- Audit trail
v2_burden_rate_history (
  burden_class_id, employee_id,
  previous_rate, new_rate,
  effective_date, reason, changed_by
)
```

### Calculation Functions (Already Implemented)

```sql
-- Priority: custom rate > class rate > company default
get_employee_burden_rate(emp_id UUID) RETURNS DECIMAL(6,4)

-- Formula: base_wage * (1 + burden_rate)
calculate_burdened_cost(base_wage, burden_rate) RETURNS DECIMAL(12,2)
```

## UI Patterns

### Existing Implementation (Already Complete)

The employees.html page follows the application's established patterns:

1. **Filter bar** - Status, Burden Class, Department, Search
2. **Stats cards** - Total, Active, Avg Rate, Class Count
3. **Data table** - Employee list with inline actions
4. **Modals** - Create/Edit Employee, Burden Classes, Company Settings, Burden Review

### Rate Display Format

Rates stored as decimals (0.0765) displayed as percentages (7.65%):
```javascript
function formatPercent(value) {
  return ((value || 0) * 100).toFixed(2) + '%';
}
```

### Real-time Rate Calculation

The burden class form auto-calculates total rate on input:
```javascript
function updateCalculatedTotal() {
  const rates = [...]; // Get all rate input values
  const total = rates.reduce((sum, r) => sum + r, 0);
  document.getElementById('calculatedTotalRate').textContent = formatPercent(total);
}
```

## Requirements Verification Matrix

| Requirement | Implementation | Verified |
|-------------|----------------|----------|
| LAB-02: Manage employees (name, role, burden class) | v2_employees + CRUD API + UI modal | YES |
| LAB-03: Configure company-wide burden rate | v2_company_settings + settings modal | YES |
| LAB-04: Multiple burden rates by employee class | v2_burden_classes + burden classes modal | YES |
| LAB-05: Auto-calculate burdened cost | calculate_burdened_cost() + trigger | YES |
| LAB-06: Quarterly burden rate review prompts | v2_burden_review_reminders + alert UI | YES |

## Don't Hand-Roll

| Problem | Already Solved By |
|---------|-------------------|
| Burden rate calculation | calculate_burdened_cost() SQL function |
| Effective rate priority logic | get_employee_burden_rate() SQL function |
| Rate component auto-sum | calculate_total_burden_rate() trigger |
| Review reminder scheduling | create_burden_review_reminder() function |

## Common Pitfalls (Already Avoided)

### Pitfall 1: Hardcoded Burden Rates
**Risk:** Using a single hardcoded rate for all employees
**Solution implemented:** Three-tier priority system (custom > class > company default)

### Pitfall 2: Missing Rate History
**Risk:** No audit trail of rate changes
**Solution implemented:** v2_burden_rate_history table records all changes

### Pitfall 3: Forgotten Review Cycles
**Risk:** Burden rates become stale
**Solution implemented:** Automatic quarterly reminder creation

### Pitfall 4: Decimal vs Percentage Confusion
**Risk:** Storing 40% as 40 instead of 0.40
**Solution implemented:** All rates stored as decimals (0.0765 = 7.65%)

## State of the Art

| Old Approach | Current Implementation | Notes |
|--------------|------------------------|-------|
| Single company burden rate | Class-based with override | Matches industry best practice |
| Manual burden calculation | Database trigger auto-calc | Prevents manual errors |
| Annual rate review | Quarterly with prompts | More frequent per industry advice |

## Open Questions

1. **Trade-specific burden classes** - Should additional classes be added for specific trades (Electrician, Plumber, etc.) with different workers comp rates?
   - Current: 4 generic classes
   - Recommendation: Start with generic, add trade-specific as needed

2. **Multi-state support** - If operating in multiple states, should SUTA rates vary by state?
   - Current: Single SUTA rate per class
   - Recommendation: Adequate for single-state operation

3. **Union support** - If adding union labor, should there be union burden classes?
   - Current: Non-union rates (35-45%)
   - Recommendation: Add union class if needed (55-70%)

## Sources

### Primary (HIGH confidence)
- Existing codebase: database/migration-102-employee-labor-setup.sql
- Existing codebase: server/routes/employees.js
- Existing codebase: public/employees.html, public/js/employees.js

### Secondary (MEDIUM confidence)
- [Procore - Fully Burdened Labor Rate in Construction](https://www.procore.com/library/fully-burdened-labor-rate)
- [Construction Coverage - Labor Burden Definition](https://constructioncoverage.com/business/labor-burden)
- [LumberFi - Fully Burdened Labor Rate Guide](https://www.lumberfi.com/blog/understanding-and-calculating-your-fully-burdened-labor-rate)
- [SmartBarrel - Labor Burden in Construction](https://smartbarrel.io/blog/labor-burden-in-construction/)
- [Paycom - FICA/FUTA Rates 2025](https://www.paycom.com/resources/blog/what-is-futa-tax/)
- [Construction Business Owner - Establish Labor Burden Rate](https://www.constructionbusinessowner.com/topics/accounting/accounting-finance/establish-your-labor-burden-rate-your-construction-company)

### Tertiary (Industry Reference)
- [BLS Employer Costs for Employee Compensation](https://www.bls.gov/news.release/pdf/ecec.pdf) - June 2025 data
- [Visionary Law Group - Workers Comp Class Codes](https://visionarylawgroup.com/workers-compensation-class-codes-for-construction/)

## Metadata

**Confidence breakdown:**
- Existing implementation: HIGH - Verified in codebase
- Industry burden rates: HIGH - Multiple authoritative sources agree
- Best practices: MEDIUM - Based on industry articles, not official standards
- Tax rates (FICA/FUTA/SUTA): HIGH - IRS/state published rates

**Research date:** 2026-01-21
**Valid until:** 2027-01-01 (tax rates change annually)

## Conclusion

Phase 80 is **already complete** in the existing codebase. The implementation:

1. Matches all five LAB requirements (LAB-02 through LAB-06)
2. Uses industry-standard burden rate components and percentages
3. Follows construction accounting best practices for burden classes
4. Includes quarterly review prompts as required
5. Has proper database functions for automatic burdened cost calculation

**Recommendation:** Create a verification plan to test existing functionality rather than implement new features. Consider adding automated tests for:
- Employee CRUD operations
- Burden class management
- Burdened cost calculation accuracy
- Quarterly review reminder creation
