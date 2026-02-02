import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
export interface XeroConnectionStatus {
  connected: boolean;
  organizationName?: string;
  tenantId?: string;
  lastSyncAt?: string;
  syncEnabled?: boolean;
  tokenValid?: boolean;
  needsReauth?: boolean;
}

export interface XeroSettings {
  id?: string;
  builder_id?: string;
  auto_sync_enabled: boolean;
  sync_frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  sync_contacts: boolean;
  sync_bills: boolean;
  sync_payments: boolean;
  sync_jobs_as_tracking: boolean;
  default_expense_account_code?: string;
  default_ap_account_code?: string;
  use_po_numbers_as_ref: boolean;
}

export interface XeroAccount {
  AccountID: string;
  Code: string;
  Name: string;
  Type: string;
  Status: string;
}

export interface XeroTrackingCategory {
  TrackingCategoryID: string;
  Name: string;
  Status: string;
  Options?: Array<{
    TrackingOptionID: string;
    Name: string;
  }>;
}

export interface XeroAccountMapping {
  id: string;
  cost_code_id: string;
  xero_account_id?: string;
  xero_account_code?: string;
  xero_account_name?: string;
  xero_tracking_category_id?: string;
  xero_tracking_option_id?: string;
  cost_code?: {
    id: string;
    code: string;
    name: string;
    category?: string;
  };
}

export interface XeroSyncLog {
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
async function fetchConnectionStatus(): Promise<XeroConnectionStatus> {
  const response = await fetch('/api/xero/status');
  if (!response.ok) throw new Error('Failed to fetch Xero status');
  return response.json();
}

async function fetchSettings(): Promise<XeroSettings | null> {
  const response = await fetch('/api/xero/settings');
  if (!response.ok) throw new Error('Failed to fetch Xero settings');
  const data = await response.json();
  return data.settings;
}

async function updateSettings(settings: Partial<XeroSettings>): Promise<XeroSettings> {
  const response = await fetch('/api/xero/settings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) throw new Error('Failed to update Xero settings');
  const data = await response.json();
  return data.settings;
}

async function disconnectXero(): Promise<void> {
  const response = await fetch('/api/xero/disconnect', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to disconnect Xero');
}

async function fetchAccounts(): Promise<XeroAccount[]> {
  const response = await fetch('/api/xero/accounts');
  if (!response.ok) throw new Error('Failed to fetch Xero accounts');
  const data = await response.json();
  return data.accounts;
}

async function fetchTrackingCategories(): Promise<XeroTrackingCategory[]> {
  const response = await fetch('/api/xero/tracking-categories');
  if (!response.ok) throw new Error('Failed to fetch tracking categories');
  const data = await response.json();
  return data.categories;
}

async function fetchMappings(): Promise<XeroAccountMapping[]> {
  const response = await fetch('/api/xero/mappings');
  if (!response.ok) throw new Error('Failed to fetch account mappings');
  const data = await response.json();
  return data.mappings;
}

async function createMapping(mapping: {
  cost_code_id: string;
  xero_account_id?: string;
  xero_account_code?: string;
  xero_account_name?: string;
  xero_tracking_category_id?: string;
  xero_tracking_option_id?: string;
}): Promise<XeroAccountMapping> {
  const response = await fetch('/api/xero/mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mapping),
  });
  if (!response.ok) throw new Error('Failed to create account mapping');
  const data = await response.json();
  return data.mapping;
}

async function syncContacts(): Promise<{ success: boolean; created: number; updated: number; failed: number }> {
  const response = await fetch('/api/xero/sync/contacts', { method: 'POST' });
  if (!response.ok) throw new Error('Failed to sync contacts');
  return response.json();
}

async function syncInvoice(invoiceId: string): Promise<{ success: boolean; xero_bill_id: string }> {
  const response = await fetch(`/api/xero/sync/invoice/${invoiceId}`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to sync invoice');
  return response.json();
}

async function fetchSyncLog(limit = 50): Promise<XeroSyncLog[]> {
  const response = await fetch(`/api/xero/sync/log?limit=${limit}`);
  if (!response.ok) throw new Error('Failed to fetch sync log');
  const data = await response.json();
  return data.logs;
}

// Hooks
export function useXeroStatus() {
  return useQuery({
    queryKey: ['xero-status'],
    queryFn: fetchConnectionStatus,
    refetchInterval: 60000,
  });
}

export function useXeroSettings() {
  return useQuery({
    queryKey: ['xero-settings'],
    queryFn: fetchSettings,
  });
}

export function useUpdateXeroSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-settings'] });
    },
  });
}

export function useDisconnectXero() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectXero,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-status'] });
      queryClient.invalidateQueries({ queryKey: ['xero-settings'] });
    },
  });
}

export function useXeroAccounts() {
  const { data: status } = useXeroStatus();
  return useQuery({
    queryKey: ['xero-accounts'],
    queryFn: fetchAccounts,
    enabled: status?.connected === true,
  });
}

export function useXeroTrackingCategories() {
  const { data: status } = useXeroStatus();
  return useQuery({
    queryKey: ['xero-tracking-categories'],
    queryFn: fetchTrackingCategories,
    enabled: status?.connected === true,
  });
}

export function useXeroMappings() {
  return useQuery({
    queryKey: ['xero-mappings'],
    queryFn: fetchMappings,
  });
}

export function useCreateXeroMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-mappings'] });
    },
  });
}

export function useSyncContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncContacts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-sync-log'] });
    },
  });
}

export function useSyncXeroInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['xero-sync-log'] });
    },
  });
}

export function useXeroSyncLog(limit = 50) {
  return useQuery({
    queryKey: ['xero-sync-log', limit],
    queryFn: () => fetchSyncLog(limit),
  });
}

export function getXeroConnectUrl(): string {
  return '/api/xero/connect';
}
