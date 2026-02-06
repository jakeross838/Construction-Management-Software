# Ross Built CMS - Page-by-Page Prompts

> **HOW TO USE THIS FILE:**
> 1. First, paste the Knowledge Base into Lovable's Knowledge feature
> 2. Copy ONE prompt at a time into Lovable
> 3. Wait for completion before moving to next prompt
> 4. Build in order: Layout Shell → Dashboard → Job Hub → Financial pages

---

## PHASE 1: LAYOUT SHELL

### Prompt 1.1: Create App Layout Shell

```
CONTEXT:
Building the Ross Built Construction Management Software. Starting with the main layout shell that will wrap all pages.

TASK:
Create the main app layout with header navigation and responsive structure.

REQUIREMENTS:
1. Header with:
   - Logo area (text "Ross Built" with construction icon)
   - Main nav items as dropdowns: Overview, Sales, Pre-Con, Operations, Financial, Closeout, Settings
   - Each dropdown shows its sub-pages (see Knowledge Base for structure)
   - Active state for current section

2. Main content area below header

3. Responsive behavior:
   - Desktop: Full horizontal nav
   - Tablet/Mobile: Hamburger menu with slide-out drawer

GUIDELINES:
- Use shadcn/ui NavigationMenu or DropdownMenu components
- Warm cream background (#f5f3ef)
- Nav items should highlight on hover and when active
- Include React Router setup with placeholder routes

CONSTRAINTS:
- Do NOT create any page content yet, just the layout shell
- Do NOT add authentication
- Focus solely on navigation structure
```

---

### Prompt 1.2: Create Job Sidebar Component

```
CONTEXT:
Continuing the Ross Built CMS. Need a reusable job sidebar for pages that are job-specific.

TASK:
Create a JobSidebar component that appears on the left side of job-specific pages.

REQUIREMENTS:
1. Job selector dropdown at top:
   - Fetches jobs from GET /api/jobs
   - Shows job name and client
   - "All Jobs" option for pages that support it

2. Selected job info card showing:
   - Job name (e.g., "Drummond - 501 74th St")
   - Client name
   - Contract amount (formatted as currency)
   - Progress bar with % complete
   - Status badge

3. Responsive behavior:
   - Desktop: Fixed left sidebar (w-64)
   - Mobile: Collapsible or hidden with toggle

GUIDELINES:
- Use shadcn/ui Select for dropdown
- Use shadcn/ui Card for job info
- Use shadcn/ui Progress for progress bar
- Persist selected job in URL query param (?job_id=xxx)

CONSTRAINTS:
- Do NOT modify the header navigation
- This is a reusable component, not a page
```

---

## PHASE 2: OVERVIEW PAGES

### Prompt 2.1: Create Dashboard Page

```
CONTEXT:
Building the Dashboard page for Ross Built CMS. This is the company overview that Owner/Admin/Accounting see first.

TASK:
Create the Dashboard page at route /dashboard

REQUIREMENTS:
1. Page header: "Dashboard" with subtitle "Company overview"

2. Four stat cards in a row:
   - Invoices Pending Approval (count) - amber icon
   - Approved This Month ($) - green icon
   - Open Purchase Orders (count) - blue icon
   - Vendors Expiring Soon (count) - red warning icon

3. Two-column section below:
   LEFT: "Needs Attention" card with alert items:
   - Invoices over 30 days
   - POs pending approval
   - Draws ready to submit
   - Selections awaiting client

   RIGHT: "Active Jobs" card with list:
   - Job name, address
   - Progress bar with %
   - Click to navigate to job

4. "Recent Activity" feed at bottom:
   - Timestamp, action description, user
   - Last 10 activities

GUIDELINES:
- Fetch data from GET /api/dashboard/stats
- Use shadcn/ui Card for all sections
- Use icons from lucide-react
- Stat cards should be clickable (navigate to relevant page)

CONSTRAINTS:
- Do NOT include the job sidebar on this page
- Do NOT add filters, this is a summary view
```

---

### Prompt 2.2: Create Job Hub Page

```
CONTEXT:
Building the Job Hub page for Ross Built CMS. This shows all jobs in a grid/list view.

TASK:
Create the Job Hub page at route /job-hub

REQUIREMENTS:
1. Page header: "Job Hub" with "+ New Job" button (top right)

2. Filter bar:
   - Search input (searches job name, client, address)
   - Status dropdown: All, Active, Completed, On Hold
   - View toggle: Cards / Table

3. Card view (default):
   - Grid of job cards (3 columns desktop, 2 tablet, 1 mobile)
   - Each card shows:
     - Placeholder image area
     - Job name
     - Address
     - Client name
     - Contract amount
     - Progress bar with %
     - Status badge
   - Click card to navigate to /job-profile?id={jobId}

4. Table view (alternate):
   - Columns: Name, Client, Address, Contract, Progress, Status
   - Sortable columns
   - Click row to navigate to job profile

5. Empty state when no jobs match filters

GUIDELINES:
- Fetch from GET /api/jobs?status={filter}
- Use shadcn/ui Card, Table, Input, Select
- Add skeleton loading state
- "+ New Job" opens a modal (just placeholder for now)

CONSTRAINTS:
- Do NOT include the job sidebar
- Do NOT build the New Job modal fully, just placeholder
```

---

## PHASE 3: FINANCIAL PAGES

### Prompt 3.1: Create Invoices List Page

```
CONTEXT:
Building the Invoices page for Ross Built CMS. This is the main financial workflow - invoice approval.

TASK:
Create the Invoices page at route /invoices

REQUIREMENTS:
1. Include the JobSidebar component on the left

2. Page header: "Invoices" with "+ Upload Invoice" button

3. Filter bar:
   - Status dropdown: All Active, Received, Needs Approval, Approved, In Draw, Paid, Denied
   - Job dropdown (from sidebar selection or "All")
   - Vendor dropdown
   - Search input

4. Invoice table:
   - Checkbox column for bulk selection
   - Columns: Vendor, Invoice #, Date, Amount, Job, Status
   - Status shown as colored badge
   - Row hover effect
   - Click row to open invoice detail modal (next prompt)

5. Bulk action bar (appears when items selected):
   - "Approve Selected" button
   - "Add to Draw" button
   - "Deny" button

6. Pagination at bottom

STATUS BADGES:
- received: Gray
- needs_approval: Amber
- approved: Green
- in_draw: Purple
- paid: Blue
- denied: Red

GUIDELINES:
- Fetch from GET /api/invoices?status=&job_id=&vendor_id=
- Use shadcn/ui Table, Checkbox, Badge, Select
- Empty state: "No invoices yet. Upload your first invoice."

CONSTRAINTS:
- Do NOT build the upload modal yet
- Do NOT build the detail modal yet
- Focus on the list view only
```

---

### Prompt 3.2: Create Invoice Detail Modal

```
CONTEXT:
Continuing the Invoices page. Need the detail modal that opens when clicking an invoice row.

TASK:
Create the InvoiceDetailModal component with split-view layout.

REQUIREMENTS:
1. Modal size: Large (max-w-4xl)

2. Header:
   - Title: "Invoice: {invoice_number} - {vendor_name}"
   - Close X button

3. Split layout:
   LEFT SIDE (40%):
   - PDF preview area (iframe or placeholder)
   - Scrollable if PDF is long

   RIGHT SIDE (60%):
   - Editable form fields:
     - Vendor (dropdown)
     - Invoice # (text)
     - Date (date picker)
     - Due Date (date picker)
     - Amount (currency input)
   - Job dropdown (required)
   - PO dropdown (filtered by selected job, shows remaining amount)
   - Cost Allocations table:
     - Cost Code dropdown | Amount input
     - "+ Add Allocation" button
     - Total row (must match invoice amount)
   - Notes textarea

4. Footer buttons:
   - "Deny" (left, red outline)
   - "Save" (right, secondary)
   - "Approve & Stamp" (right, primary blue)

5. Validation:
   - Allocations must sum to invoice amount
   - Show error if mismatch

GUIDELINES:
- Fetch invoice from GET /api/invoices/:id
- Update via PATCH /api/invoices/:id
- Approve via PATCH /api/invoices/:id/approve
- Use shadcn/ui Dialog, Input, Select, Button, Table

CONSTRAINTS:
- Do NOT modify the invoice list page
- Focus only on this modal component
```

---

### Prompt 3.3: Create Invoice Upload Modal

```
CONTEXT:
Continuing the Invoices page. Need the upload modal for adding new invoices.

TASK:
Create the InvoiceUploadModal component with drag-and-drop upload.

REQUIREMENTS:
1. Modal size: Medium (max-w-lg)

2. Initial state - Upload zone:
   - Drag & drop area with dashed border
   - Upload icon
   - Text: "Drag & drop PDF here or click to browse"
   - File input (accepts .pdf only)

3. Processing state:
   - Spinner animation
   - Progress text: "Extracting invoice data with AI..."
   - Step indicators:
     - ✓ Uploading PDF
     - ✓ Running OCR
     - ● Extracting data...
     - ○ Matching job and vendor

4. Results state:
   - Show extracted fields with confidence indicators:
     - 🟢 High (>90%): Green checkmark
     - 🟡 Medium (70-90%): Yellow warning "Verify"
     - 🔴 Low (<70%): Red "Enter manually"
   - Pre-filled form similar to detail modal
   - "Save & Review" button

GUIDELINES:
- Upload via POST /api/invoices/process (FormData)
- Response includes ai_result with confidence scores
- Use shadcn/ui Dialog, Button, Progress

CONSTRAINTS:
- Do NOT modify the invoice list or detail modal
- Focus only on the upload flow
```

---

### Prompt 3.4: Create Purchase Orders List Page

```
CONTEXT:
Building the Purchase Orders page for Ross Built CMS.

TASK:
Create the Purchase Orders page at route /purchase-orders

REQUIREMENTS:
1. Include the JobSidebar component on the left

2. Page header: "Purchase Orders" with "+ Create PO" button

3. Filter bar:
   - Status dropdown: All, Open, Closed, Cancelled
   - Job dropdown
   - Vendor dropdown
   - Search input

4. PO table:
   - Columns: PO #, Job, Vendor, Amount, Invoiced, Status
   - "Invoiced" column shows mini progress bar (invoiced/total)
   - Status badge: Open (green), Closed (blue), Cancelled (gray)
   - Click row to open PO detail modal

5. Empty state: "No purchase orders yet. Create a PO to commit costs."

GUIDELINES:
- Fetch from GET /api/purchase-orders?status=&job_id=&vendor_id=
- Use shadcn/ui Table, Badge, Progress

CONSTRAINTS:
- Do NOT build the create modal yet
- Do NOT build the detail modal yet
- Focus on the list view only
```

---

### Prompt 3.5: Create PO Detail Modal (Fullscreen with Tabs)

```
CONTEXT:
Continuing Purchase Orders page. Need fullscreen detail modal with tabs.

TASK:
Create the PODetailModal component with tabbed interface.

REQUIREMENTS:
1. Modal: Fullscreen style (max-w-6xl, tall)

2. Header:
   - PO number and vendor name
   - Job name
   - "Approve" button (if pending)
   - Close X button

3. Tabs: Overview | Line Items | Invoices | Change Orders | Activity

4. OVERVIEW TAB:
   - Status badge and approval info
   - Financial summary card:
     - Original Amount
     - Change Orders (+/-)
     - Current Total
     - Invoiced
     - Remaining
   - Progress bar (invoiced %)
   - Scope of Work text (if present)

5. LINE ITEMS TAB:
   - Table: #, Cost Code, Description, Amount, Billed
   - "+ Add Line Item" button
   - Total row

6. INVOICES TAB:
   - Table of linked invoices: Invoice #, Date, Amount, Status
   - Click to view invoice

7. CHANGE ORDERS TAB:
   - Table: CO #, Description, Amount, Status
   - "+ Add Change Order" button

8. ACTIVITY TAB:
   - Audit log list: timestamp, action, user

GUIDELINES:
- Fetch from GET /api/purchase-orders/:id (includes all related data)
- Use shadcn/ui Dialog, Tabs, Table, Card, Badge

CONSTRAINTS:
- Do NOT modify the PO list page
- Focus only on this modal
```

---

### Prompt 3.6: Create PO Form Modal

```
CONTEXT:
Continuing Purchase Orders page. Need the create/edit PO modal.

TASK:
Create the POFormModal component for creating new POs.

REQUIREMENTS:
1. Modal size: Large (max-w-2xl)

2. Header: "Create Purchase Order"

3. Form fields:
   - Job dropdown (required)
   - Vendor dropdown (required)
   - Description (text input)
   - Scope of Work (textarea, optional)

4. Line Items section:
   - Table with editable rows:
     - Cost Code (dropdown)
     - Description (text)
     - Amount (currency)
   - "+ Add Line Item" button
   - Remove row X button
   - Total row (auto-calculated)

5. Footer:
   - "Cancel" button
   - "Create PO" primary button

6. Validation:
   - Job and Vendor required
   - At least one line item
   - All line items need cost code and amount

GUIDELINES:
- POST to /api/purchase-orders with line_items array
- Use shadcn/ui Dialog, Select, Input, Button, Table

CONSTRAINTS:
- Do NOT modify existing PO components
- Can be reused for editing (pass existing PO data as prop)
```

---

### Prompt 3.7: Create Draws List Page

```
CONTEXT:
Building the Draws page for Ross Built CMS. Draws are pay applications (G702/G703).

TASK:
Create the Draws page at route /draws

REQUIREMENTS:
1. Include the JobSidebar component on the left
   - Job selection is REQUIRED for this page
   - If no job selected, show message to select one

2. Page header: "Draws (Pay Applications)" with "+ New Draw" button

3. Job summary card (when job selected):
   - Contract amount
   - Total drawn to date
   - Remaining
   - Progress bar

4. Draws table:
   - Columns: Draw #, Period, Amount, Status, Submitted Date, Actions
   - Status badges: Draft (gray), Submitted (blue), Funded (green)
   - Actions: Edit (draft only), View

5. Empty state: "No draws yet. Create a draw to request payment."

GUIDELINES:
- Fetch from GET /api/draws?job_id={selectedJob}
- Use shadcn/ui Table, Badge, Card, Progress

CONSTRAINTS:
- Require job selection before showing draws
- Do NOT build detail modal yet
```

---

### Prompt 3.8: Create Draw Detail Modal (G702/G703)

```
CONTEXT:
Continuing Draws page. Need fullscreen modal with AIA G702/G703 format.

TASK:
Create the DrawDetailModal component with tabs for G702/G703.

REQUIREMENTS:
1. Modal: Fullscreen style (max-w-6xl)

2. Header:
   - "Draw #{number} - {job_name}"
   - Period dates
   - Status badge
   - Export dropdown (Excel, PDF)
   - Submit button (if draft)
   - Close X

3. Tabs: Summary | G702 | G703 Schedule of Values | Invoices

4. SUMMARY TAB:
   - Application number
   - Period end date
   - Invoice count
   - This Period amount
   - Less Retainage (10%)
   - Current Payment Due

5. G702 TAB:
   - AIA Document G702 format (styled like official form)
   - Fields:
     1. Original Contract Sum
     2. Net Change Orders
     3. Contract Sum to Date
     4. Total Completed to Date
     5. Retainage (10%)
     6. Total Earned Less Retainage
     7. Less Previous Certificates
     8. CURRENT PAYMENT DUE
     9. Balance to Finish

6. G703 TAB:
   - Schedule of Values table:
   - Columns: #, Description, Scheduled Value, Previous Apps, This Period, Total Completed, %, Balance, Retainage
   - One row per cost code with budget
   - Grand total row
   - Data from API g703 array

7. INVOICES TAB:
   - Table: Vendor, Invoice #, Amount, Cost Code, Remove (X)
   - "+ Add Invoices" button opens selection modal
   - Total amount

GUIDELINES:
- Fetch from GET /api/draws/:id (includes g702, g703, invoices)
- Export via GET /api/draws/:id/export/excel or /pdf
- Submit via PATCH /api/draws/:id/submit
- Use shadcn/ui Dialog, Tabs, Table, Card

CONSTRAINTS:
- Do NOT modify draws list page
- Focus on this modal only
```

---

### Prompt 3.9: Create Change Orders Page

```
CONTEXT:
Building the Change Orders page for Ross Built CMS.

TASK:
Create the Change Orders page at route /change-orders

REQUIREMENTS:
1. Include the JobSidebar component (job required)

2. Page header: "Change Orders" with "+ New CO" button

3. Summary bar:
   - Total COs count
   - Approved total (green)
   - Pending total (amber)
   - Net change

4. CO table:
   - Columns: CO #, Description, Amount, Type, Status
   - Type badges: Addition, Deduction, Change, Upgrade
   - Status badges: Draft, Pending, Approved, Rejected
   - Click row to open detail panel

5. Detail panel (slide-out or inline expand):
   - Status and dates
   - Description
   - Cost breakdown table
   - Linked PO (if any)
   - Action buttons: Reject, Approve

6. Empty state: "No change orders for this job."

GUIDELINES:
- Fetch COs as part of job data or separate endpoint
- Use shadcn/ui Table, Badge, Card, Sheet (for slide-out)

CONSTRAINTS:
- Require job selection
- Do NOT build create modal yet
```

---

### Prompt 3.10: Create Budget Tracking Page

```
CONTEXT:
Building the Budget Tracking page for Ross Built CMS.

TASK:
Create the Budget page at route /budget

REQUIREMENTS:
1. Include the JobSidebar component (job required)

2. Page header: "Budget Tracking" with "Export Excel" button

3. Summary row:
   - Contract amount
   - Budget amount
   - Target margin %

4. Four stat cards:
   - Budgeted to Date
   - Committed (POs)
   - Billed (Invoices)
   - Over/Under Budget (with warning if over)

5. Budget table:
   - Columns: Code, Description, Budget, Committed, Billed, Variance
   - Variance shows:
     - ✓ Green: Under budget
     - ⚠️ Red: Over budget
     - Gray dash: Not committed yet
   - Click row to expand and show POs/invoices for that code
   - Total row at bottom

6. Budget health bar showing % committed

7. Warning message if any codes over budget

GUIDELINES:
- Fetch from GET /api/jobs/:id/budget
- Use shadcn/ui Table, Card, Progress, Badge
- Expandable rows using Collapsible or Accordion

CONSTRAINTS:
- Require job selection
- Read-only view (no editing budget from here)
```

---

## PHASE 4: ADDITIONAL PAGES

### Prompt 4.1: Create Vendors Page

```
CONTEXT:
Building the Vendors page for Ross Built CMS (Settings section).

TASK:
Create the Vendors page at route /vendors

REQUIREMENTS:
1. NO job sidebar (this is company-wide)

2. Page header: "Vendors" with "+ Add Vendor" button

3. Filter bar:
   - Search input
   - Trade dropdown (Electrical, Plumbing, HVAC, etc.)
   - Status dropdown: All, Active, Expiring, Expired

4. Vendors table:
   - Columns: Vendor Name, Trade, Phone, Email, Status, Rating
   - Status based on insurance/license expiry:
     - Active (green): Valid docs
     - Expiring (amber): Within 30 days
     - Expired (red): Past expiry
   - Rating as star display (1-5)
   - Click row to open detail panel

5. Detail panel (slide-out):
   - Contact info section
   - Scorecard (Quality, Reliability, Speed, Price ratings)
   - Documents section (W9, Insurance, License with status)
   - Recent POs list
   - "Edit" button

GUIDELINES:
- Fetch from GET /api/vendors?trade=&status=
- Use shadcn/ui Table, Sheet, Badge, Input

CONSTRAINTS:
- Do NOT include job sidebar
- Do NOT build full edit form yet
```

---

## BUILD ORDER CHECKLIST

Use this order for best results:

1. [ ] Layout Shell (header nav, routing)
2. [ ] Job Sidebar component
3. [ ] Dashboard page
4. [ ] Job Hub page
5. [ ] Invoices list page
6. [ ] Invoice detail modal
7. [ ] Invoice upload modal
8. [ ] Purchase Orders list page
9. [ ] PO detail modal
10. [ ] PO form modal
11. [ ] Draws list page
12. [ ] Draw detail modal (G702/G703)
13. [ ] Change Orders page
14. [ ] Budget page
15. [ ] Vendors page
16. [ ] Additional pages as needed

---

## DEBUGGING PROMPTS

If something breaks, use these in Chat Mode first:

**Investigation:**
```
Take a moment to analyze the current state of [component name].
What dependencies does it have? What might be causing [issue]?
Do NOT make any changes yet.
```

**Deep Analysis:**
```
The issue persists. Perform a thorough analysis of the data flow from
API call to render. Identify where the disconnect is happening.
Do NOT make changes until root cause is confirmed.
```

**Safe Fix:**
```
Now implement the fix for [issue].
CONSTRAINT: Do NOT modify any other files except [specific file].
Ensure existing functionality remains intact.
```
