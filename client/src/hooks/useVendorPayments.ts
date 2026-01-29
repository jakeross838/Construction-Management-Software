/**
 * Vendor Payment Hooks
 * Track payments we make to vendors (separate from client billing)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { InvoicePayment, PaymentMethod } from '@/types/financial';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface PaymentHistoryResponse {
  payments: InvoicePayment[];
  summary: {
    invoice_amount: number;
    total_paid: number;
    remaining: number;
    payment_status: 'unpaid' | 'partial' | 'paid';
  } | null;
}

export interface RecordPaymentParams {
  invoiceId: string;
  payment_method: PaymentMethod;
  payment_amount?: number;
  payment_date?: string;
  payment_reference?: string;
  payment_notes?: string;
  recorded_by?: string;
}

// Get payment history for an invoice
export function usePaymentHistory(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn: () => api<PaymentHistoryResponse>(`/invoices/${invoiceId}/payments`),
    enabled: !!invoiceId,
  });
}

// Record a vendor payment
export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, ...data }: RecordPaymentParams) =>
      api(`/invoices/${invoiceId}/pay`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Payment recorded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to record payment: ${error.message}`);
    },
  });
}

// Void all payments for an invoice
export function useVoidPayments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoiceId, voided_by, reason }: { invoiceId: string; voided_by?: string; reason?: string }) =>
      api(`/invoices/${invoiceId}/unpay`, {
        method: 'PATCH',
        body: JSON.stringify({ voided_by, reason }),
      }),
    onSuccess: (_, { invoiceId }) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Payments voided');
    },
    onError: (error: Error) => {
      toast.error(`Failed to void payments: ${error.message}`);
    },
  });
}
