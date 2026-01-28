import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { InvoiceStatus } from '@/types/financial';

interface StampInvoiceParams {
  invoiceId: string;
  status: InvoiceStatus;
}

export function useStampInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: StampInvoiceParams) => {
      // Call Node.js backend for PDF stamping
      const response = await fetch(`/api/invoices/${invoiceId}/stamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to stamp invoice: HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data?.success) throw new Error(data?.error || 'Failed to stamp invoice');

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      console.error('Stamp invoice error:', error);
      toast.error('Failed to stamp invoice PDF');
    },
  });
}

// Hook to stamp invoice on status change
export function useInvoiceStatusChange() {
  const queryClient = useQueryClient();
  const stampInvoice = useStampInvoice();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      newStatus,
      additionalUpdates = {},
    }: {
      invoiceId: string;
      newStatus: InvoiceStatus;
      additionalUpdates?: Record<string, any>;
    }) => {
      // Update the invoice status
      const { error: updateError } = await supabase
        .from('v2_invoices')
        .update({
          status: newStatus,
          ...additionalUpdates,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Trigger re-stamping
      await stampInvoice.mutateAsync({ invoiceId, status: newStatus });

      return { invoiceId, status: newStatus };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      toast.error(`Failed to update invoice: ${error.message}`);
    },
  });
}

// Hook specifically for approving with stamping
export function useApproveAndStampInvoice() {
  const queryClient = useQueryClient();
  const stampInvoice = useStampInvoice();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      approvedBy,
    }: {
      invoiceId: string;
      approvedBy: string;
    }) => {
      const now = new Date().toISOString();

      // Update invoice to approved status
      const { error: updateError } = await supabase
        .from('v2_invoices')
        .update({
          status: 'approved',
          approved_at: now,
          approved_by: approvedBy,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Stamp the PDF with approval details
      await stampInvoice.mutateAsync({ invoiceId, status: 'approved' });

      return { invoiceId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice approved and PDF stamped');
    },
    onError: (error) => {
      toast.error(`Failed to approve invoice: ${error.message}`);
    },
  });
}

// Hook for adding invoice to draw with re-stamping
export function useAddInvoiceToDraw() {
  const queryClient = useQueryClient();
  const stampInvoice = useStampInvoice();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      drawId,
    }: {
      invoiceId: string;
      drawId: string;
    }) => {
      // Update invoice with draw assignment
      const { error: updateError } = await supabase
        .from('v2_invoices')
        .update({
          status: 'in_draw',
          draw_id: drawId,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Re-stamp with draw badge
      await stampInvoice.mutateAsync({ invoiceId, status: 'in_draw' });

      return { invoiceId, drawId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['draw', variables.drawId] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Invoice added to draw');
    },
    onError: (error) => {
      toast.error(`Failed to add to draw: ${error.message}`);
    },
  });
}

// Hook for marking invoice as paid with watermark
export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  const stampInvoice = useStampInvoice();

  return useMutation({
    mutationFn: async ({
      invoiceId,
      paymentReference,
    }: {
      invoiceId: string;
      paymentReference?: string;
    }) => {
      const now = new Date().toISOString();

      // Update invoice to paid status
      const { error: updateError } = await supabase
        .from('v2_invoices')
        .update({
          status: 'paid',
          paid_at: now,
          payment_reference: paymentReference || null,
        })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // Stamp with PAID watermark
      await stampInvoice.mutateAsync({ invoiceId, status: 'paid' });

      return { invoiceId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice marked as paid');
    },
    onError: (error) => {
      toast.error(`Failed to mark as paid: ${error.message}`);
    },
  });
}
