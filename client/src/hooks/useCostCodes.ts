import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

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
      const response = await apiGet('/api/cost-codes');
      if (!response.ok) throw new Error('Failed to fetch cost codes');
      const data = await response.json();
      // API returns { costCodes: [...] } (camelCase)
      if (Array.isArray(data)) return data;
      return data.costCodes || data.cost_codes || [];
    },
  });
};

export const useBaseCostCodes = () => {
  return useQuery({
    queryKey: ['cost-codes-base'],
    queryFn: async (): Promise<CostCode[]> => {
      const response = await apiGet('/api/cost-codes');
      if (!response.ok) throw new Error('Failed to fetch cost codes');
      const data = await response.json();
      // API returns { costCodes: [...] } (camelCase)
      const codes = Array.isArray(data) ? data : (data.costCodes || data.cost_codes || []);
      return codes.filter((c: CostCode) => c.code && !c.code.endsWith('C'));
    },
  });
};

export const useChangeCostCodes = () => {
  return useQuery({
    queryKey: ['cost-codes-change'],
    queryFn: async (): Promise<CostCode[]> => {
      const response = await apiGet('/api/cost-codes');
      if (!response.ok) throw new Error('Failed to fetch cost codes');
      const data = await response.json();
      // API returns { costCodes: [...] } (camelCase)
      const codes = Array.isArray(data) ? data : (data.costCodes || data.cost_codes || []);
      return codes.filter((c: CostCode) => c.code && c.code.endsWith('C'));
    },
  });
};
