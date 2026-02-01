import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface BudgetLine {
  id: string;
  job_id: string;
  cost_code_id: string;
  budgeted_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  cost_code?: string;
  cost_code_name?: string;
  cost_code_category?: string;
}

export interface BudgetCategory {
  code: string;
  name: string;
  category: string;
  cost_code_id: string;
  budget: number;
  committed: number;
  actual: number;
  forecast: number;
}

export function useBudgetLines(jobId?: string) {
  return useQuery({
    queryKey: ['budget-lines', jobId],
    queryFn: async (): Promise<BudgetLine[]> => {
      if (!jobId) return [];
      const data = await api<{ budget_lines: BudgetLine[] }>(`/jobs/${jobId}/budget`);
      return data.budget_lines || [];
    },
    enabled: !!jobId,
  });
}

// Get budget summary with actual/committed from POs and invoices
export function useBudgetSummary(jobId?: string) {
  return useQuery({
    queryKey: ['budget-summary', jobId],
    queryFn: async (): Promise<BudgetCategory[]> => {
      if (!jobId) return [];
      // Use budget-summary endpoint which calculates actuals from invoices/POs
      const data = await api<{ lines: any[]; totals: any }>(`/jobs/${jobId}/budget-summary`);

      // Transform lines to BudgetCategory format
      // API returns: costCode, description, category, budgeted, committed, billed, projected, variance
      return (data.lines || [])
        .filter((line: any) => line.budgeted > 0 || line.committed > 0 || line.billed > 0)
        .map((line: any) => ({
          code: line.costCode || '',
          name: line.description || 'Unknown',
          category: line.category || '',
          cost_code_id: line.costCodeId,
          budget: line.budgeted || 0,
          committed: line.committed || 0,
          actual: line.billed || 0,
          forecast: line.projected || Math.max(line.committed || 0, line.billed || 0),
        }));
    },
    enabled: !!jobId,
  });
}

export function useCreateBudgetLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { job_id: string; cost_code_id: string; budgeted_amount: number; notes?: string }) => {
      return api(`/jobs/${data.job_id}/budget`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Budget line created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create budget line: ${error.message}`);
    },
  });
}

export function useUpdateBudgetLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, job_id, ...updates }: { id: string; job_id: string; budgeted_amount?: number; notes?: string }) => {
      return api(`/jobs/${job_id}/budget/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Budget line updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update budget line: ${error.message}`);
    },
  });
}

export function useDeleteBudgetLine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, job_id }: { id: string; job_id: string }) => {
      return api(`/jobs/${job_id}/budget/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Budget line deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete budget line: ${error.message}`);
    },
  });
}
