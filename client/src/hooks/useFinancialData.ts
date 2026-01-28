import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Invoice, 
  PurchaseOrder,
  POLineItem,
  Draw, 
  ChangeOrder, 
  Vendor, 
  CostCode,
  DBJob,
  BudgetLine,
  InvoiceStatus,
  LienRelease,
} from '@/types/financial';
import { toast } from 'sonner';

// =====================================================
// JOBS HOOKS
// =====================================================
export function useDBJobs() {
  return useQuery({
    queryKey: ['db-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as unknown as DBJob[];
    },
  });
}

// Alias for backward compatibility
export const useJobs = useDBJobs;

export function useJob(id: string) {
  return useQuery({
    queryKey: ['db-job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data as unknown as DBJob;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (job: Partial<DBJob>) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert([job as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create job: ${error.message}`);
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DBJob> & { id: string }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['db-job', variables.id] });
      toast.success('Job updated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to update job: ${error.message}`);
    },
  });
}

// =====================================================
// VENDORS HOOKS
// =====================================================
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('status', 'active')
        .order('name');
      
      if (error) throw error;
      return data as unknown as Vendor[];
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (vendor: Partial<Vendor>) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert([vendor as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create vendor: ${error.message}`);
    },
  });
}

// =====================================================
// COST CODES HOOKS
// =====================================================
export function useCostCodes() {
  return useQuery({
    queryKey: ['cost-codes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_codes')
        .select('*')
        .eq('is_active', true)
        .order('code');
      
      if (error) throw error;
      return data as unknown as CostCode[];
    },
  });
}

// =====================================================
// INVOICES HOOKS
// =====================================================
export function useInvoices(jobId?: string, status?: InvoiceStatus | 'all') {
  return useQuery({
    queryKey: ['invoices', jobId, status],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          vendors (id, name),
          jobs (id, name),
          purchase_orders (id, po_number)
        `)
        .is('deleted_at', null)  // Filter out soft-deleted invoices
        .order('created_at', { ascending: false });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Transform the data to include vendor_name, job_name, po_number
      return data.map((inv: any) => ({
        ...inv,
        vendor_name: inv.vendors?.name,
        job_name: inv.jobs?.name,
        po_number: inv.purchase_orders?.po_number,
      })) as Invoice[];
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      // Use v2_ tables for FK joins (views don't support them)
      const { data, error } = await supabase
        .from('v2_invoices')
        .select(`
          *,
          v2_vendors (id, name),
          v2_jobs (id, name),
          v2_purchase_orders (id, po_number),
          v2_invoice_allocations (
            id,
            cost_code_id,
            amount,
            notes,
            v2_cost_codes (id, code, name)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        vendor_name: (data as any).v2_vendors?.name,
        job_name: (data as any).v2_jobs?.name,
        po_number: (data as any).v2_purchase_orders?.po_number,
        stamped_pdf_url: (data as any).pdf_stamped_url, // Map column name
        allocations: (data as any).v2_invoice_allocations?.map((a: any) => ({
          ...a,
          description: a.notes,
          cost_code: a.v2_cost_codes?.code,
          cost_code_name: a.v2_cost_codes?.name,
        })),
      } as Invoice;
    },
    enabled: !!id,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoice: Partial<Invoice>) => {
      const { allocations, vendor_name, job_name, po_number, ...invoiceData } = invoice as any;
      const { data, error } = await supabase
        .from('v2_invoices')
        .insert([invoiceData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create invoice: ${error.message}`);
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Invoice> & { id: string }) => {
      const { allocations, vendor_name, job_name, po_number, ...updateData } = updates as any;
      const { data, error } = await supabase
        .from('v2_invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] });
    },
    onError: (error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

export function useApproveInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by: string }) => {
      const { data, error } = await supabase
        .from('v2_invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice approved and PDF stamped');
    },
    onError: (error) => {
      toast.error(`Failed to approve invoice: ${error.message}`);
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First delete related allocations
      await supabase
        .from('v2_invoice_allocations')
        .delete()
        .eq('invoice_id', id);

      // Then delete the invoice
      const { error } = await supabase
        .from('v2_invoices')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete invoice: ${error.message}`);
    },
  });
}

export function useChangeInvoiceStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, approved_by }: { id: string; status: InvoiceStatus; approved_by?: string }) => {
      const updateData: any = { status };

      // Set approval fields when moving to approved
      if (status === 'approved' && approved_by) {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = approved_by;
      }

      // Clear approval fields when reverting from approved
      if (status === 'needs_approval') {
        updateData.approved_at = null;
        updateData.approved_by = null;
      }

      const { data, error } = await supabase
        .from('v2_invoices')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] });
      toast.success(`Invoice status changed to ${variables.status.replace('_', ' ')}`);
    },
    onError: (error) => {
      toast.error(`Failed to change status: ${error.message}`);
    },
  });
}

// =====================================================
// PURCHASE ORDERS HOOKS
// =====================================================
export function usePurchaseOrders(jobId?: string, status?: string) {
  return useQuery({
    queryKey: ['purchase-orders', jobId, status],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (id, name),
          jobs (id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((po: any) => ({
        ...po,
        vendor_name: po.vendors?.name,
        job_name: po.jobs?.name,
      })) as PurchaseOrder[];
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors (id, name, address, phone, contact_name, email),
          jobs (id, name, address, client),
          po_line_items (
            id,
            cost_code_id,
            title,
            description,
            unit_cost,
            quantity,
            amount,
            invoiced_amount,
            sort_order,
            cost_codes (id, code, name)
          ),
          invoices (
            id,
            invoice_number,
            amount,
            invoice_date,
            status
          ),
          change_orders (
            id,
            co_number,
            description,
            total_amount,
            status
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      const vendorData = (data as any).vendors;
      const jobData = (data as any).jobs;
      
      return {
        ...data,
        vendor_name: vendorData?.name,
        vendor_address: vendorData?.address,
        vendor_phone: vendorData?.phone,
        vendor_contact: vendorData?.contact_name,
        vendor_email: vendorData?.email,
        job_name: jobData?.name,
        job_address: jobData?.address,
        job_client: jobData?.client,
        line_items: (data as any).po_line_items?.map((li: any) => ({
          ...li,
          cost_code: li.cost_codes?.code,
          cost_code_name: li.cost_codes?.name,
        })),
      } as unknown as PurchaseOrder;
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      line_items, 
      vendor_name,
      job_name,
      ...po 
    }: Partial<PurchaseOrder> & { line_items?: Partial<any>[] }) => {
      // First create the PO
      const { data: poData, error: poError } = await supabase
        .from('purchase_orders')
        .insert([po as any])
        .select()
        .single();
      
      if (poError) throw poError;
      
      // Then create line items if provided
      if (line_items && line_items.length > 0) {
        const lineItemsWithPoId = line_items.map((li, idx) => ({
          ...li,
          po_id: poData.id,
          sort_order: idx,
        }));
        
        const { error: liError } = await supabase
          .from('po_line_items')
          .insert(lineItemsWithPoId);
        
        if (liError) throw liError;
      }
      
      return poData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success(`PO created: ${data.po_number}`);
    },
    onError: (error) => {
      toast.error(`Failed to create PO: ${error.message}`);
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      vendor_name,
      job_name,
      job_address,
      job_client,
      vendor_address,
      vendor_phone,
      vendor_contact,
      vendor_email,
      line_items,
      invoices,
      change_orders,
      ...updates 
    }: Partial<PurchaseOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', variables.id] });
      toast.success('Purchase order updated');
    },
    onError: (error) => {
      toast.error(`Failed to update PO: ${error.message}`);
    },
  });
}

export function useUpdatePOLineItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id,
      po_id,
      cost_code,
      cost_code_name,
      ...updates 
    }: Partial<POLineItem> & { id: string; po_id: string }) => {
      const { data, error } = await supabase
        .from('po_line_items')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, po_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.po_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Line item updated');
    },
    onError: (error) => {
      toast.error(`Failed to update line item: ${error.message}`);
    },
  });
}

export function useCreatePOLineItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lineItem: Partial<POLineItem> & { po_id: string }) => {
      const { cost_code, cost_code_name, ...data } = lineItem as any;
      const { data: result, error } = await supabase
        .from('po_line_items')
        .insert([data])
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.po_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Line item added');
    },
    onError: (error) => {
      toast.error(`Failed to add line item: ${error.message}`);
    },
  });
}

export function useDeletePOLineItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, po_id }: { id: string; po_id: string }) => {
      const { error } = await supabase
        .from('po_line_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { po_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', data.po_id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Line item deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete line item: ${error.message}`);
    },
  });
}

// =====================================================
// DRAWS HOOKS
// =====================================================
export function useDraws(jobId?: string) {
  return useQuery({
    queryKey: ['draws', jobId],
    queryFn: async () => {
      let query = supabase
        .from('draws')
        .select(`
          *,
          jobs (id, name)
        `)
        .order('draw_number', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((draw: any) => ({
        ...draw,
        job_name: draw.jobs?.name,
      })) as Draw[];
    },
  });
}

export function useDraw(id: string) {
  return useQuery({
    queryKey: ['draw', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('draws')
        .select(`
          *,
          jobs (id, name, contract_amount, retainage_percent),
          invoices (
            id,
            invoice_number,
            amount,
            invoice_date,
            status,
            vendors (id, name),
            invoice_allocations (
              cost_code_id,
              amount,
              cost_codes (id, code, name)
            )
          )
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      return {
        ...data,
        job_name: (data as any).jobs?.name,
        invoices: (data as any).invoices?.map((inv: any) => ({
          ...inv,
          vendor_name: inv.vendors?.name,
        })),
      } as unknown as Draw;
    },
    enabled: !!id,
  });
}

// Fetch approved invoices that aren't assigned to a draw yet
export function useUnassignedApprovedInvoices(jobId?: string) {
  return useQuery({
    queryKey: ['unassigned-approved-invoices', jobId],
    queryFn: async () => {
      let query = supabase
        .from('invoices')
        .select(`
          *,
          vendors (id, name),
          jobs (id, name),
          purchase_orders (id, po_number)
        `)
        .eq('status', 'approved')
        .is('draw_id', null)
        .order('invoice_date', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((inv: any) => ({
        ...inv,
        vendor_name: inv.vendors?.name,
        job_name: inv.jobs?.name,
        po_number: inv.purchase_orders?.po_number,
      })) as Invoice[];
    },
    enabled: !!jobId,
  });
}

export function useCreateDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ invoiceIds, ...draw }: Partial<Draw> & { invoiceIds?: string[] }) => {
      // Get the next draw number for this job
      const { data: existingDraws } = await supabase
        .from('draws')
        .select('draw_number')
        .eq('job_id', draw.job_id!)
        .order('draw_number', { ascending: false })
        .limit(1);
      
      const nextNumber = existingDraws && existingDraws.length > 0 
        ? existingDraws[0].draw_number + 1 
        : 1;
      
      const { job_name, invoices, ...drawData } = draw as any;
      
      const { data, error } = await supabase
        .from('draws')
        .insert([{ ...drawData, draw_number: nextNumber }])
        .select()
        .single();
      
      if (error) throw error;
      
      // If invoiceIds were provided, link them to this draw and update their status
      if (invoiceIds && invoiceIds.length > 0) {
        const { error: updateError } = await supabase
          .from('v2_invoices')
          .update({
            draw_id: data.id,
            status: 'in_draw'
          })
          .in('id', invoiceIds);
        
        if (updateError) throw updateError;
        
        // Stamp each invoice with the draw badge (fire-and-forget, don't block on this)
        // Invoke stamp-invoice edge function for each invoice
        for (const invoiceId of invoiceIds) {
          supabase.functions.invoke('stamp-invoice', {
            body: { invoiceId, status: 'in_draw' },
          }).catch(err => console.error('Failed to stamp invoice:', invoiceId, err));
        }
      }
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      toast.success(`Draw #${data.draw_number} created`);
    },
    onError: (error) => {
      toast.error(`Failed to create draw: ${error.message}`);
    },
  });
}

// =====================================================
// CHANGE ORDERS HOOKS
// =====================================================
export function useChangeOrders(jobId?: string) {
  return useQuery({
    queryKey: ['change-orders', jobId],
    queryFn: async () => {
      let query = supabase
        .from('change_orders')
        .select(`
          *,
          jobs (id, name),
          purchase_orders (id, po_number)
        `)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((co: any) => ({
        ...co,
        job_name: co.jobs?.name,
        po_number: co.purchase_orders?.po_number,
      })) as ChangeOrder[];
    },
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
    }: Partial<ChangeOrder> & { line_items?: Partial<any>[] }) => {
      // Get next CO number for this job
      const { data: existingCOs } = await supabase
        .from('change_orders')
        .select('co_number')
        .eq('job_id', co.job_id!)
        .order('co_number', { ascending: false })
        .limit(1);
      
      const nextNumber = existingCOs && existingCOs.length > 0
        ? `CO-${parseInt(existingCOs[0].co_number.replace('CO-', '')) + 1}`
        : 'CO-1';
      
      const { data: coData, error: coError } = await supabase
        .from('change_orders')
        .insert([{ ...co, co_number: nextNumber } as any])
        .select()
        .single();
      
      if (coError) throw coError;
      
      // Create line items if provided
      if (line_items && line_items.length > 0) {
        const lineItemsWithCoId = line_items.map((li, idx) => ({
          ...li,
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

// =====================================================
// BUDGET HOOKS
// =====================================================
export function useBudgetLines(jobId: string) {
  return useQuery({
    queryKey: ['budget-lines', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_lines')
        .select(`
          *,
          cost_codes (id, code, name)
        `)
        .eq('job_id', jobId);
      
      if (error) throw error;
      
      return data.map((bl: any) => ({
        ...bl,
        cost_code: bl.cost_codes?.code,
        cost_code_name: bl.cost_codes?.name,
      })) as BudgetLine[];
    },
    enabled: !!jobId,
  });
}

// =====================================================
// PO ATTACHMENTS
// =====================================================
export interface POAttachment {
  id: string;
  po_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export function usePOAttachments(poId: string) {
  return useQuery({
    queryKey: ['po-attachments', poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('po_attachments')
        .select('*')
        .eq('po_id', poId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as POAttachment[];
    },
    enabled: !!poId,
  });
}

export function useUploadPOAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ poId, file }: { poId: string; file: File }) => {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${poId}/${Date.now()}-${file.name}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('po-attachments')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('po-attachments')
        .getPublicUrl(fileName);
      
      // Create attachment record
      const { data, error } = await supabase
        .from('po_attachments')
        .insert([{
          po_id: poId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: 'User',
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['po-attachments', data.po_id] });
      toast.success('File uploaded successfully');
    },
    onError: (error) => {
      toast.error(`Failed to upload file: ${error.message}`);
    },
  });
}

export function useDeletePOAttachment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, poId, fileUrl }: { id: string; poId: string; fileUrl: string }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/po-attachments/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('po-attachments').remove([filePath]);
      }
      
      // Delete record
      const { error } = await supabase
        .from('po_attachments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { poId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['po-attachments', data.poId] });
      toast.success('File deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete file: ${error.message}`);
    },
  });
}

// =====================================================
// LIEN RELEASES HOOKS
// =====================================================
export function useLienReleases(jobId?: string) {
  return useQuery({
    queryKey: ['lien-releases', jobId],
    queryFn: async () => {
      let query = supabase
        .from('lien_releases')
        .select(`
          *,
          vendors (id, name),
          jobs (id, name),
          draws (id, draw_number)
        `)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      return data.map((lr: any) => ({
        ...lr,
        vendor_name: lr.vendors?.name,
        job_name: lr.jobs?.name,
        draw_number: lr.draws?.draw_number,
      })) as (LienRelease & { draw_number?: number })[];
    },
  });
}

export function useLienReleasesByDraw(drawId: string | null) {
  return useQuery({
    queryKey: ['lien-releases-by-draw', drawId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lien_releases')
        .select(`
          *,
          vendors (id, name)
        `)
        .eq('draw_id', drawId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map((lr: any) => ({
        ...lr,
        vendor_name: lr.vendors?.name,
      })) as LienRelease[];
    },
    enabled: !!drawId,
  });
}

export function useChangeOrdersByDraw(drawId: string | null) {
  return useQuery({
    queryKey: ['change-orders-by-draw', drawId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select(`
          *,
          jobs (id, name)
        `)
        .eq('draw_id', drawId!)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map((co: any) => ({
        ...co,
        job_name: co.jobs?.name,
      })) as ChangeOrder[];
    },
    enabled: !!drawId,
  });
}

export function useUpdateLienRelease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LienRelease> & { id: string }) => {
      const { data, error } = await supabase
        .from('lien_releases')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw', data.draw_id] });
      toast.success('Lien release updated');
    },
    onError: (error) => {
      toast.error(`Failed to update lien release: ${error.message}`);
    },
  });
}

export function useCreateLienRelease() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lienRelease: Partial<LienRelease>) => {
      const { data, error } = await supabase
        .from('lien_releases')
        .insert([lienRelease as any])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw', data.draw_id] });
      toast.success('Lien release created');
    },
    onError: (error) => {
      toast.error(`Failed to create lien release: ${error.message}`);
    },
  });
}
