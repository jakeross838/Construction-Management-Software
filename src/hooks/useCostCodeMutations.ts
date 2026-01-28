import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      const { data: result, error } = await supabase
        .from('cost_codes')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
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
      const { data: result, error } = await supabase
        .from('cost_codes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
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
      const { error } = await supabase.from('cost_codes').delete().eq('id', id);

      if (error) throw error;
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
