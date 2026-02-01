import { useMutation, useQueryClient } from '@tanstack/react-query';
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

interface CreateCostCodeData {
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

interface UpdateCostCodeData extends CreateCostCodeData {
  id: string;
}

export const useCreateCostCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCostCodeData) => {
      return api('/cost-codes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      toast.success('Cost code created');
    },
    onError: (error: Error) => {
      console.error('Failed to create cost code:', error);
      toast.error('Failed to create cost code');
    },
  });
};

export const useUpdateCostCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateCostCodeData) => {
      return api(`/cost-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      toast.success('Cost code updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update cost code:', error);
      toast.error('Failed to update cost code');
    },
  });
};

export const useDeleteCostCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/cost-codes/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      toast.success('Cost code deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete cost code:', error);
      toast.error('Failed to delete cost code');
    },
  });
};

// Bulk import cost codes
export const useBulkImportCostCodes = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (codes: CreateCostCodeData[]) => {
      const results = await Promise.allSettled(
        codes.map(code => api('/cost-codes', {
          method: 'POST',
          body: JSON.stringify(code),
        }))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0 && succeeded === 0) {
        throw new Error('All imports failed');
      }

      return { succeeded, failed, total: codes.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['cost-codes'] });
      if (result.failed > 0) {
        toast.warning(`Imported ${result.succeeded} of ${result.total} cost codes (${result.failed} failed)`);
      } else {
        toast.success(`Successfully imported ${result.succeeded} cost code(s)`);
      }
    },
    onError: (error: Error) => {
      console.error('Bulk import failed:', error);
      toast.error('Failed to import cost codes');
    },
  });
};
