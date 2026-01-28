import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper function to trigger invoice re-stamping
async function stampInvoice(invoiceId: string, status: string): Promise<void> {
  try {
    await supabase.functions.invoke('stamp-invoice', {
      body: { invoiceId, status },
    });
  } catch (error) {
    console.error('Failed to stamp invoice:', invoiceId, error);
    // Don't throw - stamping failure shouldn't break the main operation
  }
}

// Remove invoice from draw (set draw_id to null, status back to approved, re-stamp)
export function useRemoveInvoiceFromDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase
        .from('v2_invoices')
        .update({ draw_id: null, status: 'approved' })
        .eq('id', invoiceId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Re-stamp the invoice with approved stamp (removing draw badge)
      await stampInvoice(invoiceId, 'approved');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice removed from draw');
    },
    onError: (error) => {
      toast.error(`Failed to remove invoice: ${error.message}`);
    },
  });
}

// Remove change order from draw
export function useRemoveChangeOrderFromDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (coId: string) => {
      const { data, error } = await supabase
        .from('change_orders')
        .update({ draw_id: null })
        .eq('id', coId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['change-orders-by-draw'] });
      toast.success('PCCO removed from draw');
    },
    onError: (error) => {
      toast.error(`Failed to remove PCCO: ${error.message}`);
    },
  });
}

// Remove lien release from draw
export function useRemoveLienReleaseFromDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (lrId: string) => {
      const { data, error } = await supabase
        .from('lien_releases')
        .delete()
        .eq('id', lrId);
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw'] });
      toast.success('Lien release removed from draw');
    },
    onError: (error) => {
      toast.error(`Failed to remove lien release: ${error.message}`);
    },
  });
}

// Submit draw
export function useSubmitDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ drawId, submittedBy }: { drawId: string; submittedBy: string }) => {
      const { data, error } = await supabase
        .from('draws')
        .update({ 
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: submittedBy,
        })
        .eq('id', drawId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', data.id] });
      toast.success(`Draw #${data.draw_number} submitted`);
    },
    onError: (error) => {
      toast.error(`Failed to submit draw: ${error.message}`);
    },
  });
}

// Unsubmit draw (back to draft)
export function useUnsubmitDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (drawId: string) => {
      const { data, error } = await supabase
        .from('draws')
        .update({ 
          status: 'draft',
          submitted_at: null,
          submitted_by: null,
        })
        .eq('id', drawId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', data.id] });
      toast.success(`Draw #${data.draw_number} returned to draft`);
    },
    onError: (error) => {
      toast.error(`Failed to unsubmit draw: ${error.message}`);
    },
  });
}

export type FundingStatus = 'funded' | 'partial' | 'over';

// Mark draw as funded with amount (also marks invoices as paid and stamps them)
export function useFundDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      drawId, 
      fundedAmount,
      fundingStatus,
    }: { 
      drawId: string; 
      fundedAmount: number;
      fundingStatus: FundingStatus;
    }) => {
      // Determine the status - for partial/over we keep it as submitted or create a variance note
      const status = fundingStatus === 'funded' ? 'funded' : 'funded';
      
      const { data, error } = await supabase
        .from('draws')
        .update({ 
          status,
          funded_at: new Date().toISOString(),
          funded_amount: fundedAmount,
        })
        .eq('id', drawId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Mark all invoices in this draw as paid and re-stamp them
      const { data: drawInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('draw_id', drawId);
      
      if (drawInvoices && drawInvoices.length > 0) {
        // Update all invoices to paid status
        await supabase
          .from('v2_invoices')
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
          })
          .eq('draw_id', drawId);
        
        // Stamp each invoice with PAID watermark (in parallel)
        await Promise.all(
          drawInvoices.map(inv => stampInvoice(inv.id, 'paid'))
        );
      }
      
      return { ...data, fundingStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', data.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      
      const statusText = data.fundingStatus === 'partial' 
        ? 'partially funded' 
        : data.fundingStatus === 'over' 
        ? 'over-funded' 
        : 'funded';
      toast.success(`Draw #${data.draw_number} marked as ${statusText}`);
    },
    onError: (error) => {
      toast.error(`Failed to fund draw: ${error.message}`);
    },
  });
}

// Add invoice to existing draw with stamping
export function useAddInvoiceToExistingDraw() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ invoiceId, drawId }: { invoiceId: string; drawId: string }) => {
      const { data, error } = await supabase
        .from('v2_invoices')
        .update({
          draw_id: drawId,
          status: 'in_draw',
        })
        .eq('id', invoiceId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Stamp the invoice with in_draw status (includes draw badge)
      await stampInvoice(invoiceId, 'in_draw');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      toast.success('Invoice added to draw');
    },
    onError: (error) => {
      toast.error(`Failed to add invoice: ${error.message}`);
    },
  });
}
