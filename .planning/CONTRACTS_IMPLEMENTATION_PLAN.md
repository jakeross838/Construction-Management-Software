# Contracts Implementation Plan

## Executive Summary

This plan outlines a comprehensive contracts management system for Ross Built Custom Homes, integrating the provided Construction Agreement and Pre-Construction Agreement templates with the existing software infrastructure. The system will support contract creation, template management, variable substitution, e-signatures, and deep integration with existing modules (Leads, Estimates, Change Orders, Draws, Lien Releases, Budget).

---

## 1. Existing Infrastructure Analysis

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| **Contract Types** | ✅ Ready | `useContracts.ts` - supports prime, subcontract, proposal, change_order, amendment, etc. |
| **Contract CRUD** | ✅ Ready | Create, Read, Update, Delete operations |
| **Signature System** | ✅ Ready | `useSignatures.ts` - full e-signature with multiple signers, drawn/typed/uploaded signatures, audit trail |
| **Signature Providers** | ✅ Ready | Supports DocuSign, HelloSign, and internal signing |
| **Change Orders** | ✅ Ready | `ChangeOrders.tsx` - with approval workflow, markup calculations |
| **Draws** | ✅ Ready | `Draws.tsx` - G702/G703 payment applications |
| **Lien Releases** | ✅ Ready | `LienReleases.tsx` - conditional/unconditional releases |
| **Estimates** | ✅ Ready | Full estimate builder with cost codes, markups, submit/approve workflow |
| **Budget** | ✅ Ready | Budget tracking with cost codes, committed vs actual |
| **Leads Pipeline** | ✅ Ready | Full sales funnel with stages |

### What Needs To Be Built

| Component | Priority | Description |
|-----------|----------|-------------|
| **Contract Templates DB** | High | Store contract templates with variable placeholders |
| **Contract Builder UI** | High | Visual editor for creating contracts from templates |
| **Variable Substitution Engine** | High | Replace placeholders with job/client data |
| **Contract Clauses Library** | Medium | Reusable clause management |
| **Pre-Construction Agreement Flow** | High | Lead → PreCon Agreement → Construction Agreement |
| **Contract → Job Conversion** | High | Convert signed contract to active job |
| **PDF Generation** | High | Generate professional PDFs from contracts |
| **Florida Lien Law Disclosure** | High | Required pre-signing disclosure |
| **Contract Amendment Workflow** | Medium | Manage contract modifications |

---

## 2. Contract Terms → System Feature Mapping

### From Construction Agreement Template

| Contract Article | System Feature | Integration Notes |
|------------------|----------------|-------------------|
| **Article 1: Work Description** | `jobs.description`, `jobs.address` | Auto-populated from job record |
| **Article 2: Schedule** | `Schedule.tsx`, `schedule_tasks` | Link to project schedule, delay tracking |
| **Article 3: Contract Price (Cost Plus)** | `Estimates`, `Budget` | Fee percentage, GMP if applicable |
| **Article 4: Payment** | `Draws.tsx`, `Invoices` | Draw schedule, retainage terms |
| **Article 5: Change Order Formula** | `ChangeOrders.tsx` | **Cost + Fee + Supervision Adjustment** |
| **Article 6: Changes in Work** | `ChangeOrders.tsx` | Approval workflow, pricing tiers |
| **Article 7: Allowances** | `Budget` (allowance line items) | Track allowance spending |
| **Article 8: Owner's Duties** | Client Portal communications | Access requirements, decision deadlines |
| **Article 9: Owner Interference** | `DailyLogs.tsx` | Document delays, stoppage claims |
| **Article 10: Default/Termination** | Contract status management | Cure periods, termination workflow |
| **Article 11: Warranty** | `Warranties.tsx` | 1-year workmanship warranty tracking |
| **Article 12: Insurance** | Settings/Company profile | Insurance requirements reference |
| **Florida Lien Law Disclosure** | **NEW: Pre-signing disclosure** | Required before contract signing |

### From Pre-Construction Agreement Template

| Agreement Section | System Feature | Integration Notes |
|-------------------|----------------|-------------------|
| **Scope of Services** | Lead notes, activities | Site visits, coordination, budgeting |
| **Fee Structure** | Lead estimated value | Hourly rates, flat fees, deposits |
| **Design/Engineering** | `Files.tsx` (documents) | Plan management, revision tracking |
| **Permits** | `Permits.tsx` | Permit tracking, fee allocation |
| **Timeline** | Lead stage dates | Pre-construction milestones |
| **Transition to Construction** | Lead → Job conversion | PreCon → Construction Contract flow |

### From Analysis & Recommendations

| New Provision | Implementation |
|---------------|----------------|
| **Indemnification (Article 13)** | Contract clause library - standard protective language |
| **Limitation of Liability (Article 14)** | Contract variables: `{{CONTRACT_PRICE}}` cap |
| **Right to Stop Work (Article 15)** | Workflow trigger on payment default |
| **Hazardous Materials (Article 16)** | Contract clause - owner responsibility |
| **Waiver of Subrogation (Article 17)** | Insurance clause library |
| **Mechanic's Lien Rights (Article 18)** | Link to `LienReleases.tsx` |
| **Enhanced Force Majeure** | Clause library with notification requirements |
| **Mediation → Arbitration** | Dispute resolution clause options |

---

## 3. Database Schema Additions

### `contract_templates` Table
```sql
CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES builders(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) NOT NULL, -- 'preconstruction', 'construction', 'subcontract', 'amendment'
  content TEXT NOT NULL, -- Rich text with {{VARIABLE}} placeholders
  variables JSONB DEFAULT '[]', -- [{name: "CLIENT_NAME", label: "Client Name", source: "client.name"}]
  clauses JSONB DEFAULT '[]', -- Array of clause IDs included
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `contract_clauses` Table
```sql
CREATE TABLE contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES builders(id),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100), -- 'indemnification', 'payment', 'warranty', 'termination', etc.
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_required BOOLEAN DEFAULT false, -- Must be included in all contracts
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `contract_documents` Table (Generated Contracts)
```sql
CREATE TABLE contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  template_id UUID REFERENCES contract_templates(id),
  version INTEGER DEFAULT 1,
  content TEXT NOT NULL, -- Rendered content with variables replaced
  variables_snapshot JSONB, -- Values used for variable substitution
  pdf_url TEXT,
  signed_pdf_url TEXT,
  signature_request_id UUID REFERENCES signature_requests(id),
  florida_lien_disclosure_signed_at TIMESTAMPTZ, -- Required for FL
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `contract_pricing_terms` Table
```sql
CREATE TABLE contract_pricing_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id),
  pricing_type VARCHAR(50) NOT NULL, -- 'cost_plus_fixed_fee', 'cost_plus_percentage', 'fixed_price', 'gmp'
  base_fee_amount DECIMAL(12,2),
  fee_percentage DECIMAL(5,2),
  gmp_amount DECIMAL(12,2),
  retainage_percent DECIMAL(5,2) DEFAULT 10,
  supervision_monthly_rate DECIMAL(12,2),
  change_order_markup_percent DECIMAL(5,2) DEFAULT 15, -- For changes under threshold
  change_order_markup_percent_large DECIMAL(5,2) DEFAULT 10, -- For changes over threshold
  change_order_threshold DECIMAL(12,2) DEFAULT 10000, -- Threshold for markup tier
  payment_terms_days INTEGER DEFAULT 10,
  draw_frequency VARCHAR(50) DEFAULT 'monthly', -- 'monthly', 'milestone', 'weekly'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Variable Substitution System

### Standard Variables

| Variable | Source | Example |
|----------|--------|---------|
| `{{CLIENT_NAME}}` | `clients.name` or `leads.first_name + last_name` | "John & Jane Smith" |
| `{{CLIENT_ADDRESS}}` | `clients.address` | "123 Main St, Tampa, FL" |
| `{{CLIENT_EMAIL}}` | `clients.email` | "jsmith@email.com" |
| `{{CLIENT_PHONE}}` | `clients.phone` | "(813) 555-1234" |
| `{{PROJECT_ADDRESS}}` | `jobs.address` or `leads.project_address` | "456 Oak Lane, Tampa, FL" |
| `{{PROJECT_DESCRIPTION}}` | `jobs.description` | "Custom 4BR/3BA home" |
| `{{CONTRACT_DATE}}` | `contracts.execution_date` | "February 3, 2026" |
| `{{CONTRACT_AMOUNT}}` | `contracts.contract_amount` | "$1,250,000.00" |
| `{{FEE_AMOUNT}}` | `contract_pricing_terms.base_fee_amount` | "$125,000.00" |
| `{{FEE_PERCENTAGE}}` | `contract_pricing_terms.fee_percentage` | "10%" |
| `{{GMP_AMOUNT}}` | `contract_pricing_terms.gmp_amount` | "$1,375,000.00" |
| `{{RETAINAGE_PERCENT}}` | `contract_pricing_terms.retainage_percent` | "10%" |
| `{{BUILDER_NAME}}` | Company settings | "Ross Built, LLC" |
| `{{BUILDER_ADDRESS}}` | Company settings | "789 Builder Blvd, Tampa, FL" |
| `{{BUILDER_LICENSE}}` | Company settings | "CGC123456" |
| `{{ESTIMATED_START_DATE}}` | `jobs.start_date` | "March 1, 2026" |
| `{{ESTIMATED_COMPLETION_DATE}}` | `jobs.target_completion` | "March 1, 2027" |
| `{{SQUARE_FOOTAGE}}` | `jobs.square_footage` or `leads.square_footage` | "3,500 SF" |

### Computed Variables

| Variable | Formula | Description |
|----------|---------|-------------|
| `{{SUPERVISION_ADJUSTMENT}}` | Fee ÷ Original Months × Extension Months | Per Article 6 change order formula |
| `{{CHANGE_ORDER_TOTAL}}` | Cost + (Cost × Markup%) + Supervision Adj | Full CO pricing |
| `{{WARRANTY_EXPIRATION}}` | Substantial Completion + 1 Year | Warranty end date |

---

## 5. Workflow Implementation

### 5.1 Lead → Pre-Construction Agreement Flow

```
┌─────────────────┐
│   NEW LEAD      │
│ (new_inquiry)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ INITIAL CONTACT │
│ Site visit,     │
│ scope discussion│
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌────────────────────────┐
│ PRECON STAGE    │────▶│ Generate PreCon        │
│                 │     │ Agreement from Template │
└────────┬────────┘     └────────────┬───────────┘
         │                           │
         │              ┌────────────▼───────────┐
         │              │ Send for E-Signature   │
         │              │ (Florida Lien Disc +   │
         │              │  PreCon Agreement)     │
         │              └────────────┬───────────┘
         │                           │
         │              ┌────────────▼───────────┐
         │              │ Collect Deposit        │
         │              │ Record in system       │
         │              └────────────────────────┘
         │
         ▼
┌─────────────────┐
│ DESIGN/ENGR     │
│ Plan review,    │
│ value engineering│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ESTIMATE STAGE  │
│ Create detailed │
│ estimate        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌────────────────────────┐
│ CONTRACT NEG    │────▶│ Generate Construction  │
│                 │     │ Agreement from Template │
└────────┬────────┘     └────────────┬───────────┘
         │                           │
         │              ┌────────────▼───────────┐
         │              │ Send for E-Signature   │
         │              │ (Florida Lien Disc +   │
         │              │  Construction Contract) │
         │              └────────────┬───────────┘
         │                           │
         ▼              ┌────────────▼───────────┐
┌─────────────────┐     │ CONVERT TO JOB         │
│     WON         │◀────│ - Create job record    │
│                 │     │ - Copy estimate to     │
└─────────────────┘     │   budget               │
                        │ - Set up schedule      │
                        │ - Activate contract    │
                        └────────────────────────┘
```

### 5.2 Contract Creation Workflow

1. **Select Template**: Choose from PreConstruction, Construction, Subcontract, Amendment
2. **Select Source**: Link to Lead or Job
3. **Auto-populate Variables**: System fills in known values
4. **Review & Customize**: User edits content, selects optional clauses
5. **Add Attachments**: Exhibits (plans, specs, estimate summary)
6. **Preview PDF**: Generate preview document
7. **Florida Lien Disclosure**: Display required disclosure (must acknowledge before signing)
8. **Send for Signature**: Create signature request with signer order
9. **Track Status**: Monitor signing progress, send reminders
10. **Completion**: Store signed PDF, update contract status

### 5.3 Change Order Formula Implementation

From Article 6 of the Construction Agreement:

```
Change Order Price = Direct Cost + Fee Component + Supervision Adjustment

Where:
- Direct Cost = Labor + Materials + Equipment + Subcontractor costs
- Fee Component = Direct Cost × Markup Percentage
  - If change < $10,000: 15% markup
  - If change ≥ $10,000: 10% markup
- Supervision Adjustment = (Monthly Fee ÷ Original Months) × Schedule Extension Months
```

**Implementation in `ChangeOrders.tsx`:**

```typescript
interface ChangeOrderPricing {
  direct_cost: number;
  markup_percent: number; // Auto-calculated based on threshold
  markup_amount: number;
  days_impact: number;
  supervision_adjustment: number; // Calculated from contract terms
  total_amount: number;
}

function calculateChangeOrderTotal(
  directCost: number,
  daysImpact: number,
  contractTerms: ContractPricingTerms
): ChangeOrderPricing {
  // Determine markup tier
  const markupPercent = directCost >= (contractTerms.change_order_threshold || 10000)
    ? (contractTerms.change_order_markup_percent_large || 10)
    : (contractTerms.change_order_markup_percent || 15);

  const markupAmount = directCost * (markupPercent / 100);

  // Calculate supervision adjustment if schedule extends
  let supervisionAdjustment = 0;
  if (daysImpact > 0 && contractTerms.supervision_monthly_rate) {
    const monthlyFee = contractTerms.base_fee_amount / contractTerms.original_duration_months;
    const extensionMonths = daysImpact / 30;
    supervisionAdjustment = monthlyFee * extensionMonths;
  }

  return {
    direct_cost: directCost,
    markup_percent: markupPercent,
    markup_amount: markupAmount,
    days_impact: daysImpact,
    supervision_adjustment: supervisionAdjustment,
    total_amount: directCost + markupAmount + supervisionAdjustment,
  };
}
```

---

## 6. UI Components to Build

### 6.1 Contract Template Editor
- Rich text editor with variable insertion toolbar
- Clause library sidebar (drag-and-drop)
- Variable preview panel
- Template versioning

### 6.2 Contract Builder Dialog
```
┌──────────────────────────────────────────────────────────────┐
│ Create Contract                                         [X]  │
├──────────────────────────────────────────────────────────────┤
│ Template: [Construction Agreement ▼]                         │
│                                                              │
│ Link To: ○ Lead  ● Job                                      │
│ Select: [Smith Residence - 456 Oak Lane ▼]                  │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ VARIABLES                                                ││
│ │ ─────────────────────────────────────────────────────────││
│ │ Client Name:        [John & Jane Smith_______]           ││
│ │ Project Address:    [456 Oak Lane, Tampa, FL_]           ││
│ │ Contract Amount:    [$1,250,000.00___________]           ││
│ │ Fee Amount:         [$125,000.00_____________]           ││
│ │ Fee Percentage:     [10%_____________________]           ││
│ │ Retainage:          [10%_____________________]           ││
│ │ Est. Start:         [03/01/2026______________]           ││
│ │ Est. Completion:    [03/01/2027______________]           ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ OPTIONAL CLAUSES                                         ││
│ │ ─────────────────────────────────────────────────────────││
│ │ ☑ Indemnification (Article 13)                           ││
│ │ ☑ Limitation of Liability (Article 14)                   ││
│ │ ☑ Right to Stop Work (Article 15)                        ││
│ │ ☐ Hazardous Materials (Article 16)                       ││
│ │ ☑ Waiver of Subrogation (Article 17)                     ││
│ │ ☑ Mechanic's Lien Rights (Article 18)                    ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ EXHIBITS                                                 ││
│ │ ─────────────────────────────────────────────────────────││
│ │ ☑ Exhibit A: Project Plans (12 sheets)                   ││
│ │ ☑ Exhibit B: Project Specifications                      ││
│ │ ☑ Exhibit C: Budget Summary                              ││
│ │ ☐ Exhibit D: Allowance Schedule                          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│         [Cancel]  [Preview PDF]  [Save Draft]  [Send →]     │
└──────────────────────────────────────────────────────────────┘
```

### 6.3 Florida Lien Law Disclosure Modal
This MUST be shown and acknowledged before any contract signing:

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ IMPORTANT: Florida Construction Lien Law Disclosure       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ According to Florida's Construction Lien Law (Chapter 713,   │
│ Florida Statutes), those who work on your property or        │
│ provide materials and services and are not paid have a       │
│ right to enforce their claim for payment against your        │
│ property. This claim is known as a construction lien.        │
│                                                              │
│ If your contractor or a subcontractor fails to pay           │
│ subcontractors, sub-subcontractors, or material suppliers,   │
│ those people who are owed money may look to your property    │
│ for payment, EVEN IF YOU HAVE ALREADY PAID YOUR CONTRACTOR   │
│ IN FULL.                                                     │
│                                                              │
│ To protect yourself, you should:                             │
│                                                              │
│ 1. Require your contractor to give you a list of all        │
│    subcontractors and suppliers on your project              │
│                                                              │
│ 2. Obtain lien releases as work progresses and final        │
│    releases when all work is complete                        │
│                                                              │
│ 3. Be cautious about making large advance payments           │
│                                                              │
│ ☑ I have read and understand this disclosure                 │
│                                                              │
│                    [Continue to Contract →]                  │
└──────────────────────────────────────────────────────────────┘
```

### 6.4 Contract Detail Page (Enhanced)

```
┌──────────────────────────────────────────────────────────────┐
│ CONTRACT #C-2026-001                                         │
│ Smith Residence - Construction Agreement                     │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│ Status: [🟢 Active]  Signature: [✅ Fully Executed]         │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ SUMMARY                                                │  │
│ ├────────────────────────────────────────────────────────┤  │
│ │ Client:           John & Jane Smith                    │  │
│ │ Project:          456 Oak Lane, Tampa, FL              │  │
│ │ Contract Type:    Cost Plus Fixed Fee                  │  │
│ │ Contract Amount:  $1,250,000.00                        │  │
│ │ Builder's Fee:    $125,000.00 (10%)                    │  │
│ │ Retainage:        10%                                  │  │
│ │ Executed:         February 3, 2026                     │  │
│ │ Start Date:       March 1, 2026                        │  │
│ │ Target Complete:  March 1, 2027                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ [View PDF] [Download Signed] [Create Amendment] [View Job]  │
│                                                              │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│                                                              │
│ TABS: [Details] [Pricing] [Change Orders] [Draws] [Liens]   │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ PRICING TERMS                                          │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ Original Contract:      $1,250,000.00                  │  │
│ │ Approved Change Orders: +$45,000.00                    │  │
│ │ Current Contract Value: $1,295,000.00                  │  │
│ │                                                        │  │
│ │ Fee Earned to Date:     $87,500.00                     │  │
│ │ Retainage Held:         $42,500.00                     │  │
│ │                                                        │  │
│ │ ──────────────────────────────────────────────────     │  │
│ │ Change Order Markup Tiers:                             │  │
│ │   • Under $10,000: 15%                                 │  │
│ │   • $10,000+: 10%                                      │  │
│ │   • Schedule impact: Monthly fee adjustment            │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ LINKED CHANGE ORDERS                                   │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ CO-001  Kitchen upgrade           +$15,000   Approved  │  │
│ │ CO-002  Additional outlet         +$500      Approved  │  │
│ │ CO-003  Foundation issue          +$29,500   Approved  │  │
│ │                                                        │  │
│ │ Total Approved: +$45,000                               │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ PAYMENT STATUS                                         │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ Draw #1  $125,000  Funded   01/15/2026                │  │
│ │ Draw #2  $185,000  Funded   02/15/2026                │  │
│ │ Draw #3  $215,000  Pending  (submitted)               │  │
│ │                                                        │  │
│ │ Total Funded: $310,000 / $1,295,000 (24%)             │  │
│ │ [█████░░░░░░░░░░░░░░░░░░░░░░░░░░] 24%                 │  │
│ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create database migrations for new tables
- [ ] Build contract template CRUD API endpoints
- [ ] Build contract clause library API
- [ ] Implement variable substitution engine
- [ ] Add `template_type: 'preconstruction'` and `'construction'` to system

### Phase 2: Template Management (Week 3)
- [ ] Build Contract Template Editor component
- [ ] Implement clause library sidebar
- [ ] Add variable insertion toolbar
- [ ] Create default templates from provided documents

### Phase 3: Contract Creation (Week 4-5)
- [ ] Build Contract Builder Dialog
- [ ] Implement lead/job linking
- [ ] Build variable auto-population
- [ ] Add optional clause selection
- [ ] Implement exhibit attachment

### Phase 4: E-Signature Integration (Week 6)
- [ ] Build Florida Lien Law Disclosure modal
- [ ] Integrate with existing signature system
- [ ] Implement signing order (disclosure → contract)
- [ ] Add signature status tracking to Contracts page

### Phase 5: Job Conversion (Week 7)
- [ ] Build "Convert to Job" workflow
- [ ] Implement estimate → budget transfer
- [ ] Link contract pricing terms to change order calculations
- [ ] Connect contract to draws and lien releases

### Phase 6: Enhanced Change Orders (Week 8)
- [ ] Update Change Order form with contract-based pricing
- [ ] Implement automatic markup tier calculation
- [ ] Add supervision adjustment for schedule impacts
- [ ] Link COs back to contract

### Phase 7: Reporting & PDF (Week 9)
- [ ] Build PDF generation service
- [ ] Create professional contract PDF template
- [ ] Add signed document storage
- [ ] Build contract summary reports

### Phase 8: Polish & Testing (Week 10)
- [ ] End-to-end workflow testing
- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] User documentation

---

## 8. API Endpoints to Add

### Contract Templates
```
GET    /api/contract-templates
POST   /api/contract-templates
GET    /api/contract-templates/:id
PUT    /api/contract-templates/:id
DELETE /api/contract-templates/:id
```

### Contract Clauses
```
GET    /api/contract-clauses
POST   /api/contract-clauses
PUT    /api/contract-clauses/:id
DELETE /api/contract-clauses/:id
```

### Contract Documents
```
POST   /api/contracts/:id/generate     # Generate from template
GET    /api/contracts/:id/preview-pdf  # Preview before signing
POST   /api/contracts/:id/send         # Send for signature
GET    /api/contracts/:id/document     # Get generated document
```

### Contract Pricing
```
GET    /api/contracts/:id/pricing
PUT    /api/contracts/:id/pricing
GET    /api/contracts/:id/change-order-pricing  # Calculate CO with contract terms
```

---

## 9. Files to Create/Modify

### New Files
```
client/src/pages/ContractTemplates.tsx
client/src/pages/ContractClauses.tsx
client/src/components/contracts/ContractBuilder.tsx
client/src/components/contracts/ContractTemplateEditor.tsx
client/src/components/contracts/ClauseLibrarySidebar.tsx
client/src/components/contracts/VariableEditor.tsx
client/src/components/contracts/FloridaLienDisclosure.tsx
client/src/components/contracts/ContractPricingTerms.tsx
client/src/components/contracts/ContractDetailPage.tsx
client/src/hooks/useContractTemplates.ts
client/src/hooks/useContractClauses.ts
client/src/hooks/useContractDocuments.ts
server/src/routes/contract-templates.ts
server/src/routes/contract-clauses.ts
server/src/services/contractVariableService.ts
server/src/services/pdfGenerationService.ts
```

### Files to Modify
```
client/src/pages/Contracts.tsx           # Add template selection, builder integration
client/src/pages/ChangeOrders.tsx        # Add contract-based pricing
client/src/components/change-orders/COFormDialog.tsx  # Update pricing formula
client/src/hooks/useContracts.ts         # Add template-related methods
client/src/pages/Leads.tsx               # Add "Create PreCon Agreement" action
client/src/components/leads/LeadDetailDialog.tsx  # Add contract creation
```

---

## 10. Default Templates to Create

### 1. Pre-Construction Agreement
Based on provided `PreConstruction_Agreement_Template.docx`:
- Services scope sections
- Fee structure (hourly, flat fee, deposits)
- Timeline milestones
- Transition to construction clause

### 2. Construction Agreement (Cost Plus Fixed Fee)
Based on provided `Construction_Agreement_Template.docx`:
- All 18 articles (including new recommended provisions)
- Florida Lien Law Disclosure
- Exhibit references

### 3. Subcontract Agreement
- Standard subcontractor terms
- Pay-if-paid provisions
- Scope of work attachment
- Insurance requirements

### 4. Change Order Amendment
- Reference to original contract
- Description of change
- Pricing breakdown
- Schedule impact
- Signature block

---

## 11. Success Metrics

| Metric | Target |
|--------|--------|
| Contract creation time | < 10 minutes from template |
| E-signature completion rate | > 90% within 48 hours |
| Variable accuracy | 100% auto-populated correctly |
| PDF generation time | < 5 seconds |
| Mobile usability | Full functionality on tablet |
| Lead → Contract conversion | Seamless in < 5 clicks |

---

## 12. Security Considerations

- **Document Access**: Contracts visible only to assigned team members
- **Signature Verification**: IP logging, timestamp, geolocation
- **Audit Trail**: Full history of all contract actions
- **PDF Tampering**: Signed PDFs include digital seal
- **Data Encryption**: All contract content encrypted at rest

---

## Summary

This implementation plan provides a comprehensive roadmap for building a full-featured contract management system that:

1. **Leverages Existing Infrastructure**: Uses the existing signature system, change order module, draws, and lien releases
2. **Implements Contract Templates**: Stores and manages reusable contract templates with variable substitution
3. **Enforces Florida Requirements**: Includes mandatory Lien Law Disclosure workflow
4. **Automates Pricing**: Implements the Cost + Fee + Supervision Adjustment formula from Article 6
5. **Connects the Pipeline**: Links leads → pre-construction → construction → job conversion
6. **Provides Audit Trail**: Full tracking of all contract activities

The system will significantly streamline contract creation, ensure legal compliance, and provide a seamless experience from initial lead contact through construction completion.
