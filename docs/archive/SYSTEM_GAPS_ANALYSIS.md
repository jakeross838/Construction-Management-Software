# Construction Management Software - System Gaps Analysis

**Generated:** January 30, 2026
**Test Case:** Clark Residence - 853 N Shore Dr, Anna Maria, FL
**Contract Value:** $5,250,000 ($4,400,000 cost + $850,000 fee)
**Job ID:** f31a5510-53b9-411c-8e1c-616c611cfe5f

---

## Executive Summary

During the comprehensive import of the Clark job as a test case, numerous system gaps were identified. The current system handles **vendors, bids, invoices, and basic job information** well, but lacks critical modules needed for complete construction management.

---

## 1. PERMITS & INSPECTIONS MODULE (Critical Gap)

### Current State
- No permits tracking
- No inspection scheduling or results tracking
- No permit document storage

### Data That Cannot Be Stored
From Clark project:
- **Building Permit:** #B25-000313, Issued 10/08/2025, Expires 10/08/2027
- **FDEP CCCL Permit:** (Coastal Construction Control Line) - ME-1535
- **LONO:** Letter of No Objection from City of Anna Maria (File Z23-000011)
- **DEP Permit:** Environmental permit for seaward construction
- **40+ Required Inspections** including:
  - Foundation/Pile inspections
  - Framing inspections
  - Electrical rough/final
  - Plumbing rough/final
  - Mechanical rough/final
  - Fire inspections
  - Final inspections
  - Certificate of Occupancy

### Required Features
- Permit types (Building, Electrical, Plumbing, Mechanical, Fire, DEP, CCCL, etc.)
- Permit numbers, issue dates, expiration dates
- Inspection scheduling with date/time
- Inspector name tracking
- Pass/Fail/Partial status
- Re-inspection tracking
- Notes and correction items
- Document attachment for permit cards
- Automatic expiration alerts
- Timeline view showing inspection sequence

---

## 2. BUDGET/ESTIMATES MODULE (Critical Gap)

### Current State
- No budget tracking
- No cost code system
- No estimate vs actual comparison

### Data That Cannot Be Stored
From Clark project ($5,447,660 detailed estimate):
- **21 Major Cost Categories** with cost codes:
  - 01-General Conditions: $109,265
  - 02-Site Work/Piles: $250,405
  - 03-Concrete: $289,670
  - 04-Masonry: $191,520
  - 05-Metals/Structural Steel: $191,250
  - 06-Carpentry/Framing: $345,235
  - 07-Insulation/Waterproofing: $80,000
  - 08-Roofing: $75,000
  - 09-Doors/Windows/Glass: $347,490
  - 10-Exterior Finishes: $195,000
  - 11-Drywall/Plaster: $176,000
  - 12-Tile/Stone: $198,000
  - 13-Flooring: $41,000
  - 14-Paint: $90,000
  - 15-Specialties: $55,000
  - 16-Cabinets/Millwork: $295,000
  - 17-Appliances: $90,000
  - 18-Plumbing: $252,680
  - 19-HVAC: $159,500
  - 20-Electrical: $241,420
  - 21-Landscaping/Pool: $540,225
  - Plus: Permits ($68,000), Design ($500,000), Contingency ($165,000)

### Required Features
- Hierarchical cost code structure (Division > Category > Line Item)
- Original budget entry
- Revised budget tracking (with change order integration)
- Committed costs (from awarded bids)
- Actual costs (from approved invoices)
- Variance analysis (Budget vs Committed vs Actual)
- Cost per SF calculations
- Budget templates for job types
- Import from Excel/CSV
- Visual budget charts
- Forecast to complete

---

## 3. DOCUMENT MANAGEMENT SYSTEM (Critical Gap)

### Current State
- No document storage
- No version control
- No document categorization

### Data That Cannot Be Stored
From Clark project:
- **Plans/Drawings:**
  - Architectural Plans Rev 2 (12/16/25)
  - Structural Plans Rev 1 (12/18/25)
  - Mechanical Plans (HVAC layouts)
  - Interior Elevations
  - DEP Permitted Plans
  - LONO Permitted Plans
  - Design Presentations

- **Engineering Reports:**
  - Geotechnical Report (Soil Borings)
  - Auger Cast Pile Monitoring Report
  - Cylinder Testing Results
  - Structural Calculations

- **Contracts:**
  - Owner Contract
  - Subcontractor Agreements
  - Engineering Contracts

- **Correspondence:**
  - Owner emails/letters
  - Architect communications
  - City/permitting correspondence

### Required Features
- Folder/category structure by document type
- Version control with revision tracking
- Check-in/check-out for editing
- Document preview
- Full-text search within documents
- Tagging and metadata
- Access control by role
- Audit trail of views/downloads
- Integration with job and vendor records
- Cloud storage with local caching
- Mobile access for field use

---

## 4. CONTRACTS MODULE (High Priority Gap)

### Current State
- No contract tracking
- No contract terms storage
- No milestone tracking

### Data That Cannot Be Stored
From Clark project:
- **Owner Contract:**
  - Contract Date: 3/14/2025
  - Total: $5,250,000
  - Cost: $4,400,000
  - Fee: $850,000 (19.3%)
  - Change Order Markup: 20%
  - Payment Terms: Due upon receipt
  - Duration: 720 days from permit (until ~Oct 2027)
  - Warranty: 1-year limited
  - Insurance Requirements
  - Allowance tracking ($60,000+ in allowances)

- **Subcontractor Contracts:**
  - Scope of work details
  - Payment terms
  - Insurance requirements
  - Lien waiver requirements
  - Retention terms

### Required Features
- Contract templates
- Key terms extraction
- Milestone/phase tracking
- Payment schedule
- Insurance certificate tracking with expiration alerts
- Lien waiver management
- Contract amendments/addenda
- Digital signature integration
- Notification for upcoming milestones
- Retention tracking

---

## 5. CHANGE ORDERS MODULE (High Priority Gap)

### Current State
- No change order tracking
- Cannot link changes to budget impact

### Data That Cannot Be Stored
- Change order requests
- Pricing with markup (20% per Clark contract)
- Owner approval tracking
- Impact on schedule
- Impact on budget
- Supporting documentation

### Required Features
- Change order creation workflow
- Automatic markup calculation
- Owner approval workflow
- Budget integration (update revised budget)
- Schedule impact tracking
- Document attachment
- Numbering sequence
- Status tracking (Draft > Submitted > Approved > Billed)
- Running total of approved changes

---

## 6. SCHEDULE MODULE (High Priority Gap)

### Current State
- No schedule tracking
- No milestone management
- No Gantt charts

### Data That Cannot Be Stored
From Clark project:
- Contract Duration: 720 days from permit
- Permit Issued: 10/08/2025
- Target Completion: ~October 2027
- Phase milestones
- Critical path activities
- Inspection coordination

### Required Features
- Gantt chart view
- Task dependencies
- Milestone tracking
- Critical path identification
- Resource assignment
- Calendar integration
- Weather delay tracking
- Schedule vs actual comparison
- Mobile updates from field
- Integration with inspections
- Subcontractor schedule coordination

---

## 7. SELECTIONS/SPECIFICATIONS MODULE (Medium Priority Gap)

### Current State
- No selections tracking
- No specification management
- No approval workflow

### Data That Cannot Be Stored
From Clark project - **Detailed Tile Selections:**

| Room | Area | Product | Size | Pattern | Grout | SF |
|------|------|---------|------|---------|-------|-----|
| Ground Level | Floor | Essential White | 24x48 | Stacked | Mink | 449 |
| Balconies | Floor | Essentails White | 2CM | Pavers | - | 261 |
| Powder Bath 104 | Floor | Essential White | 24x48 | Stacked | Mink | 30 |
| Powder Bath 104 | Vanity Wall | Fishscale Iceberg Marble | - | - | TBD | - |
| Bath 102 | Floor | Purity White | 12x24 | H-Stack | Oyster | 31 |
| Bath 102 | Shower Floor | Pennyround Carrara/Blue | - | - | Oyster | 19 |
| Bath 102 | Shower Walls | Aquarella White Wave | 12x36 | H-Stack | White | - |
| Bath 106 | Floor | Essential White | 12x24 | H-Stack | Mink | 33 |
| Bath 106 | Shower Floor | Micro Pebble Lombox | - | - | Oyster | 18 |
| Bath 106 | Shower Walls | Myorka White | 4x4 | Brick | Oyster | - |
| Bath 202 | Floor | Essentials White | 12x24 | V-Stack | Mink | 33 |
| Bath 202 | Shower Floor | TBD (Raja Ampat/Sumatra) | - | - | - | 19 |
| Bath 202 | Shower Walls | Artist Chameleon Sage | 1.5x9 | Herring | TBD | - |
| Master 205 | Floor | Calacatta Gold | 24x48 | Stacked | Oyster | 213 |
| Master 205 | Shower Floor | Calacatta Gold | 12x24 | Stacked | Oyster | 43 |
| Master 205 | Shower Walls | Calacatta Gold + Tineo | 24x48 | V-Stack | Oyster | - |

**Appliances ($56,935.96):**
- Sub-Zero Refrigerator/Freezer
- Wolf Induction Cooktop 36"
- Wolf Double Wall Ovens
- Wolf Coffee System
- Wolf Warming Drawer
- Bosch Dishwashers (2)
- Marvel Ice Machine
- LG Washer/Dryers (2 sets)

### Required Features
- Category/room organization
- Product details (manufacturer, model, SKU, price)
- Lead time tracking
- Order status
- Delivery scheduling
- Installation status
- Owner approval workflow
- Specification sheets attachment
- Vendor/supplier linking
- Budget vs actual for allowances
- Photo documentation
- Substitution tracking

---

## 8. NOA/PRODUCT APPROVALS MODULE (Medium Priority Gap)

### Current State
- No Florida Building Code product approval tracking
- No NOA expiration alerts

### Data That Cannot Be Stored
From Clark project (21 NOAs documented):

**Windows - ES Windows:**
- FL 20692 (Fixed windows)
- FL 26359 (Casement/Awning)

**Doors - ES/Clopay:**
- FL 21835, FL 22267, FL 41359, FL 32009, FL 17897

**Siding - Luma Built:**
- FL 47109 R1

**Roofing - GAF TPO:**
- FL 5293

### Required Features
- Product type categorization
- FL Approval number
- Expiration date tracking
- Manufacturer information
- Product specifications
- Document attachment (NOA certificates)
- Automatic expiration alerts
- Link to job where used
- Compliance verification checklist

---

## 9. DRAW REQUEST MODULE (Medium Priority Gap)

### Current State
- Basic draw table exists but limited functionality
- No draw schedule integration
- No lien waiver management

### Data Missing
- Draw schedule from contract
- Percentage complete by cost code
- Supporting documentation requirements
- Lien waiver collection workflow
- Bank/lender integration

### Required Features
- Draw schedule creation from budget
- Percentage complete tracking
- Automatic calculation of draw amount
- Supporting documentation checklist
- Lien waiver collection (partial and final)
- Notarization tracking
- Bank submission package generation
- Draw history and payment tracking

---

## 10. WARRANTY MODULE (Lower Priority Gap)

### Current State
- No warranty tracking
- No service request management

### Data That Cannot Be Stored
From Clark contract:
- 1-year limited warranty
- Warranty start date (substantial completion)
- Warranty expiration date
- Subcontractor warranty terms
- Manufacturer warranties (appliances, roofing, windows, etc.)

### Required Features
- Warranty terms by trade/item
- Start/end date tracking
- Service request intake
- Work order generation
- Subcontractor assignment
- Resolution tracking
- Warranty call statistics
- Cost tracking for warranty work

---

## 11. DAILY LOGS MODULE (Lower Priority Gap)

### Current State
- No daily log functionality
- No field reporting

### Required Features
- Date/weather conditions
- Manpower on site (by trade)
- Work performed
- Materials delivered
- Equipment on site
- Visitor log
- Safety observations
- Photo documentation
- Delay documentation
- Mobile-first interface

---

## 12. RFI (Request for Information) MODULE (Lower Priority Gap)

### Current State
- No RFI tracking

### Required Features
- RFI numbering sequence
- Question/issue description
- Submittal of supporting docs
- Routing to architect/engineer
- Response tracking
- Due date management
- Status workflow
- Integration with schedule impact
- Document attachment

---

## 13. SUBMITTAL TRACKING MODULE (Lower Priority Gap)

### Current State
- No submittal management

### Required Features
- Submittal schedule creation
- Submittal log with numbering
- Document upload
- Review routing (GC > Architect > Engineer)
- Approval status tracking
- Revision management
- Lead time tracking
- Integration with procurement

---

## Summary: Priority Ranking

### Critical (Must Have for MVP)
1. **Permits & Inspections** - Required for code compliance
2. **Budget/Estimates** - Core financial management
3. **Document Management** - Central to all operations

### High Priority (Phase 2)
4. **Contracts** - Legal and financial protection
5. **Change Orders** - Budget and scope management
6. **Schedule** - Project timeline management

### Medium Priority (Phase 3)
7. **Selections/Specifications** - Client satisfaction
8. **NOA/Product Approvals** - Florida code compliance
9. **Draw Requests** - Enhanced version of existing

### Lower Priority (Phase 4)
10. **Warranty** - Post-construction
11. **Daily Logs** - Field operations
12. **RFIs** - Design coordination
13. **Submittals** - Procurement coordination

---

## Technical Considerations

### Database Schema Additions Needed
- `permits` table with `inspections` child table
- `budgets` table with `budget_lines` child table
- `documents` table with storage integration
- `contracts` table with `contract_milestones`
- `change_orders` table
- `schedule_tasks` table
- `selections` table with approval workflow
- `noas` table (product approvals)
- `warranty_items` and `service_requests` tables
- `daily_logs` table
- `rfis` table
- `submittals` table

### Integration Points
- Supabase Storage for document management
- Calendar integration for inspections/scheduling
- Email notifications for approvals and alerts
- Mobile-responsive design for field use
- PDF generation for reports and submittals

---

## Appendix: Clark Project Statistics

- **Total Bids Imported:** ~100+ from various trades
- **Vendors Created:** 50+ subcontractors and suppliers
- **Document Types Found:** 15+ categories
- **Tile Selections:** 6 rooms, 20+ products
- **Appliances:** 12+ items ($56,935.96)
- **NOAs Required:** 21 product approvals
- **Permit Types:** 4 (Building, FDEP, CCCL LONO, DEP)
- **Budget Line Items:** 21 major categories
- **Contract Duration:** 720 days
