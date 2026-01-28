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
