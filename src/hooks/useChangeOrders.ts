import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ChangeOrder, COLineItem, COStatus, COType, RequestedBy } from '@/types/financial';

// =====================================================
// CHANGE ORDERS HOOKS
// =====================================================

export function useChangeOrders(jobId?: string, status?: string) {
  return useQuery({
    queryKey: ['change-orders', jobId, status],
    queryFn: async () => {
      // View has embedded job_name, po_number, vendor_name - no FK joins needed
      let query = supabase
        .from('change_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Data already has job_name, po_number, vendor_name from view
      return data as (ChangeOrder & { vendor_name?: string })[];
    },
  });
}

export function useChangeOrder(id: string) {
  return useQuery({
    queryKey: ['change-order', id],
    queryFn: async () => {
      // View has embedded job_name, po_number, vendor_name - no FK joins needed
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch line items separately with cost code info
      const { data: lineItems } = await supabase
        .from('co_line_items')
        .select('*, cost_codes (id, code, name)')
        .eq('change_order_id', id)
        .order('sort_order');

      // Get job client separately if needed
      let jobClient = null;
      if (data.job_id) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('client')
          .eq('id', data.job_id)
          .single();
        jobClient = jobData?.client;
      }

      return {
        ...data,
        job_client: jobClient,
        line_items: lineItems?.map((li: any) => ({
          ...li,
          cost_code: li.cost_codes?.code,
          cost_code_name: li.cost_codes?.name,
        })) || [],
      } as ChangeOrder & { job_client?: string; vendor_name?: string };
    },
    enabled: !!id,
  });
}

export function useCreateChangeOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      line_items,
      job_name,
      po_number,
      ...co 
    }: Partial<ChangeOrder> & { line_items?: Partial<COLineItem>[] }) => {
      // Get next CO number for this job
      const { data: existingCOs } = await supabase
        .from('change_orders')
        .select('co_number')
        .eq('job_id', co.job_id!)
        .order('co_number', { ascending: false })
        .limit(1);
      
      let nextNumber = 'CO-001';
      if (existingCOs && existingCOs.length > 0) {
        const lastNum = existingCOs[0].co_number.replace(/^CO-0*/, '');
        const num = parseInt(lastNum) + 1;
        nextNumber = `CO-${num.toString().padStart(3, '0')}`;
      }
      
      const { data: coData, error: coError } = await supabase
        .from('change_orders')
        .insert([{ ...co, co_number: nextNumber } as any])
        .select()
        .single();
      
      if (coError) throw coError;
      
      // Create line items if provided
      if (line_items && line_items.length > 0) {
        const lineItemsWithCoId = line_items.map((li, idx) => ({
          cost_code_id: li.cost_code_id || null,
          description: li.description,
          amount: li.amount,
          change_order_id: coData.id,
          sort_order: idx,
        }));
        
        const { error: liError } = await supabase
          .from('co_line_items')
          .insert(lineItemsWithCoId);
        
        if (liError) throw liError;
      }
      
      return coData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success(`Change Order ${data.co_number} created`);
    },
    onError: (error) => {
      toast.error(`Failed to create change order: ${error.message}`);
    },
  });
}

export function useUpdateChangeOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      line_items,
      job_name,
      po_number,
      job_client,
      vendor_name,
      ...updates 
    }: Partial<ChangeOrder> & { 
      id: string; 
      line_items?: COLineItem[];
      job_client?: string;
      vendor_name?: string;
    }) => {
      const { data, error } = await supabase
        .from('change_orders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update line items if provided
      if (line_items !== undefined) {
        // Delete existing and insert new
        await supabase.from('co_line_items').delete().eq('change_order_id', id);
        
        if (line_items.length > 0) {
          const lineItemsData = line_items.map((li, idx) => ({
            cost_code_id: li.cost_code_id || null,
            description: li.description,
            amount: li.amount,
            change_order_id: id,
            sort_order: idx,
          }));
          
          const { error: liError } = await supabase
            .from('co_line_items')
            .insert(lineItemsData);
          
          if (liError) throw liError;
        }
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Change order updated');
    },
    onError: (error) => {
      toast.error(`Failed to update change order: ${error.message}`);
    },
  });
}

export function useApproveChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by: string }) => {
      // First get the change order to check days_impact
      const { data: coData, error: coError } = await supabase
        .from('change_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (coError) throw coError;

      // Get job end_date separately if needed
      let jobEndDate = null;
      if (coData.job_id) {
        const { data: jobData } = await supabase
          .from('jobs')
          .select('end_date')
          .eq('id', coData.job_id)
          .single();
        jobEndDate = jobData?.end_date;
      }

      // Update the change order status
      const { data, error } = await supabase
        .from('change_orders')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If there's a positive days_impact, extend the job's end_date
      const daysImpact = coData.days_impact || 0;

      if (daysImpact > 0 && jobEndDate) {
        const currentEndDate = new Date(jobEndDate);
        currentEndDate.setDate(currentEndDate.getDate() + daysImpact);
        const newEndDate = currentEndDate.toISOString().split('T')[0];

        const { error: jobError } = await supabase
          .from('jobs')
          .update({ end_date: newEndDate })
          .eq('id', coData.job_id);

        if (jobError) {
          console.error('Failed to extend job end date:', jobError);
          // Don't throw - CO is already approved, just log the error
        }
      }

      return { ...data, days_impact: daysImpact, job_end_date_extended: daysImpact > 0 && jobEndDate };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['db-job'] });
      
      if (data.job_end_date_extended) {
        toast.success(`Change Order ${data.co_number} approved. Project end date extended by ${data.days_impact} days.`);
      } else {
        toast.success(`Change Order ${data.co_number} approved`);
      }
    },
    onError: (error) => {
      toast.error(`Failed to approve change order: ${error.message}`);
    },
  });
}

export function useRejectChangeOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('change_orders')
        .update({
          status: 'rejected',
          notes: notes || null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      toast.success(`Change Order ${data.co_number} rejected`);
    },
    onError: (error) => {
      toast.error(`Failed to reject change order: ${error.message}`);
    },
  });
}

export function useDeleteChangeOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete line items first
      await supabase.from('co_line_items').delete().eq('change_order_id', id);
      
      const { error } = await supabase
        .from('change_orders')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success('Change order deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete change order: ${error.message}`);
    },
  });
}
