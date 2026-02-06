import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api';

// Types
export interface QBOConnectionStatus {
  connected: boolean;
  companyName?: string;
  realmId?: string;
  isSandbox?: boolean;
  lastSyncAt?: string;
  syncEnabled?: boolean;
  tokenValid?: boolean;
  needsReauth?: boolean;
}

export interface QBOSettings {
  id?: string;
  builder_id?: string;
  auto_sync_enabled: boolean;
  sync_frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  sync_vendors: boolean;
  sync_bills: boolean;
  sync_payments: boolean;
  sync_jobs_as_customers: boolean;
  sync_jobs_as_classes: boolean;
  default_expense_account_id?: string;
  default_ap_account_id?: string;
  use_po_numbers_as_ref: boolean;
}

export interface QBOAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  FullyQualifiedName?: string;
}

export interface QBOClass {
  Id: string;
  Name: string;
  FullyQualifiedName?: string;
}

export interface QBOAccountMapping {
  id: string;
  cost_code_id: string;
  qbo_expense_account_id?: string;
  qbo_expense_account_name?: string;
  qbo_class_id?: string;
  qbo_class_name?: string;
  cost_code?: {
    id: string;
    code: string;
    name: string;
    category?: string;
  };
}

export interface QBOSyncLog {
  id: string;
  sync_type: string;
  entity_type?: string;
  direction?: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// API Functions
async function fetchConnectionStatus(): Promise<QBOConnectionStatus> {
  const response = await apiGet('/api/quickbooks/status');
  if (!response.ok) throw new Error('Failed to fetch QuickBooks status');
  return response.json();
}

async function fetchSettings(): Promise<QBOSettings | null> {
  const response = await apiGet('/api/quickbooks/settings');
  if (!response.ok) throw new Error('Failed to fetch QuickBooks settings');
  const data = await response.json();
  return data.settings;
}

async function updateSettings(settings: Partial<QBOSettings>): Promise<QBOSettings> {
  const response = await apiPatch('/api/quickbooks/settings', settings);
  if (!response.ok) throw new Error('Failed to update QuickBooks settings');
  const data = await response.json();
  return data.settings;
}

async function disconnectQuickBooks(): Promise<void> {
  const response = await apiPost('/api/quickbooks/disconnect');
  if (!response.ok) throw new Error('Failed to disconnect QuickBooks');
}

async function fetchAccounts(): Promise<QBOAccount[]> {
  const response = await apiGet('/api/quickbooks/accounts');
  if (!response.ok) throw new Error('Failed to fetch QuickBooks accounts');
  const data = await response.json();
  return data.accounts;
}

async function fetchClasses(): Promise<QBOClass[]> {
  const response = await apiGet('/api/quickbooks/classes');
  if (!response.ok) throw new Error('Failed to fetch QuickBooks classes');
  const data = await response.json();
  return data.classes;
}

async function fetchMappings(): Promise<QBOAccountMapping[]> {
  const response = await apiGet('/api/quickbooks/mappings');
  if (!response.ok) throw new Error('Failed to fetch account mappings');
  const data = await response.json();
  return data.mappings;
}

async function createMapping(mapping: {
  cost_code_id: string;
  qbo_expense_account_id?: string;
  qbo_expense_account_name?: string;
  qbo_class_id?: string;
  qbo_class_name?: string;
}): Promise<QBOAccountMapping> {
  const response = await apiPost('/api/quickbooks/mappings', mapping);
  if (!response.ok) throw new Error('Failed to create account mapping');
  const data = await response.json();
  return data.mapping;
}

async function syncVendors(): Promise<{ success: boolean; created: number; updated: number; failed: number }> {
  const response = await apiPost('/api/quickbooks/sync/vendors');
  if (!response.ok) throw new Error('Failed to sync vendors');
  return response.json();
}

async function syncInvoice(invoiceId: string): Promise<{ success: boolean; qbo_bill_id: string }> {
  const response = await apiPost(`/api/quickbooks/sync/invoice/${invoiceId}`);
  if (!response.ok) throw new Error('Failed to sync invoice');
  return response.json();
}

async function fetchSyncLog(limit = 50): Promise<QBOSyncLog[]> {
  const response = await apiGet(`/api/quickbooks/sync/log?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch sync log');
  const data = await response.json();
  return data.logs;
}

// Hooks
export function useQuickBooksStatus() {
  return useQuery({
    queryKey: ['quickbooks-status'],
    queryFn: fetchConnectionStatus,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useQuickBooksSettings() {
  return useQuery({
    queryKey: ['quickbooks-settings'],
    queryFn: fetchSettings,
  });
}

export function useUpdateQuickBooksSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-settings'] });
    },
  });
}

export function useDisconnectQuickBooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectQuickBooks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-status'] });
      queryClient.invalidateQueries({ queryKey: ['quickbooks-settings'] });
    },
  });
}

export function useQuickBooksAccounts() {
  const { data: status } = useQuickBooksStatus();
  return useQuery({
    queryKey: ['quickbooks-accounts'],
    queryFn: fetchAccounts,
    enabled: status?.connected === true,
  });
}

export function useQuickBooksClasses() {
  const { data: status } = useQuickBooksStatus();
  return useQuery({
    queryKey: ['quickbooks-classes'],
    queryFn: fetchClasses,
    enabled: status?.connected === true,
  });
}

export function useQuickBooksMappings() {
  return useQuery({
    queryKey: ['quickbooks-mappings'],
    queryFn: fetchMappings,
  });
}

export function useCreateQuickBooksMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-mappings'] });
    },
  });
}

export function useSyncVendors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncVendors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-log'] });
    },
  });
}

export function useSyncInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quickbooks-sync-log'] });
    },
  });
}

export function useQuickBooksSyncLog(limit = 50) {
  return useQuery({
    queryKey: ['quickbooks-sync-log', limit],
    queryFn: () => fetchSyncLog(limit),
  });
}

// Helper function to get QuickBooks connect URL
export function getQuickBooksConnectUrl(): string {
  return '/api/quickbooks/connect';
}
