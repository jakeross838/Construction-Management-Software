/**
 * Accounts Receivable Hooks
 * Client invoicing and payment tracking
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface ClientInvoice {
  id: string;
  builder_id: string;
  job_id: string;
  client_id: string | null;
  draw_id: string | null;
  invoice_number: string;
  description: string | null;
  amount: number;
  retainage_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  invoice_date: string;
  due_date: string | null;
  paid_at: string | null;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void';
  terms: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_by: string | null;
  sent_at: string | null;
  sent_to: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  job?: { id: string; name: string; address: string };
  client?: { id: string; name: string; email: string };
  draw?: { id: string; draw_number: number; status: string };
  payments?: ClientPayment[];
  activity?: ClientInvoiceActivity[];
}

export interface ClientPayment {
  id: string;
  builder_id: string;
  client_invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: 'check' | 'wire' | 'ach' | 'credit_card' | 'cash' | 'other';
  reference_number: string | null;
  notes: string | null;
  received_by: string | null;
  received_at: string;
  created_at: string;
}

export interface ClientInvoiceActivity {
  id: string;
  client_invoice_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ARAgingSummary {
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
  total_outstanding: number;
  invoice_count: number;
}

export interface ARAgingInvoice {
  builder_id: string;
  invoice_id: string;
  invoice_number: string;
  job_id: string;
  job_name: string;
  client_id: string | null;
  client_name: string | null;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  days_past_due: number;
  aging_bucket: 'current' | '1-30' | '31-60' | '61-90' | '90+';
}

export interface ARAgingReport {
  summary: ARAgingSummary;
  invoices: ARAgingInvoice[];
}

export interface ARSummary {
  draft_count: number;
  draft_amount: number;
  sent_count: number;
  sent_outstanding: number;
  partial_count: number;
  partial_outstanding: number;
  overdue_count: number;
  overdue_amount: number;
  paid_count: number;
  paid_amount: number;
  total_invoiced: number;
  total_collected: number;
  total_outstanding: number;
  collections_last_30_days: number;
}

// ============================================================
// API HELPER
// ============================================================

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

// ============================================================
// CLIENT INVOICES HOOKS
// ============================================================

export interface ClientInvoicesFilters {
  job_id?: string;
  client_id?: string;
  status?: ClientInvoice['status'] | 'outstanding';
  start_date?: string;
  end_date?: string;
}

export function useClientInvoices(filters: ClientInvoicesFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.job_id) queryParams.set('job_id', filters.job_id);
  if (filters.client_id) queryParams.set('client_id', filters.client_id);
  if (filters.status) queryParams.set('status', filters.status);
  if (filters.start_date) queryParams.set('start_date', filters.start_date);
  if (filters.end_date) queryParams.set('end_date', filters.end_date);

  const queryString = queryParams.toString();

  return useQuery({
    queryKey: ['ar-invoices', filters],
    queryFn: () => api<ClientInvoice[]>(`/ar/invoices${queryString ? `?${queryString}` : ''}`),
  });
}

export function useClientInvoice(id: string) {
  return useQuery({
    queryKey: ['ar-invoice', id],
    queryFn: () => api<ClientInvoice>(`/ar/invoices/${id}`),
    enabled: !!id,
  });
}

export interface CreateClientInvoiceInput {
  job_id: string;
  client_id?: string;
  draw_id?: string;
  invoice_number?: string;
  description?: string;
  amount: number;
  retainage_amount?: number;
  tax_amount?: number;
  invoice_date?: string;
  due_date?: string;
  terms?: string;
  notes?: string;
  created_by?: string;
}

export function useCreateClientInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateClientInvoiceInput) =>
      api<ClientInvoice>('/ar/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      toast.success('Client invoice created');
    },
    onError: (error: Error) => toast.error(`Failed to create invoice: ${error.message}`),
  });
}

export function useUpdateClientInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<ClientInvoice> & { id: string }) =>
      api<ClientInvoice>(`/ar/invoices/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      toast.success('Invoice updated');
    },
    onError: (error: Error) => toast.error(`Failed to update invoice: ${error.message}`),
  });
}

export function useSendClientInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sent_to, sent_by }: { id: string; sent_to?: string; sent_by?: string }) =>
      api<ClientInvoice>(`/ar/invoices/${id}/send`, {
        method: 'POST',
        body: JSON.stringify({ sent_to, sent_by }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      toast.success('Invoice marked as sent');
    },
    onError: (error: Error) => toast.error(`Failed to send invoice: ${error.message}`),
  });
}

export function useVoidClientInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason, voided_by }: { id: string; reason?: string; voided_by?: string }) =>
      api<ClientInvoice>(`/ar/invoices/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ reason, voided_by }),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging'] });
      toast.success('Invoice voided');
    },
    onError: (error: Error) => toast.error(`Failed to void invoice: ${error.message}`),
  });
}

export function useDeleteClientInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/ar/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging'] });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete invoice: ${error.message}`),
  });
}

// ============================================================
// PAYMENTS HOOKS
// ============================================================

export interface RecordPaymentInput {
  invoice_id: string;
  amount: number;
  payment_date?: string;
  payment_method?: ClientPayment['payment_method'];
  reference_number?: string;
  notes?: string;
  received_by?: string;
}

export function useRecordPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ invoice_id, ...data }: RecordPaymentInput) =>
      api<{ payment: ClientPayment; invoice: ClientInvoice }>(
        `/ar/invoices/${invoice_id}/payments`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    onSuccess: (_, { invoice_id }) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-invoice', invoice_id] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging'] });
      toast.success('Payment recorded');
    },
    onError: (error: Error) => toast.error(`Failed to record payment: ${error.message}`),
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/ar/payments/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      queryClient.invalidateQueries({ queryKey: ['ar-aging'] });
      toast.success('Payment deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete payment: ${error.message}`),
  });
}

// ============================================================
// AR AGING HOOKS
// ============================================================

export interface ARAgingFilters {
  job_id?: string;
  client_id?: string;
}

export function useARAging(filters: ARAgingFilters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.job_id) queryParams.set('job_id', filters.job_id);
  if (filters.client_id) queryParams.set('client_id', filters.client_id);

  const queryString = queryParams.toString();

  return useQuery({
    queryKey: ['ar-aging', filters],
    queryFn: () => api<ARAgingReport>(`/ar/aging${queryString ? `?${queryString}` : ''}`),
  });
}

// ============================================================
// AR SUMMARY HOOKS
// ============================================================

export function useARSummary() {
  return useQuery({
    queryKey: ['ar-summary'],
    queryFn: () => api<ARSummary>('/ar/summary'),
  });
}

// ============================================================
// BATCH OPERATIONS
// ============================================================

export function useCreateInvoicesFromDraws() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ draw_ids, created_by }: { draw_ids: string[]; created_by?: string }) =>
      api<{
        created: number;
        failed: number;
        invoices: ClientInvoice[];
        errors: Array<{ draw_id: string; error: string }>;
      }>('/ar/invoices/from-draws', {
        method: 'POST',
        body: JSON.stringify({ draw_ids, created_by }),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ar-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['ar-summary'] });
      if (result.failed > 0) {
        toast.warning(`${result.created} invoice(s) created, ${result.failed} failed`);
      } else {
        toast.success(`${result.created} invoice(s) created from draws`);
      }
    },
    onError: (error: Error) => toast.error(`Failed to create invoices: ${error.message}`),
  });
}

// ============================================================
// UTILITY HOOKS
// ============================================================

/**
 * Hook to get invoice status badge color
 */
export function useInvoiceStatusColor(status: ClientInvoice['status']): string {
  const colors: Record<ClientInvoice['status'], string> = {
    draft: 'bg-gray-500',
    sent: 'bg-blue-500',
    partial: 'bg-yellow-500',
    paid: 'bg-green-500',
    overdue: 'bg-red-500',
    void: 'bg-gray-400',
  };
  return colors[status] || 'bg-gray-500';
}

/**
 * Hook to format aging bucket for display
 */
export function useAgingBucketLabel(bucket: ARAgingInvoice['aging_bucket']): string {
  const labels: Record<ARAgingInvoice['aging_bucket'], string> = {
    current: 'Current',
    '1-30': '1-30 Days',
    '31-60': '31-60 Days',
    '61-90': '61-90 Days',
    '90+': '90+ Days',
  };
  return labels[bucket] || bucket;
}
