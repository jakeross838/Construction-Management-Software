/**
 * API-backed Estimates Hook
 * Fetches estimates from the database API
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// Database estimate type (from API)
export interface DBEstimate {
  id: string;
  job_id: string;
  title: string;
  version: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted';
  total_amount: number;
  notes: string | null;
  created_by: string;
  submitted_at: string | null;
  submitted_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  converted_at: string | null;
  converted_by: string | null;
  created_at: string;
  updated_at: string;
  line_count: number;
  // Computed fields from API
  material_total: number;
  labor_total: number;
  subtotal: number;
  markup_percent: number;
  markup_amount: number;
  overhead_percent: number;
  overhead_amount: number;
  profit_percent: number;
  profit_amount: number;
  contingency_percent: number;
  contingency_amount: number;
  // Joined
  job?: { id: string; name: string };
}

export interface DBEstimateLine {
  id: string;
  estimate_id: string;
  cost_code_id: string | null;
  section_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  amount: number;
  markup_percent: number;
  markup_amount: number;
  notes: string | null;
  sort_order: number;
  cost_code?: { id: string; code: string; name: string };
}

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// HOOKS
// ============================================================

export function useDBEstimates(jobId?: string) {
  return useQuery({
    queryKey: ['db-estimates', jobId],
    queryFn: async () => {
      // Always fetch all, filter client-side for reliability
      const all = await api<DBEstimate[]>('/estimates');
      if (jobId) {
        return all.filter(e => e.job_id === jobId);
      }
      return all;
    },
  });
}

export function useDBEstimate(id: string) {
  return useQuery({
    queryKey: ['db-estimate', id],
    queryFn: () => api<DBEstimate>(`/estimates/${id}`),
    enabled: !!id,
  });
}

export function useDBEstimateLines(estimateId: string) {
  return useQuery({
    queryKey: ['db-estimate-lines', estimateId],
    queryFn: () => api<DBEstimateLine[]>(`/estimates/${estimateId}/lines`),
    enabled: !!estimateId,
  });
}

export function useCreateDBEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      job_id: string;
      title: string;
      notes?: string;
      created_by: string;
    }) => api<DBEstimate>('/estimates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      toast.success('Estimate created');
    },
    onError: (error: Error) => toast.error(`Failed to create estimate: ${error.message}`),
  });
}

export function useUpdateDBEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<DBEstimate> & { id: string }) =>
      api<DBEstimate>(`/estimates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', id] });
      toast.success('Estimate updated');
    },
    onError: (error: Error) => toast.error(`Failed to update estimate: ${error.message}`),
  });
}

export function useDeleteDBEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api(`/estimates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      toast.success('Estimate deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete estimate: ${error.message}`),
  });
}

export function useSubmitDBEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, submitted_by }: { id: string; submitted_by: string }) =>
      api<DBEstimate>(`/estimates/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submitted_by }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', id] });
      toast.success('Estimate submitted for approval');
    },
    onError: (error: Error) => toast.error(`Failed to submit: ${error.message}`),
  });
}

export function useApproveDBEstimate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved_by }: { id: string; approved_by: string }) =>
      api<DBEstimate>(`/estimates/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved_by }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', id] });
      toast.success('Estimate approved');
    },
    onError: (error: Error) => toast.error(`Failed to approve: ${error.message}`),
  });
}

export function useConvertDBEstimateToBudget() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, converted_by }: { id: string; converted_by: string }) =>
      api<{ message: string; budget_lines_created: number }>(`/estimates/${id}/convert-to-budget`, {
        method: 'POST',
        body: JSON.stringify({ converted_by }),
      }),
    onSuccess: (result, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
      toast.success(`Converted to budget (${result.budget_lines_created} lines created)`);
    },
    onError: (error: Error) => toast.error(`Failed to convert: ${error.message}`),
  });
}

export function useAddDBEstimateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, ...line }: {
      estimateId: string;
      cost_code_id: string;
      description: string;
      amount: number;
      quantity?: number;
      unit?: string;
      unit_cost?: number;
    }) => api<DBEstimateLine>(`/estimates/${estimateId}/lines`, {
      method: 'POST',
      body: JSON.stringify(line),
    }),
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimate-lines', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
    },
    onError: (error: Error) => toast.error(`Failed to add line: ${error.message}`),
  });
}

export function useUpdateDBEstimateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, lineId, ...data }: {
      estimateId: string;
      lineId: string;
      cost_code_id?: string;
      description?: string;
      amount?: number;
      quantity?: number;
      unit?: string;
      unit_cost?: number;
    }) => api<DBEstimateLine>(`/estimates/${estimateId}/lines/${lineId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimate-lines', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      toast.success('Line updated');
    },
    onError: (error: Error) => toast.error(`Failed to update line: ${error.message}`),
  });
}

export function useDeleteDBEstimateLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ estimateId, lineId }: { estimateId: string; lineId: string }) =>
      api(`/estimates/${estimateId}/lines/${lineId}`, { method: 'DELETE' }),
    onSuccess: (_, { estimateId }) => {
      queryClient.invalidateQueries({ queryKey: ['db-estimate-lines', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      toast.success('Line deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete line: ${error.message}`),
  });
}
