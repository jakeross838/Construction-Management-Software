// =====================================================
// FINANCIAL MODULE TYPES
// Ross Built Construction Management System
// =====================================================

// =====================================================
// INVOICE TYPES
// =====================================================
export type InvoiceStatus = 'received' | 'needs_review' | 'needs_approval' | 'approved' | 'denied' | 'in_draw' | 'paid';

export type NonBillableReason = 'warranty' | 'overhead' | 'rework' | 'goodwill' | 'absorbed' | 'other';

export interface Invoice {
  id: string;
  invoice_number: string;
  vendor_id: string | null;
  vendor_name?: string;
  job_id: string | null;
  job_name?: string;
  po_id: string | null;
  po_number?: string;
  draw_id: string | null;
  parent_invoice_id: string | null;
  amount: number;
  billable_amount: number | null; // null=fully billable, 0=non-billable, partial=split
  non_billable_reason: NonBillableReason | null;
  invoice_date: string;
  due_date: string | null;
  received_date: string | null;
  status: InvoiceStatus;
  pdf_url: string | null;
  pdf_stamped_url: string | null;
  ai_extracted_data: AIExtractedData | null;
  ai_confidence: AIConfidence | null;
  matched_confidence: MatchedConfidence | null;
  needs_review: boolean | null;
  review_flags: string[] | null;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  payment_reference: string | null;
  notes: string | null;
  is_credit: boolean;
  is_split_child: boolean;
  created_at: string;
  updated_at: string;
  allocations?: InvoiceAllocation[];
}

// Helper to get effective billable amount
export function getEffectiveBillableAmount(invoice: Invoice): number {
  return invoice.billable_amount ?? invoice.amount;
}

// Helper to get non-billable amount
export function getNonBillableAmount(invoice: Invoice): number {
  if (invoice.billable_amount === null) return 0;
  return invoice.amount - invoice.billable_amount;
}

export interface AIExtractedData {
  vendor_name?: string;
  job_name?: string;
  amount?: number;
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string;
}

export interface AIConfidence {
  vendor?: number;
  job?: number;
  amount?: number;
  invoice_number?: number;
  date?: number;
}

export interface MatchedConfidence {
  vendor?: number;
  job?: number;
  po?: number;
  overall?: number;
}

export interface InvoiceAllocation {
  id: string;
  invoice_id: string;
  cost_code_id: string | null;
  cost_code?: string;
  cost_code_name?: string;
  amount: number;
  description: string | null;
}

// =====================================================
// PURCHASE ORDER TYPES
// =====================================================
export type POStatus = 'open' | 'closed' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PurchaseOrder {
  id: string;
  po_number: string;
  job_id: string;
  job_name?: string;
  job_address?: string;
  job_client?: string;
  vendor_id: string;
  vendor_name?: string;
  vendor_address?: string;
  vendor_phone?: string;
  vendor_contact?: string;
  vendor_email?: string;
  description: string | null;
  scope_of_work: string | null;
  original_amount: number;
  change_order_amount: number;
  current_amount: number;
  invoiced_amount: number;
  remaining_amount: number;
  status: POStatus;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  line_items?: POLineItem[];
  invoices?: Invoice[];
  change_orders?: ChangeOrder[];
}

export interface POLineItem {
  id: string;
  po_id: string;
  cost_code_id: string | null;
  cost_code?: string;
  cost_code_name?: string;
  title: string | null;
  description: string;
  unit_cost: number;
  quantity: number;
  amount: number;
  invoiced_amount: number;
  sort_order: number;
}

// =====================================================
// DRAW TYPES
// =====================================================
export type DrawStatus = 'draft' | 'submitted' | 'funded';

export interface Draw {
  id: string;
  draw_number: number;
  job_id: string;
  job_name?: string;
  period_start: string;
  period_end: string;
  application_date: string | null;
  total_completed: number;
  current_payment_due: number;
  status: DrawStatus;
  submitted_at: string | null;
  submitted_by: string | null;
  funded_at: string | null;
  funded_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  invoices?: Invoice[];
}

export interface G702Data {
  contract_amount: number;
  change_orders_amount: number;
  total_contract: number;
  completed_previous: number;
  completed_this_period: number;
  total_completed: number;
  percent_complete: number;
  current_payment_due: number;
}

export interface G703LineItem {
  cost_code: string;
  description: string;
  scheduled_value: number;
  previous_applications: number;
  this_period: number;
  materials_stored: number;
  total_completed: number;
  percent_complete: number;
  balance_to_finish: number;
}

// =====================================================
// CHANGE ORDER TYPES
// =====================================================
export type COType = 'addition' | 'deduction' | 'scope_change' | 'unforeseen_condition' | 'additional_scope' | 'upgrade' | 'allowance_adjustment';
export type COStatus = 'draft' | 'pending' | 'approved' | 'rejected';
export type RequestedBy = 'client' | 'builder' | 'architect' | 'designer' | 'engineer';

export interface ChangeOrder {
  id: string;
  co_number: string;
  job_id: string;
  job_name?: string;
  po_id: string | null;
  po_number?: string;
  draw_id: string | null;
  description: string;
  type: COType;
  requested_by: RequestedBy | null;
  subtotal: number;
  markup_percent: number;
  markup_amount: number;
  total_amount: number;
  days_impact: number;
  pm_hours: number;
  pm_hourly_rate: number;
  pm_cost: number;
  status: COStatus;
  client_signature_required: boolean;
  client_signed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  line_items?: COLineItem[];
}

export interface COLineItem {
  id: string;
  change_order_id: string;
  cost_code_id: string | null;
  cost_code?: string;
  cost_code_name?: string;
  description: string;
  amount: number;
  sort_order: number;
}

// =====================================================
// BUDGET TYPES
// =====================================================
export interface BudgetLine {
  id: string;
  job_id: string;
  cost_code_id: string;
  cost_code?: string;
  cost_code_name?: string;
  budgeted_amount: number;
  committed_amount?: number;
  billed_amount?: number;
  paid_amount?: number;
  variance?: number;
  notes: string | null;
}

export interface BudgetSummary {
  total_budgeted: number;
  total_committed: number;
  total_billed: number;
  total_paid: number;
  over_budget_count: number;
  over_budget_amount: number;
}

// =====================================================
// VENDOR & COST CODE TYPES
// =====================================================
export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  insurance_expiry: string | null;
  w9_on_file: boolean;
  notes: string | null;
  status: 'active' | 'inactive' | 'pending';
  created_at: string;
  updated_at: string;
}

export interface CostCode {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

// =====================================================
// JOB TYPE (for database)
// =====================================================
export interface DBJob {
  id: string;
  name: string;
  client: string | null;
  address: string | null;
  contract_amount: number;
  budget_amount: number;
  status: 'pre_construction' | 'active' | 'on_hold' | 'completed' | 'closed';
  percent_complete: number;
  start_date: string | null;
  end_date: string | null;
  actual_end_date: string | null;
  target_margin: number;
  retainage_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  
  // Client Information
  client_email: string | null;
  client_phone: string | null;
  client_cell: string | null;
  
  // Property Details
  square_footage: number | null;
  stories: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  half_baths: number | null;
  garage_spaces: number | null;
  lot_size: number | null;
  
  // Structure Details
  architectural_style: string | null;
  foundation_type: string | null;
  roof_type: string | null;
  exterior_finish: string | null;
  
  // Systems
  hvac_system: string | null;
  electrical_service: string | null;
  plumbing_type: string | null;
  
  // Features
  premium_features: string[] | null;
  
  // Team
  project_manager: string | null;
  site_supervisor: string | null;
  architect: string | null;
  engineer: string | null;
  
  // Additional Info
  permit_number: string | null;
  parcel_id: string | null;
  flood_zone: string | null;
  year_built: number | null;
  construction_type: string | null;
  
  // Supervision Costing
  monthly_supervision_rate: number | null;
}

// =====================================================
// ACTIVITY LOG
// =====================================================
export interface ActivityLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  description: string | null;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// =====================================================
// STATUS CONFIGS
// =====================================================
export const invoiceStatusConfig: Record<InvoiceStatus, { label: string; color: string; bgColor: string }> = {
  received: { label: 'Received', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  needs_review: { label: 'Needs Review', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  needs_approval: { label: 'Needs Approval', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
  denied: { label: 'Denied', color: 'text-red-600', bgColor: 'bg-red-100' },
  in_draw: { label: 'In Draw', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  paid: { label: 'Paid', color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export const poStatusConfig: Record<POStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-green-600', bgColor: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const drawStatusConfig: Record<DrawStatus, { label: string; color: string; bgColor: string; icon: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: '📝' },
  submitted: { label: 'Submitted', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: '📤' },
  funded: { label: 'Funded', color: 'text-green-600', bgColor: 'bg-green-100', icon: '💰' },
};

export const coStatusConfig: Record<COStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const coTypeConfig: Record<COType, { label: string; color: string }> = {
  addition: { label: 'Addition', color: 'text-green-600' },
  deduction: { label: 'Deduction', color: 'text-red-600' },
  scope_change: { label: 'Scope Change', color: 'text-blue-600' },
  unforeseen_condition: { label: 'Unforeseen Condition', color: 'text-orange-600' },
  additional_scope: { label: 'Additional Scope', color: 'text-purple-600' },
  upgrade: { label: 'Upgrade', color: 'text-indigo-600' },
  allowance_adjustment: { label: 'Allowance Adjustment', color: 'text-teal-600' },
};

// =====================================================
// LIEN RELEASE TYPES
// =====================================================
export type LienReleaseType = 'conditional' | 'unconditional';
export type LienReleaseStatus = 'pending' | 'requested' | 'received' | 'waived';

export interface LienRelease {
  id: string;
  draw_id: string;
  vendor_id: string;
  vendor_name?: string;
  job_id: string;
  job_name?: string;
  release_type: LienReleaseType;
  amount: number;
  through_date: string | null;
  received_at: string | null;
  received_by: string | null;
  document_url: string | null;
  status: LienReleaseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateShort(dateString: string | null): string {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

export function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high': return 'text-green-600';
    case 'medium': return 'text-amber-600';
    case 'low': return 'text-red-600';
  }
}
