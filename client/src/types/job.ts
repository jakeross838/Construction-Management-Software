// Job-related types for Ross Built CMS

export type JobStatus = 'active' | 'completed' | 'on-hold' | 'planning' | 'pre_construction';

export interface Job {
  id: string;
  name: string;
  address: string;
  client: string;
  status: JobStatus;
  budget: number;
  spent: number;
  laborHours: number;
  estimatedHours: number;
  startDate: string;
  targetCompletion: string;
  margin: number;
  phase: string;
  contractAmount?: number;
  percentComplete?: number;
  pmName?: string;
  supervisorName?: string;
}

export interface CostCategory {
  id: string;
  name: string;
  budgeted: number;
  actual: number;
  committed: number;
}

export interface ChangeOrder {
  id: string;
  number: string;
  description: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: string;
  approvedDate?: string;
}

export interface TimeEntry {
  id: string;
  jobId: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: number;
  hourlyRate: number;
  burdenRate: number;
  costCode: string;
  description: string;
}

export interface JobDocument {
  id: string;
  jobId: string;
  name: string;
  type: 'contract' | 'permit' | 'drawing' | 'photo' | 'invoice' | 'other';
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  size: number;
}

export interface JobNote {
  id: string;
  jobId: string;
  author: string;
  authorRole: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
}

export interface JobActivity {
  id: string;
  jobId: string;
  type: 'status_change' | 'cost_update' | 'time_entry' | 'document_upload' | 'note_added' | 'change_order';
  description: string;
  user: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// Invoice types
export type InvoiceStatus = 'received' | 'needs_review' | 'needs_approval' | 'approved' | 'in_draw' | 'paid' | 'denied';

export interface Invoice {
  id: string;
  jobId: string;
  jobName: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  status: InvoiceStatus;
  poId?: string;
  poNumber?: string;
  notes?: string;
  createdAt: string;
}

// Purchase Order types
export type POStatus = 'draft' | 'pending' | 'approved' | 'open' | 'closed';

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  jobId: string;
  jobName: string;
  vendorId: string;
  vendorName: string;
  description: string;
  totalAmount: number;
  invoicedAmount: number;
  remainingAmount: number;
  status: POStatus;
  lineItems: POLineItem[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}

export interface POLineItem {
  id: string;
  costCodeId: string;
  costCode: string;
  costCodeName: string;
  description: string;
  amount: number;
  invoicedAmount: number;
}

// Draw types
export type DrawStatus = 'draft' | 'pending' | 'submitted' | 'funded';

export interface Draw {
  id: string;
  jobId: string;
  jobName: string;
  drawNumber: number;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: DrawStatus;
  invoices: Invoice[];
  g703?: G703Line[];
  createdAt: string;
  submittedAt?: string;
  fundedAt?: string;
  fundedAmount?: number;
}

export interface G703Line {
  id: string;
  costCode: string;
  description: string;
  scheduledValue: number;
  previousBillings: number;
  currentBillings: number;
  totalBilled: number;
  percentComplete: number;
  balanceRemaining: number;
  retainage: number;
}

// Vendor types
export type VendorStatus = 'active' | 'expiring' | 'expired';

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  trade?: string;
  status: VendorStatus;
  insuranceExpiry?: string;
  licenseExpiry?: string;
  w9OnFile?: boolean;
  scorecard?: { quality: number; reliability: number; speed: number; overall: number };
}

// Lead types
export type LeadStage = 'new_inquiry' | 'qualifying' | 'site_visit' | 'estimating' | 'proposal_sent' | 'negotiating' | 'won' | 'lost';

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  source: 'referral' | 'website' | 'zillow' | 'social' | 'other';
  estimatedValue: number;
  stage: LeadStage;
  daysInStage: number;
  createdAt: string;
}

export interface CostCode {
  id: string;
  code: string;
  name: string;
  category: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  burdenClass?: string;
  hourlyRate?: number;
  status: 'active' | 'inactive';
}

export interface Expense {
  id: string;
  date: string;
  vendorName?: string;
  category: string;
  description?: string;
  amount: number;
  isRecurring: boolean;
  frequency?: 'monthly' | 'quarterly' | 'annual';
}

export interface DailyLog {
  id: string;
  jobId: string;
  date: string;
  weather: string;
  workPerformed: string;
  createdBy: string;
  createdAt: string;
}

export interface Task {
  id: string;
  jobId: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
}

export interface ScheduleTask {
  id: string;
  jobId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export const statusConfig = {
  active: { label: 'Active', class: 'status-badge-success' },
  completed: { label: 'Completed', class: 'status-badge-info' },
  'on-hold': { label: 'On Hold', class: 'status-badge-warning' },
  planning: { label: 'Planning', class: 'status-badge-neutral' },
  pre_construction: { label: 'Pre-Con', class: 'status-badge-purple' },
};

export function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCurrencyFull(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
