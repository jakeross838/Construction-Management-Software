// Comprehensive Estimating Types for Residential Construction

export type EstimateStatus = 'draft' | 'pending_review' | 'sent' | 'approved' | 'declined' | 'expired' | 'converted';

export type LineItemType = 'material' | 'labor' | 'subcontractor' | 'equipment' | 'other';

export type MarkupType = 'percentage' | 'fixed';

export interface EstimateLineItem {
  id: string;
  costCodeId?: string;
  costCode?: string;
  category: string;
  description: string;
  type: LineItemType;
  quantity: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  markup: number;
  markupType: MarkupType;
  totalWithMarkup: number;
  notes?: string;
  assemblyId?: string;
  sortOrder: number;
}

// Subgroup contains line items (lowest level)
export interface EstimateSubgroup {
  id: string;
  name: string;
  description?: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
  subtotalWithMarkup: number;
  sortOrder: number;
}

// Group contains subgroups
export interface EstimateGroup {
  id: string;
  name: string;
  description?: string;
  subgroups: EstimateSubgroup[];
  subtotal: number;
  subtotalWithMarkup: number;
  sortOrder: number;
}

// Section contains groups (top level)
export interface EstimateSection {
  id: string;
  name: string;
  description?: string;
  // New hierarchical structure
  groups: EstimateGroup[];
  // Legacy support - direct line items (will be migrated to groups/subgroups)
  lineItems?: EstimateLineItem[];
  subtotal: number;
  subtotalWithMarkup: number;
  sortOrder: number;
}

// Type for legacy sections that only have lineItems (for migration)
export interface LegacyEstimateSection {
  id: string;
  name: string;
  description?: string;
  lineItems: EstimateLineItem[];
  subtotal: number;
  subtotalWithMarkup: number;
  sortOrder: number;
}

// Helper to check if section needs migration
export function sectionNeedsMigration(section: EstimateSection | LegacyEstimateSection): section is LegacyEstimateSection {
  return !('groups' in section) || !section.groups || section.groups.length === 0;
}

export interface Assembly {
  id: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  lineItems: Omit<EstimateLineItem, 'id' | 'totalCost' | 'totalWithMarkup' | 'sortOrder'>[];
  totalCostPerUnit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EstimateMarkupSettings {
  materialMarkup: number;
  laborMarkup: number;
  subcontractorMarkup: number;
  equipmentMarkup: number;
  overheadPercent: number;
  profitPercent: number;
  contingencyPercent: number;
}

export interface Estimate {
  id: string;
  number: string;
  version: number;
  parentEstimateId?: string;
  jobId?: string;
  
  // Client & Project Info
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  projectName: string;
  projectAddress?: string;
  projectDescription: string;
  projectSquareFeet?: number;
  projectType: 'new_construction' | 'remodel' | 'addition' | 'renovation' | 'other';
  
  // Status & Dates
  status: EstimateStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  expiresAt?: string;
  approvedAt?: string;
  convertedToJobId?: string;
  
  // Cost Breakdown
  sections: EstimateSection[];
  
  // Totals
  subtotalMaterial: number;
  subtotalLabor: number;
  subtotalSubcontractor: number;
  subtotalEquipment: number;
  subtotalOther: number;
  subtotalDirect: number;
  
  // Markups & Additions
  markupSettings: EstimateMarkupSettings;
  overheadAmount: number;
  profitAmount: number;
  contingencyAmount: number;
  
  // Final Totals
  totalBeforeContingency: number;
  totalAmount: number;
  
  // Allowances (client selections not yet finalized)
  allowances: EstimateAllowance[];
  totalAllowances: number;
  
  // Exclusions & Clarifications
  exclusions: string[];
  clarifications: string[];
  termsAndConditions?: string;
  
  // Metadata
  createdBy: string;
  assignedTo?: string;
  leadId?: string;
  notes?: string;
}

export interface EstimateAllowance {
  id: string;
  category: string;
  description: string;
  amount: number;
  notes?: string;
}

export interface TakeoffItem {
  id: string;
  estimateId: string;
  name: string;
  quantity: number;
  unit: string;
  length?: number;
  width?: number;
  height?: number;
  area?: number;
  volume?: number;
  notes?: string;
  linkedLineItemIds: string[];
}

// Default markup settings based on industry standards
export const defaultMarkupSettings: EstimateMarkupSettings = {
  materialMarkup: 15,
  laborMarkup: 35,
  subcontractorMarkup: 10,
  equipmentMarkup: 15,
  overheadPercent: 12,
  profitPercent: 10,
  contingencyPercent: 5,
};

// Common units for construction
export const commonUnits = [
  { value: 'ea', label: 'Each' },
  { value: 'lf', label: 'Linear Feet' },
  { value: 'sf', label: 'Square Feet' },
  { value: 'sy', label: 'Square Yards' },
  { value: 'cf', label: 'Cubic Feet' },
  { value: 'cy', label: 'Cubic Yards' },
  { value: 'hrs', label: 'Hours' },
  { value: 'days', label: 'Days' },
  { value: 'ls', label: 'Lump Sum' },
  { value: 'lot', label: 'Lot' },
  { value: 'bf', label: 'Board Feet' },
  { value: 'gal', label: 'Gallons' },
  { value: 'ton', label: 'Tons' },
  { value: 'lb', label: 'Pounds' },
];

export const projectTypes = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'addition', label: 'Addition' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'other', label: 'Other' },
];

export const lineItemTypes: { value: LineItemType; label: string; color: string }[] = [
  { value: 'material', label: 'Material', color: 'blue' },
  { value: 'labor', label: 'Labor', color: 'green' },
  { value: 'subcontractor', label: 'Subcontractor', color: 'purple' },
  { value: 'equipment', label: 'Equipment', color: 'amber' },
  { value: 'other', label: 'Other', color: 'gray' },
];

export const estimateStatusConfig: Record<EstimateStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  draft: { label: 'Draft', variant: 'secondary', color: 'gray' },
  pending_review: { label: 'Pending Review', variant: 'outline', color: 'amber' },
  sent: { label: 'Sent', variant: 'default', color: 'blue' },
  approved: { label: 'Approved', variant: 'default', color: 'green' },
  declined: { label: 'Declined', variant: 'destructive', color: 'red' },
  expired: { label: 'Expired', variant: 'outline', color: 'gray' },
  converted: { label: 'Converted to Job', variant: 'default', color: 'purple' },
};

// Utility functions
export function calculateLineItemTotal(item: Pick<EstimateLineItem, 'quantity' | 'unitCost'>): number {
  return item.quantity * item.unitCost;
}

export function calculateMarkup(
  amount: number, 
  markup: number, 
  markupType: MarkupType
): number {
  if (markupType === 'percentage') {
    return amount * (markup / 100);
  }
  return markup;
}

export function calculateLineItemWithMarkup(item: EstimateLineItem): number {
  const total = item.quantity * item.unitCost;
  const markupAmount = calculateMarkup(total, item.markup, item.markupType);
  return total + markupAmount;
}

export function calculateSubgroupTotals(subgroup: EstimateSubgroup): { subtotal: number; subtotalWithMarkup: number } {
  const subtotal = subgroup.lineItems.reduce((sum, item) => sum + item.totalCost, 0);
  const subtotalWithMarkup = subgroup.lineItems.reduce((sum, item) => sum + item.totalWithMarkup, 0);
  return { subtotal, subtotalWithMarkup };
}

export function calculateGroupTotals(group: EstimateGroup): { subtotal: number; subtotalWithMarkup: number } {
  const subtotal = group.subgroups.reduce((sum, sg) => sum + sg.subtotal, 0);
  const subtotalWithMarkup = group.subgroups.reduce((sum, sg) => sum + sg.subtotalWithMarkup, 0);
  return { subtotal, subtotalWithMarkup };
}

export function calculateSectionTotals(section: EstimateSection): { subtotal: number; subtotalWithMarkup: number } {
  const subtotal = section.groups.reduce((sum, g) => sum + g.subtotal, 0);
  const subtotalWithMarkup = section.groups.reduce((sum, g) => sum + g.subtotalWithMarkup, 0);
  return { subtotal, subtotalWithMarkup };
}

// Helper to get all line items from a section (across all groups/subgroups)
export function getAllLineItemsFromSection(section: EstimateSection): EstimateLineItem[] {
  return section.groups.flatMap(g => g.subgroups.flatMap(sg => sg.lineItems));
}

// Helper to generate unique IDs
export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrencyEstimate(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return formatCurrencyEstimate(amount);
}

export function generateEstimateNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `EST-${year}-${String(sequence).padStart(3, '0')}`;
}
