/**
 * Retainage Management Hooks
 * Handles retainage tracking and release operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

export interface RetainageSummary {
  job_id: string;
  job_name: string;
  total_retainage_held: number;
  total_retainage_released: number;
  retainage_balance: number;
  retainage_by_cost_code: RetainageByCostCode[];
  retainage_by_vendor: RetainageByVendor[];
}

export interface RetainageByCostCode {
  cost_code_id: string;
  cost_code: string;
  cost_code_name: string;
  retainage_held: number;
  retainage_released: number;
  balance: number;
}

export interface RetainageByVendor {
  vendor_id: string;
  vendor_name: string;
  retainage_held: number;
  retainage_released: number;
  balance: number;
}

export interface RetainageDetail {
  cost_code_id: string;
  cost_code: string;
  cost_code_name: string;
  vendor_id: string | null;
  vendor_name: string | null;
  total_invoiced: number;
  avg_retainage_percent: number;
  retainage_held: number;
  retainage_released: number;
  balance: number;
  invoice_count: number;
}

export interface RetainageDetails {
  job_id: string;
  job_name: string;
  details: RetainageDetail[];
}

export interface RetainageRelease {
  id: string;
  builder_id: string | null;
  job_id: string;
  vendor_id: string | null;
  cost_code_id: string | null;
  amount: number;
  release_date: string;
  invoice_id: string | null;
  client_invoice_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  vendor?: { id: string; name: string } | null;
  cost_code?: { id: string; code: string; name: string } | null;
  invoice?: { id: string; invoice_number: string; amount: number; vendor?: { name: string } } | null;
  client_invoice?: { id: string; invoice_number: string; amount: number } | null;
  job?: { id: string; name: string } | null;
  activity?: RetainageReleaseActivity[];
}

export interface RetainageReleaseActivity {
  id: string;
  release_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface RetainageReleasesResponse {
  job_id: string;
  job_name: string;
  total_released: number;
  release_count: number;
  releases: RetainageRelease[];
}

export interface RetainageStats {
  total_retainage_held: number;
  total_retainage_released: number;
  retainage_balance: number;
  job_count: number;
}

export interface CreateRetainageReleaseInput {
  job_id: string;
  vendor_id?: string;
  cost_code_id?: string;
  amount: number;
  release_date?: string;
  invoice_id?: string;
  client_invoice_id?: string;
  notes?: string;
  created_by?: string;
}

export interface UpdateRetainageReleaseInput {
  id: string;
  amount?: number;
  release_date?: string;
  notes?: string;
  invoice_id?: string | null;
  client_invoice_id?: string | null;
  updated_by?: string;
}

// ============================================================
// API HELPER
// ============================================================

async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// SUMMARY HOOKS
// ============================================================

/**
 * Get retainage summary for a job
 */
export function useJobRetainage(jobId: string) {
  return useQuery({
    queryKey: ['retainage', 'summary', jobId],
    queryFn: () => api<RetainageSummary>(`/retainage/job/${jobId}`),
    enabled: !!jobId,
  });
}

/**
 * Get detailed retainage breakdown for a job
 */
export function useJobRetainageDetails(jobId: string) {
  return useQuery({
    queryKey: ['retainage', 'details', jobId],
    queryFn: () => api<RetainageDetails>(`/retainage/job/${jobId}/details`),
    enabled: !!jobId,
  });
}

/**
 * Get company-wide retainage statistics
 */
export function useRetainageStats() {
  return useQuery({
    queryKey: ['retainage', 'stats'],
    queryFn: () => api<RetainageStats>('/retainage/stats'),
  });
}

// ============================================================
// RELEASES HOOKS
// ============================================================

/**
 * Get all retainage releases for a job
 */
export function useJobRetainageReleases(jobId: string) {
  return useQuery({
    queryKey: ['retainage', 'releases', jobId],
    queryFn: () => api<RetainageReleasesResponse>(`/retainage/releases/${jobId}`),
    enabled: !!jobId,
  });
}

/**
 * Get a single retainage release
 */
export function useRetainageRelease(id: string) {
  return useQuery({
    queryKey: ['retainage', 'release', id],
    queryFn: () => api<RetainageRelease>(`/retainage/release/${id}`),
    enabled: !!id,
  });
}

/**
 * Create a new retainage release
 */
export function useCreateRetainageRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRetainageReleaseInput) =>
      api<RetainageRelease>('/retainage/release', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['retainage', 'summary', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'details', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'releases', variables.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'stats'] });
      toast.success('Retainage release created');
    },
    onError: (error: Error) => toast.error(`Failed to create release: ${error.message}`),
  });
}

/**
 * Update a retainage release
 */
export function useUpdateRetainageRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: UpdateRetainageReleaseInput) =>
      api<RetainageRelease>(`/retainage/release/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['retainage', 'summary', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'details', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'releases', data.job_id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'release', data.id] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'stats'] });
      toast.success('Retainage release updated');
    },
    onError: (error: Error) => toast.error(`Failed to update release: ${error.message}`),
  });
}

/**
 * Delete a retainage release
 */
export function useDeleteRetainageRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, jobId }: { id: string; jobId: string }) =>
      api(`/retainage/release/${id}`, { method: 'DELETE' }),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['retainage', 'summary', jobId] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'details', jobId] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'releases', jobId] });
      queryClient.invalidateQueries({ queryKey: ['retainage', 'stats'] });
      toast.success('Retainage release deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete release: ${error.message}`),
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate retainage amount from allocation
 */
export function calculateRetainage(amount: number, retainagePercent: number = 10): number {
  return amount * (retainagePercent / 100);
}

/**
 * Format retainage amount for display
 */
export function formatRetainageAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Get status color based on retainage balance
 */
export function getRetainageStatusColor(balance: number, held: number): string {
  if (balance <= 0) return 'bg-green-500'; // Fully released
  if (balance < held * 0.5) return 'bg-yellow-500'; // Partially released
  return 'bg-blue-500'; // Mostly held
}

/**
 * Calculate percent released
 */
export function calculatePercentReleased(released: number, held: number): number {
  if (held <= 0) return 0;
  return Math.min((released / held) * 100, 100);
}
