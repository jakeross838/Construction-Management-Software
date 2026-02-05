import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// API helper with authentication
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// Remove invoice from draw (set draw_id to null, status back to approved, re-stamp)
export function useRemoveInvoiceFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, invoiceId }: { drawId: string; invoiceId: string }) => {
      return api(`/draws/${drawId}/remove-invoice`, {
        method: 'POST',
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoice removed from draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove invoice: ${error.message}`);
    },
  });
}

// Bulk remove invoices from draw
export function useBulkRemoveInvoicesFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, invoiceIds }: { drawId: string; invoiceIds: string[] }) => {
      return api<{ removed_count: number }>(`/draws/${drawId}/remove-invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_ids: invoiceIds }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success(`${data.removed_count} invoice(s) removed from draw`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove invoices: ${error.message}`);
    },
  });
}

// Bulk add invoices to draw
export function useBulkAddInvoicesToDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, invoiceIds }: { drawId: string; invoiceIds: string[] }) => {
      return api(`/draws/${drawId}/add-invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_ids: invoiceIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoices added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add invoices: ${error.message}`);
    },
  });
}

// Add all approved invoices for job to draw
export function useAddAllApprovedToDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawId: string) => {
      return api(`/draws/${drawId}/add-all-approved`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('All approved invoices added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add invoices: ${error.message}`);
    },
  });
}

// Reorder invoices within draw
export function useReorderDrawInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, invoiceIds }: { drawId: string; invoiceIds: string[] }) => {
      return api(`/draws/${drawId}/reorder-invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_ids: invoiceIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      toast.success('Invoices reordered');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder invoices: ${error.message}`);
    },
  });
}

// Remove change order billing from draw
export function useRemoveChangeOrderFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, coId }: { drawId: string; coId: string }) => {
      return api(`/draws/${drawId}/remove-co-billing/${coId}`, {
        method: 'DELETE',
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

// Add change order billing to draw
export function useAddChangeOrderToDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ drawId, changeOrderId, amount }: { drawId: string; changeOrderId: string; amount: number }) => {
      return api(`/draws/${drawId}/add-co-billing`, {
        method: 'POST',
        body: JSON.stringify({ change_order_id: changeOrderId, amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['change-orders-by-draw'] });
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success('PCCO added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add PCCO: ${error.message}`);
    },
  });
}

// Attach lien release to draw
export function useAddLienReleaseToDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ lienReleaseId, drawId }: { lienReleaseId: string; drawId: string }) => {
      return api(`/lien-releases/${lienReleaseId}/attach-to-draw`, {
        method: 'POST',
        body: JSON.stringify({ draw_id: drawId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      toast.success('Lien release added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add lien release: ${error.message}`);
    },
  });
}

// Remove lien release from draw (detach, not delete)
export function useRemoveLienReleaseFromDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lrId: string) => {
      return api(`/lien-releases/${lrId}/detach-from-draw`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases-by-draw'] });
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
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
        method: 'PATCH',
        body: JSON.stringify({ submitted_by: submittedBy }),
      });
    },
    onSuccess: (data: { id: string; draw_number: number }) => {
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
        method: 'PATCH',
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
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });

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
      return api(`/draws/${drawId}/add-invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_ids: [invoiceId] }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['draw'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-approved-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoice added to draw');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add invoice: ${error.message}`);
    },
  });
}

// Delete draw (draft only)
export function useDeleteDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawId: string) => {
      return api(`/draws/${drawId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Draw deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete draw: ${error.message}`);
    },
  });
}

// Archive draw (soft delete - any status)
export function useArchiveDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawId: string) => {
      return api(`/draws/${drawId}/archive`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Draw archived');
    },
    onError: (error: Error) => {
      toast.error(`Failed to archive draw: ${error.message}`);
    },
  });
}

// Unarchive draw
export function useUnarchiveDraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (drawId: string) => {
      return api(`/draws/${drawId}/unarchive`, { method: 'PATCH' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Draw restored');
    },
    onError: (error: Error) => {
      toast.error(`Failed to restore draw: ${error.message}`);
    },
  });
}
