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

// Remove invoice from draw (set draw_id to null, status back to approved, re-stamp)
export function useRemoveInvoiceFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string) => {
      return api(`/draws/invoices/${invoiceId}/remove`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice removed from draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove invoice: ${error.message}`);
    },
  });
}

// Remove change order from draw
export function useRemoveChangeOrderFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (coId: string) => {
      return api(`/change-orders/${coId}`, {
        method: 'PATCH',
        body: JSON.stringify({ draw_id: null }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['change-orders-by-draw'] });
      toast.success('PCCO removed from draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove PCCO: ${error.message}`);
    },
  });
}

// Remove lien release from draw
export function useRemoveLienReleaseFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lrId: string) => {
      return api(`/lien-releases/${lrId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw'] });
      toast.success('Lien release removed from draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove lien release: ${error.message}`);
    },
  });
}

// Submit draw
export function useSubmitDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, submittedBy }: { drawId: string; submittedBy: string }) => {
      return api(`/draws/${drawId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submitted_by: submittedBy }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', data.id] });
      toast.success(`Draw #${data.draw_number} submitted`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit draw: ${error.message}`);
    },
  });
}

// Unsubmit draw (back to draft)
export function useUnsubmitDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawId: string) => {
      return api(`/draws/${drawId}/unsubmit`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw', data.id] });
      toast.success(`Draw #${data.draw_number} returned to draft`);
    },
    onError: (error: Error) => {
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
      return api(`/draws/${drawId}/fund`, {
        method: 'POST',
        body: JSON.stringify({
          funded_amount: fundedAmount,
          funding_status: fundingStatus,
        }),
      });
    },
    onSuccess: (data: any) => {
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
    onError: (error: Error) => {
      toast.error(`Failed to fund draw: ${error.message}`);
    },
  });
}

// Add invoice to existing draw with stamping
export function useAddInvoiceToExistingDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ invoiceId, drawId }: { invoiceId: string; drawId: string }) => {
      return api(`/draws/${drawId}/invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      toast.success('Invoice added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add invoice: ${error.message}`);
    },
  });
}
