import { Job, Invoice, PurchaseOrder, Draw, Vendor, Lead, CostCode, Employee, Expense } from '@/types/job';

// Jobs
export const jobs: Job[] = [
  {
    id: '1', name: 'Drummond', address: '501 74th Street, Sarasota, FL 34242', client: 'John & Sarah Drummond',
    status: 'active', budget: 1172500, spent: 562500, laborHours: 1240, estimatedHours: 2800,
    startDate: '2025-10-15', targetCompletion: '2026-04-30', margin: 18.5, phase: 'Framing',
    contractAmount: 1250000, percentComplete: 45, pmName: 'Mike Johnson', supervisorName: 'Tom Smith',
  },
  {
    id: '2', name: 'Crews Residence', address: '123 Ocean Blvd, Siesta Key, FL 34242', client: 'Robert & Lisa Crews',
    status: 'active', budget: 2015000, spent: 1512000, laborHours: 3200, estimatedHours: 4500,
    startDate: '2025-06-01', targetCompletion: '2026-02-28', margin: 16.2, phase: 'Finishes',
    contractAmount: 2100000, percentComplete: 72, pmName: 'Mike Johnson',
  },
  {
    id: '3', name: 'Patterson Estate', address: '789 Bay Shore Dr, Longboat Key, FL 34228', client: 'William Patterson',
    status: 'pre_construction', budget: 3150000, spent: 45000, laborHours: 120, estimatedHours: 6800,
    startDate: '2026-02-01', targetCompletion: '2027-02-01', margin: 15.0, phase: 'Pre-Con',
    contractAmount: 3500000, percentComplete: 5, pmName: 'Sarah Chen',
  },
  {
    id: '4', name: 'Wilson Beach House', address: '456 Gulf View Ave, Anna Maria, FL 34216', client: 'James & Emily Wilson',
    status: 'active', budget: 890000, spent: 785000, laborHours: 2100, estimatedHours: 2400,
    startDate: '2025-03-15', targetCompletion: '2026-01-15', margin: 12.8, phase: 'Punch List',
    contractAmount: 950000, percentComplete: 88, pmName: 'Mike Johnson', supervisorName: 'Carlos Rodriguez',
  },
  {
    id: '5', name: 'Martinez Modern', address: '321 Palm Circle, Venice, FL 34285', client: 'Carlos & Maria Martinez',
    status: 'on-hold', budget: 1320000, spent: 422400, laborHours: 980, estimatedHours: 3200,
    startDate: '2025-08-01', targetCompletion: '2026-06-30', margin: 14.2, phase: 'MEP Rough',
    contractAmount: 1450000, percentComplete: 32, pmName: 'Sarah Chen',
  },
];

// Invoices
export const invoices: Invoice[] = [
  { id: '1', jobId: '1', jobName: 'Drummond', vendorId: '1', vendorName: 'Florida Sunshine Carpentry', poId: '1', poNumber: 'PO-Drummond-0043', invoiceNumber: 'INV-4521', invoiceDate: '2026-01-18', dueDate: '2026-02-17', amount: 17760, status: 'needs_approval', notes: 'Framing labor for 2nd floor', createdAt: '2026-01-18' },
  { id: '2', jobId: '1', jobName: 'Drummond', vendorId: '2', vendorName: 'Gulf Coast Electric', invoiceNumber: '2026-0089', invoiceDate: '2026-01-17', dueDate: '2026-02-16', amount: 8450, status: 'needs_approval', createdAt: '2026-01-17' },
  { id: '3', jobId: '1', jobName: 'Drummond', vendorId: '3', vendorName: 'Sarasota Plumbing Co', invoiceNumber: 'SP-1234', invoiceDate: '2026-01-16', dueDate: '2026-02-15', amount: 12300, status: 'needs_approval', createdAt: '2026-01-16' },
  { id: '4', jobId: '1', jobName: 'Drummond', vendorId: '4', vendorName: 'ABC Concrete', invoiceNumber: '78965', invoiceDate: '2026-01-15', dueDate: '2026-02-14', amount: 24500, status: 'approved', createdAt: '2026-01-15' },
  { id: '5', jobId: '2', jobName: 'Crews Residence', vendorId: '5', vendorName: 'XYZ Roofing', invoiceNumber: 'R-2026-42', invoiceDate: '2026-01-14', dueDate: '2026-02-13', amount: 18900, status: 'in_draw', createdAt: '2026-01-14' },
  { id: '6', jobId: '2', jobName: 'Crews Residence', vendorId: '6', vendorName: 'Premium Tile & Stone', invoiceNumber: 'PTS-8976', invoiceDate: '2026-01-12', dueDate: '2026-02-11', amount: 32500, status: 'paid', createdAt: '2026-01-12' },
];

// Purchase Orders
export const purchaseOrders: PurchaseOrder[] = [
  { id: '1', poNumber: 'PO-Drummond-0043', jobId: '1', jobName: 'Drummond', vendorId: '1', vendorName: 'Florida Sunshine Carpentry', description: 'Framing labor - 2nd floor and roof', totalAmount: 25000, invoicedAmount: 17760, remainingAmount: 7240, status: 'open', lineItems: [{ id: '1', costCodeId: '1', costCode: '06100', costCodeName: 'Rough Carpentry', description: 'Framing labor - 2nd floor', amount: 17500, invoicedAmount: 17760 }, { id: '2', costCodeId: '1', costCode: '06100', costCodeName: 'Rough Carpentry', description: 'Framing labor - roof', amount: 7500, invoicedAmount: 0 }], createdAt: '2026-01-15', approvedAt: '2026-01-15', approvedBy: 'Jake Ross' },
  { id: '2', poNumber: 'PO-Drummond-0042', jobId: '1', jobName: 'Drummond', vendorId: '2', vendorName: 'Gulf Coast Electric', description: 'Electrical rough-in', totalAmount: 45000, invoicedAmount: 8450, remainingAmount: 36550, status: 'open', lineItems: [], createdAt: '2026-01-10', approvedAt: '2026-01-10', approvedBy: 'Mike Johnson' },
  { id: '3', poNumber: 'PO-Drummond-0041', jobId: '1', jobName: 'Drummond', vendorId: '3', vendorName: 'Sarasota Plumbing Co', description: 'Plumbing rough-in', totalAmount: 18500, invoicedAmount: 12300, remainingAmount: 6200, status: 'open', lineItems: [], createdAt: '2026-01-08' },
  { id: '4', poNumber: 'PO-Drummond-0040', jobId: '1', jobName: 'Drummond', vendorId: '4', vendorName: 'ABC Concrete', description: 'Foundation concrete', totalAmount: 52700, invoicedAmount: 52700, remainingAmount: 0, status: 'closed', lineItems: [], createdAt: '2025-11-01', approvedAt: '2025-11-01', approvedBy: 'Jake Ross' },
];

// Draws
export const draws: Draw[] = [
  { id: '1', jobId: '1', jobName: 'Drummond', drawNumber: 4, periodStart: '2026-01-01', periodEnd: '2026-01-31', totalAmount: 85450, status: 'draft', invoices: [], g703: [{ id: '1', costCode: '0100', description: 'General Conditions', scheduledValue: 75000, previousBillings: 45000, currentBillings: 12500, totalBilled: 57500, percentComplete: 77, balanceRemaining: 17500, retainage: 2875 }], createdAt: '2026-01-20' },
  { id: '2', jobId: '1', jobName: 'Drummond', drawNumber: 3, periodStart: '2025-12-01', periodEnd: '2025-12-31', totalAmount: 125000, status: 'funded', invoices: [], createdAt: '2025-12-28', submittedAt: '2025-12-29', fundedAt: '2026-01-05', fundedAmount: 125000 },
];

// Vendors
export const vendors: Vendor[] = [
  { id: '1', name: 'Florida Sunshine Carpentry', email: 'info@flsunshinecarp.com', phone: '941-555-0101', trade: 'Carpentry', status: 'active', insuranceExpiry: '2026-06-30', w9OnFile: true, scorecard: { quality: 4.5, reliability: 4.8, speed: 4.2, overall: 4.5 } },
  { id: '2', name: 'Gulf Coast Electric', email: 'service@gulfcoastelec.com', phone: '941-555-0102', trade: 'Electrical', status: 'active', insuranceExpiry: '2026-08-15', w9OnFile: true },
  { id: '3', name: 'Sarasota Plumbing Co', email: 'jobs@sarasotaplumb.com', phone: '941-555-0103', trade: 'Plumbing', status: 'active', insuranceExpiry: '2026-04-30' },
  { id: '4', name: 'ABC Concrete', phone: '941-555-0104', trade: 'Concrete', status: 'active' },
  { id: '5', name: 'XYZ Roofing', trade: 'Roofing', status: 'expiring', insuranceExpiry: '2026-02-15' },
  { id: '6', name: 'Premium Tile & Stone', trade: 'Tile', status: 'active' },
  { id: '7', name: 'Coastal HVAC', trade: 'HVAC', status: 'expired', insuranceExpiry: '2026-01-15' },
];

// Leads
export const leads: Lead[] = [
  { id: '1', name: 'Johnson Family', email: 'johnson@email.com', source: 'referral', estimatedValue: 1200000, stage: 'new_inquiry', daysInStage: 2, createdAt: '2026-01-21' },
  { id: '2', name: 'Martinez Build', source: 'website', estimatedValue: 2100000, stage: 'new_inquiry', daysInStage: 1, createdAt: '2026-01-22' },
  { id: '3', name: 'Thompson Project', source: 'website', estimatedValue: 800000, stage: 'qualifying', daysInStage: 5, createdAt: '2026-01-18' },
  { id: '4', name: 'Garcia Custom Home', source: 'referral', estimatedValue: 950000, stage: 'estimating', daysInStage: 12, createdAt: '2026-01-11' },
  { id: '5', name: 'Roberts Estate', source: 'website', estimatedValue: 1500000, stage: 'proposal_sent', daysInStage: 3, createdAt: '2026-01-10' },
  { id: '6', name: 'Anderson Build', source: 'referral', estimatedValue: 1800000, stage: 'won', daysInStage: 0, createdAt: '2026-01-05' },
];

// Cost Codes
export const costCodes: CostCode[] = [
  { id: '1', code: '01000', name: 'General Conditions', category: 'General' },
  { id: '2', code: '03100', name: 'Concrete', category: 'Foundation' },
  { id: '3', code: '06100', name: 'Rough Carpentry', category: 'Framing' },
  { id: '4', code: '15100', name: 'Plumbing', category: 'MEP' },
  { id: '5', code: '16100', name: 'Electrical', category: 'MEP' },
];

// Employees
export const employees: Employee[] = [
  { id: '1', name: 'Jake Ross', email: 'jake@rossbuilt.com', role: 'Owner', status: 'active' },
  { id: '2', name: 'Mike Johnson', email: 'mike@rossbuilt.com', role: 'Project Manager', status: 'active' },
  { id: '3', name: 'Sarah Chen', email: 'sarah@rossbuilt.com', role: 'Project Manager', status: 'active' },
  { id: '4', name: 'Tom Smith', email: 'tom@rossbuilt.com', role: 'Supervisor', hourlyRate: 35, status: 'active' },
];

// Expenses
export const expenses: Expense[] = [
  { id: '1', date: '2026-01-15', vendorName: 'Verizon', category: 'Software & Tech', description: 'Monthly phone plan', amount: 450, isRecurring: true, frequency: 'monthly' },
  { id: '2', date: '2026-01-10', vendorName: 'State Farm', category: 'Insurance', description: 'General liability', amount: 2800, isRecurring: true, frequency: 'monthly' },
  { id: '3', date: '2026-01-05', vendorName: 'Enterprise', category: 'Fleet', description: 'Truck lease', amount: 1200, isRecurring: true, frequency: 'monthly' },
];

// Dashboard Stats
export const dashboardStats = {
  pendingInvoices: 12,
  approvedThisMonth: 125000,
  openPOs: 45,
  expiringVendors: 3,
  totalRevenue: 3560000,
  netProfitMargin: 18.7,
  activeJobs: 5,
  overheadRate: 42.50,
};

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
