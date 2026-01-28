import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CostCode {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
}

export const useCostCodes = () => {
  return useQuery({
    queryKey: ['cost-codes'],
    queryFn: async (): Promise<CostCode[]> => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('is_active', true)
        .order('code');

      if (error) throw error;
      return data || [];
    },
  });
};

export const useBaseCostCodes = () => {
  return useQuery({
    queryKey: ['cost-codes-base'],
    queryFn: async (): Promise<CostCode[]> => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('is_active', true)
        .not('code', 'like', '%C')
        .order('code');

      if (error) throw error;
      return data || [];
    },
  });
};

export const useChangeCostCodes = () => {
  return useQuery({
    queryKey: ['cost-codes-change'],
    queryFn: async (): Promise<CostCode[]> => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('is_active', true)
        .like('code', '%C')
        .order('code');

      if (error) throw error;
      return data || [];
    },
  });
};
