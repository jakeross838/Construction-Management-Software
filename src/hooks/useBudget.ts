import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      let query = supabase
        .from('budget_lines')
        .select(`
          *,
          cost_codes (id, code, name, category)
        `)
        .order('created_at');
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return (data || []).map((bl: any) => ({
        ...bl,
        cost_code: bl.cost_codes?.code,
        cost_code_name: bl.cost_codes?.name,
        cost_code_category: bl.cost_codes?.category,
      }));
    },
  });
}

// Get budget summary with actual/committed from POs and invoices
export function useBudgetSummary(jobId?: string) {
  return useQuery({
    queryKey: ['budget-summary', jobId],
    queryFn: async (): Promise<BudgetCategory[]> => {
      // Get budget lines with cost codes
      let budgetQuery = supabase
        .from('budget_lines')
        .select(`
          *,
          cost_codes (id, code, name, category)
        `);
      
      if (jobId) {
        budgetQuery = budgetQuery.eq('job_id', jobId);
      }
      
      const { data: budgetLines, error: budgetError } = await budgetQuery;
      if (budgetError) throw budgetError;
      
      // Get PO line items for committed amounts
      let poQuery = supabase
        .from('po_line_items')
        .select(`
          amount,
          cost_code_id,
          purchase_orders!inner (job_id, status)
        `);
      
      // Get invoice allocations for actual amounts
      let invoiceQuery = supabase
        .from('invoice_allocations')
        .select(`
          amount,
          cost_code_id,
          invoices!inner (job_id, status)
        `);
      
      const [poResult, invoiceResult] = await Promise.all([
        poQuery,
        invoiceQuery,
      ]);
      
      // Aggregate committed by cost code
      const committedByCostCode = new Map<string, number>();
      if (poResult.data) {
        for (const item of poResult.data as any[]) {
          if (item.cost_code_id && (!jobId || item.purchase_orders?.job_id === jobId)) {
            const current = committedByCostCode.get(item.cost_code_id) || 0;
            committedByCostCode.set(item.cost_code_id, current + (item.amount || 0));
          }
        }
      }
      
      // Aggregate actual by cost code (from paid invoices)
      const actualByCostCode = new Map<string, number>();
      if (invoiceResult.data) {
        for (const alloc of invoiceResult.data as any[]) {
          if (alloc.cost_code_id && (!jobId || alloc.invoices?.job_id === jobId)) {
            if (alloc.invoices?.status === 'paid' || alloc.invoices?.status === 'approved') {
              const current = actualByCostCode.get(alloc.cost_code_id) || 0;
              actualByCostCode.set(alloc.cost_code_id, current + (alloc.amount || 0));
            }
          }
        }
      }
      
      // Build summary by cost code
      const summary: BudgetCategory[] = (budgetLines || []).map((bl: any) => {
        const costCodeId = bl.cost_code_id;
        const budget = bl.budgeted_amount || 0;
        const committed = committedByCostCode.get(costCodeId) || 0;
        const actual = actualByCostCode.get(costCodeId) || 0;
        // Forecast = max of committed and actual (simple forecast)
        const forecast = Math.max(committed, actual);
        
        return {
          code: bl.cost_codes?.code || '',
          name: bl.cost_codes?.name || 'Unknown',
          category: bl.cost_codes?.category || '',
          cost_code_id: costCodeId,
          budget,
          committed,
          actual,
          forecast,
        };
      });
      
      return summary;
    },
  });
}

export function useCreateBudgetLine() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { job_id: string; cost_code_id: string; budgeted_amount: number; notes?: string }) => {
      const { data: result, error } = await supabase
        .from('budget_lines')
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      return result;
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
    mutationFn: async ({ id, ...updates }: { id: string; budgeted_amount?: number; notes?: string }) => {
      const { data, error } = await supabase
        .from('budget_lines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_lines').delete().eq('id', id);
      if (error) throw error;
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
