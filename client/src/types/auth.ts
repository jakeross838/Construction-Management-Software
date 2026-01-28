// Role-based access control for Ross Built CMS

export type UserRole = 'owner' | 'admin' | 'accounting' | 'pm' | 'supervisor' | 'office' | 'field_crew';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
}

export const roleDisplayNames: Record<UserRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  accounting: 'Accounting',
  pm: 'Project Manager',
  supervisor: 'Supervisor',
  office: 'Office',
  field_crew: 'Field Crew',
};

export const rolePermissions = {
  owner: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true,
  },
  admin: {
    canViewAllJobs: true, canCreateJobs: true, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: true, canViewLeads: true, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: true, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: true,
  },
  accounting: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: true, canManageExpenses: true,
    canViewProfitability: true, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: true, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: true, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false,
  },
  pm: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: true, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: true, canCreatePO: true, canSubmitDraw: true,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: true, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
  supervisor: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: true,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: true, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
  office: {
    canViewAllJobs: true, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: false,
    canUploadFiles: false, canViewSettings: false,
  },
  field_crew: {
    canViewAllJobs: false, canCreateJobs: false, canViewFinancials: false, canManageExpenses: false,
    canViewProfitability: false, canApproveInvoices: false, canCreatePO: false, canSubmitDraw: false,
    canManageVendors: false, canManageEmployees: false, canViewLeads: false, canViewEstimates: false,
    canGenerateProposals: false, canViewContracts: false, canEditSchedule: false, canSubmitDailyLog: true,
    canUploadFiles: true, canViewSettings: false,
  },
} as const;

export type Permission = keyof typeof rolePermissions.owner;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.[permission] ?? false;
}

export const mockUser: User = {
  id: '1',
  name: 'Jake Ross',
  email: 'jake@rossbuilt.com',
  role: 'owner',
};
