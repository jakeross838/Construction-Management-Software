import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost, apiPatch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface ProcoreSyncSettings {
  sync_jobs: boolean;
  sync_vendors: boolean;
  sync_rfis: boolean;
  sync_submittals: boolean;
  sync_frequency: 'realtime' | 'hourly' | 'daily' | 'manual';
  auto_sync_enabled: boolean;
}

export interface ProcoreConnectionStatus {
  connected: boolean;
  companyId?: string;
  companyName?: string;
  enabled?: boolean;
  lastSyncAt?: string;
  syncSettings?: ProcoreSyncSettings;
  tokenValid?: boolean;
  needsReauth?: boolean;
}

export interface ProcoreIntegration {
  id: string;
  builder_id: string;
  company_id: string;
  company_name?: string;
  enabled: boolean;
  last_sync_at?: string;
  sync_settings: ProcoreSyncSettings;
  created_at: string;
  updated_at: string;
}

export interface ProcoreSyncLog {
  id: string;
  integration_id: string;
  builder_id: string;
  sync_type: 'jobs' | 'vendors' | 'rfis' | 'submittals' | 'full';
  direction: 'import' | 'export' | 'bidirectional';
  status: 'pending' | 'in_progress' | 'success' | 'failed';
  records_synced: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  errors?: { errors: Array<{ error: string; [key: string]: unknown }> };
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ProcoreEntityMapping {
  id: string;
  builder_id: string;
  entity_type: 'job' | 'vendor' | 'rfi' | 'submittal' | 'document';
  local_id: string;
  procore_id: string;
  procore_project_id?: string;
  last_synced_at?: string;
  sync_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  failed: number;
  errors?: Array<{ error: string; [key: string]: unknown }>;
}

export interface FullSyncResult {
  success: boolean;
  type: string;
  result: {
    jobs?: SyncResult | { error: string };
    vendors?: SyncResult | { error: string };
    rfis?: SyncResult | { error: string };
    submittals?: SyncResult | { error: string };
    totalSynced: number;
    totalCreated: number;
    totalUpdated: number;
    totalFailed: number;
  };
}

// ============================================================
// API FUNCTIONS
// ============================================================

const API_BASE = '/api/integrations/procore';

async function fetchConnectionStatus(): Promise<ProcoreConnectionStatus> {
  const response = await apiFetch(`${API_BASE}/status`);
  if (!response.ok) throw new Error('Failed to fetch Procore status');
  return response.json();
}

async function fetchAuthUrl(): Promise<{ url: string }> {
  const response = await apiFetch(`${API_BASE}/auth-url`);
  if (!response.ok) throw new Error('Failed to get Procore auth URL');
  return response.json();
}

async function disconnectProcore(): Promise<void> {
  const response = await apiPost(`${API_BASE}/disconnect`);
  if (!response.ok) throw new Error('Failed to disconnect Procore');
}

async function updateSettings(settings: {
  sync_settings?: Partial<ProcoreSyncSettings>;
  enabled?: boolean;
}): Promise<{ settings: ProcoreIntegration }> {
  const response = await apiPatch(`${API_BASE}/settings`, settings);
  if (!response.ok) throw new Error('Failed to update Procore settings');
  return response.json();
}

async function triggerSync(options: {
  type?: 'jobs' | 'vendors' | 'rfis' | 'submittals' | 'full';
  job_id?: string;
}): Promise<FullSyncResult> {
  const response = await apiPost(`${API_BASE}/sync`, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Sync failed');
  }
  return response.json();
}

async function syncJobs(): Promise<SyncResult> {
  const response = await apiPost(`${API_BASE}/sync/jobs`);
  if (!response.ok) throw new Error('Failed to sync jobs');
  return response.json();
}

async function syncVendors(): Promise<SyncResult> {
  const response = await apiPost(`${API_BASE}/sync/vendors`);
  if (!response.ok) throw new Error('Failed to sync vendors');
  return response.json();
}

async function syncRFIs(jobId?: string): Promise<SyncResult> {
  const response = await apiPost(`${API_BASE}/sync/rfis`, { job_id: jobId });
  if (!response.ok) throw new Error('Failed to sync RFIs');
  return response.json();
}

async function syncSubmittals(jobId?: string): Promise<SyncResult> {
  const response = await apiPost(`${API_BASE}/sync/submittals`, { job_id: jobId });
  if (!response.ok) throw new Error('Failed to sync submittals');
  return response.json();
}

async function fetchSyncLog(options?: {
  limit?: number;
  type?: string;
}): Promise<ProcoreSyncLog[]> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.type) params.set('type', options.type);

  const url = `${API_BASE}/log${params.toString() ? `?${params}` : ''}`;
  const response = await apiFetch(url);
  if (!response.ok) throw new Error('Failed to fetch sync log');
  const data = await response.json();
  return data.logs;
}

async function fetchMappings(options?: {
  entity_type?: string;
  limit?: number;
}): Promise<ProcoreEntityMapping[]> {
  const params = new URLSearchParams();
  if (options?.entity_type) params.set('entity_type', options.entity_type);
  if (options?.limit) params.set('limit', String(options.limit));

  const url = `${API_BASE}/mappings${params.toString() ? `?${params}` : ''}`;
  const response = await apiFetch(url);
  if (!response.ok) throw new Error('Failed to fetch mappings');
  const data = await response.json();
  return data.mappings;
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Hook to get Procore connection status
 */
export function useProcoreStatus() {
  return useQuery({
    queryKey: ['procore-status'],
    queryFn: fetchConnectionStatus,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook to get Procore auth URL for connecting
 */
export function useProcoreAuthUrl() {
  return useQuery({
    queryKey: ['procore-auth-url'],
    queryFn: fetchAuthUrl,
    enabled: false, // Only fetch when needed
  });
}

/**
 * Hook to disconnect Procore
 */
export function useDisconnectProcore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectProcore,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-status'] });
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['procore-mappings'] });
    },
  });
}

/**
 * Hook to update Procore settings
 */
export function useUpdateProcoreSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-status'] });
    },
  });
}

/**
 * Hook to trigger a sync operation
 */
export function useProcoreSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-status'] });
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['procore-mappings'] });
      // Also invalidate related data
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
    },
  });
}

/**
 * Hook to sync jobs specifically
 */
export function useSyncProcoreJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncJobs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

/**
 * Hook to sync vendors specifically
 */
export function useSyncProcoreVendors() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncVendors,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
    },
  });
}

/**
 * Hook to sync RFIs specifically
 */
export function useSyncProcoreRFIs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncRFIs,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
    },
  });
}

/**
 * Hook to sync submittals specifically
 */
export function useSyncProcoreSubmittals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSubmittals,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procore-sync-log'] });
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
    },
  });
}

/**
 * Hook to get Procore sync history
 */
export function useProcoreSyncLog(options?: { limit?: number; type?: string }) {
  return useQuery({
    queryKey: ['procore-sync-log', options],
    queryFn: () => fetchSyncLog(options),
  });
}

/**
 * Hook to get entity mappings
 */
export function useProcoreMappings(options?: { entity_type?: string; limit?: number }) {
  return useQuery({
    queryKey: ['procore-mappings', options],
    queryFn: () => fetchMappings(options),
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get the URL to connect Procore (for use in onClick handlers)
 */
export function getProcoreConnectUrl(): string {
  return `${API_BASE}/connect`;
}

/**
 * Check if Procore is configured (has client credentials)
 * This is a client-side check - actual availability is determined by the server
 */
export function isProcoreAvailable(): boolean {
  // On the client side, we can't check env vars
  // The status endpoint will return appropriate errors if not configured
  return true;
}

/**
 * Format sync result for display
 */
export function formatSyncResult(result: SyncResult): string {
  const parts: string[] = [];
  if (result.created > 0) parts.push(`${result.created} created`);
  if (result.updated > 0) parts.push(`${result.updated} updated`);
  if (result.failed > 0) parts.push(`${result.failed} failed`);
  return parts.length > 0 ? parts.join(', ') : 'No changes';
}

/**
 * Get sync status badge color
 */
export function getSyncStatusColor(status: ProcoreSyncLog['status']): string {
  switch (status) {
    case 'success':
      return 'green';
    case 'failed':
      return 'red';
    case 'in_progress':
      return 'blue';
    case 'pending':
    default:
      return 'gray';
  }
}
