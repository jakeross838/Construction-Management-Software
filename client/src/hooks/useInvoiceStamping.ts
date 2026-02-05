import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { InvoiceStatus } from '@/types/financial';
import { supabase } from '@/integrations/supabase/client';

// Get auth headers from Supabase session
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (token) {
    return { 'Authorization': `Bearer ${token}` };
  }
  return {};
}

// API helper with auth
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders, ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

interface StampInvoiceParams {
  invoiceId: string;
  status: InvoiceStatus;
}

export function useStampInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, status }: StampInvoiceParams) => {
      // Call Node.js backend for PDF stamping
      const authHeaders = await getAuthHeaders();
      const response = await fetch(`/api/invoices/${invoiceId}/stamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
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
      additionalUpdates?: Record<string, unknown>;
    }) => {
      // Update the invoice status via API
      await api(`/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: newStatus,
          ...additionalUpdates,
        }),
      });

      // Trigger re-stamping
      await stampInvoice.mutateAsync({ invoiceId, status: newStatus });

      return { invoiceId, status: newStatus };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: Error) => {
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
      allowPartial = false,
    }: {
      invoiceId: string;
      approvedBy: string;
      allowPartial?: boolean;
    }) => {
      // Use dedicated approve endpoint which handles validation
      await api(`/invoices/${invoiceId}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({
          approved_by: approvedBy,
          allow_partial: allowPartial,
        }),
      });

      // Stamp the PDF with approval details
      await stampInvoice.mutateAsync({ invoiceId, status: 'approved' });

      return { invoiceId, isPartial: allowPartial };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (result.isPartial) {
        toast.success('Invoice approved with partial allocation');
      } else {
        toast.success('Invoice approved and PDF stamped');
      }
    },
    onError: (error: Error) => {
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
      // Update invoice with draw assignment via API
      await api(`/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'in_draw',
          draw_id: drawId,
        }),
      });

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
    onError: (error: Error) => {
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

      // Update invoice to paid status via API
      await api(`/invoices/${invoiceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'paid',
          paid_at: now,
          payment_reference: paymentReference || null,
        }),
      });

      // Stamp with PAID watermark
      await stampInvoice.mutateAsync({ invoiceId, status: 'paid' });

      return { invoiceId };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice marked as paid');
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as paid: ${error.message}`);
    },
  });
}
