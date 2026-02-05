import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiFetch } from '@/lib/api';

// API helper with auth
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

// =====================================================
// JOBS HOOKS
// =====================================================
export function useDBJobs() {
  return useQuery({
    queryKey: ['db-jobs'],
    queryFn: () => api<DBJob[]>('/jobs'),
  });
}

export const useJobs = useDBJobs;

export function useJob(id: string) {
  return useQuery({
    queryKey: ['db-job', id],
    queryFn: () => api<DBJob>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (job: Partial<DBJob>) => api<DBJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(job),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: Error) => toast.error(`Failed to create job: ${error.message}`),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<DBJob> & { id: string }) =>
      api<DBJob>(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['db-job', id] });
      toast.success('Job updated successfully');
    },
    onError: (error: Error) => toast.error(`Failed to update job: ${error.message}`),
  });
}

// =====================================================
// VENDORS HOOKS
// =====================================================
export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: () => api<Vendor[]>('/vendors'),
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vendor: Partial<Vendor>) => api<Vendor>('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendor),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor created successfully');
    },
    onError: (error: Error) => toast.error(`Failed to create vendor: ${error.message}`),
  });
}

// =====================================================
// COST CODES HOOKS
// =====================================================
export function useCostCodes() {
  return useQuery({
    queryKey: ['cost-codes'],
    queryFn: async () => {
      const data = await api<{ costCodes: CostCode[] } | CostCode[]>('/cost-codes');
      // API returns { costCodes: [...] } or array directly
      if (Array.isArray(data)) return data;
      return data.costCodes || [];
    },
  });
}

// =====================================================
// INVOICES HOOKS
// =====================================================
// Transform API invoice response to flatten nested objects
function transformInvoice(inv: any): Invoice {
  return {
    ...inv,
    vendor_name: inv.vendor?.name || inv.vendor_name,
    job_name: inv.job?.name || inv.job_name,
    po_number: inv.po?.po_number || inv.po_number,
    draw_id: inv.draw_invoices?.[0]?.draw_id || inv.draw_id,
  };
}

export function useInvoices(jobId?: string, status?: InvoiceStatus | 'all') {
  return useQuery({
    queryKey: ['invoices', jobId, status],
    queryFn: async () => {
      let endpoint = '/invoices?';
      if (jobId) endpoint += `job_id=${jobId}&`;
      if (status && status !== 'all') endpoint += `status=${status}&`;

      const response = await api<any>(endpoint);

      // Handle both paginated and non-paginated responses for backward compatibility
      const data = Array.isArray(response) ? response : response?.data || [];
      return data.map(transformInvoice) as Invoice[];
    },
  });
}

export interface PaginatedInvoicesResponse {
  data: Invoice[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function usePaginatedInvoices(
  jobId?: string,
  status?: InvoiceStatus | 'all',
  page: number = 1,
  limit: number = 50
) {
  return useQuery({
    queryKey: ['invoices-paginated', jobId, status, page, limit],
    queryFn: async (): Promise<PaginatedInvoicesResponse> => {
      let endpoint = `/invoices?page=${page}&limit=${limit}`;
      if (jobId) endpoint += `&job_id=${jobId}`;
      if (status && status !== 'all') endpoint += `&status=${status}`;

      const response = await api<any>(endpoint);

      return {
        data: (response?.data || []).map(transformInvoice) as Invoice[],
        meta: response?.meta || {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const data = await api<any>(`/invoices/${id}`);
      return transformInvoice(data) as Invoice;
    },
    enabled: !!id,
  });
}

// Invoice activity log
export interface InvoiceActivity {
  id: string;
  invoice_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, any> | null;
  created_at: string;
}

export function useInvoiceActivity(invoiceId: string) {
  return useQuery({
    queryKey: ['invoice-activity', invoiceId],
    queryFn: () => api<InvoiceActivity[]>(`/invoices/${invoiceId}/activity`),
    enabled: !!invoiceId,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoice: {
      job_id: string;
      vendor_id: string;
      invoice_number: string;
      invoice_date?: string;
      amount: number;
      due_date?: string;
      po_id?: string;
      description?: string;
      notes?: string;
    }) => api<Invoice>('/invoices/create', {
      method: 'POST',
      body: JSON.stringify({ ...invoice, status: 'needs_approval' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created');
    },
    onError: (error: Error) => toast.error(`Failed to create invoice: ${error.message}`),
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Invoice> & { id: string }) =>
      api<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoice updated');
    },
    onError: (error: Error) => toast.error(`Failed to update invoice: ${error.message}`),
  });
}

export function useApproveInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved_by }: { id: string; approved_by: string }) =>
      api<Invoice>(`/invoices/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approved_by })
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoice approved');
    },
    onError: (error: Error) => toast.error(`Failed to approve: ${error.message}`),
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoice deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete: ${error.message}`),
  });
}

export function useChangeInvoiceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, ...rest }: { id: string; status: InvoiceStatus; [key: string]: any }) =>
      api<Invoice>(`/invoices/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ status, ...rest })
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
    },
    onError: (error: Error) => toast.error(`Failed to change status: ${error.message}`),
  });
}

// Bulk delete invoices
export function useBulkDeleteInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/invoices/${id}?performedBy=Bulk`, { method: 'DELETE' }))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed} of ${ids.length} deletions failed`);
      }
      return { deleted: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success(`${result.deleted} invoice(s) deleted`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Bulk approve invoices
export function useBulkApproveInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, approvedBy }: { ids: string[]; approvedBy: string }) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/invoices/${id}/approve`, {
          method: 'PATCH',
          body: JSON.stringify({ approved_by: approvedBy, allow_partial: true })
        }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { succeeded, failed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      if (result.failed > 0) {
        toast.warning(`${result.succeeded} approved, ${result.failed} failed (may need allocations)`);
      } else {
        toast.success(`${result.succeeded} invoice(s) approved`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Bulk status change
export function useBulkStatusChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status, performedBy }: { ids: string[]; status: string; performedBy: string }) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/invoices/${id}/transition`, {
          method: 'POST',
          body: JSON.stringify({ new_status: status, performed_by: performedBy })
        }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { succeeded, failed, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      if (result.failed > 0) {
        toast.warning(`${result.succeeded} changed to ${result.status}, ${result.failed} failed`);
      } else {
        toast.success(`${result.succeeded} invoice(s) changed to ${result.status}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Bulk add to draw
export function useBulkAddToDraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ invoiceIds, drawId }: { invoiceIds: string[]; drawId: string }) => {
      return api(`/draws/${drawId}/add-invoices`, {
        method: 'POST',
        body: JSON.stringify({ invoice_ids: invoiceIds })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Invoices added to draw');
    },
    onError: (error: Error) => toast.error(`Failed to add to draw: ${error.message}`),
  });
}


// =====================================================
// PURCHASE ORDERS HOOKS
// =====================================================
export function usePurchaseOrders(jobId?: string, status?: string) {
  return useQuery({
    queryKey: ['purchase-orders', jobId, status],
    queryFn: async () => {
      let endpoint = '/purchase-orders?';
      if (jobId) endpoint += `job_id=${jobId}&`;
      if (status) endpoint += `status=${status}&`;

      const response = await api<any>(endpoint);

      // Handle both paginated and non-paginated responses for backward compatibility
      const data = Array.isArray(response) ? response : response?.data || [];
      return data as PurchaseOrder[];
    },
  });
}

export interface PaginatedPurchaseOrdersResponse {
  data: PurchaseOrder[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function usePaginatedPurchaseOrders(
  jobId?: string,
  status?: string,
  vendorId?: string,
  page: number = 1,
  limit: number = 50
) {
  return useQuery({
    queryKey: ['purchase-orders-paginated', jobId, status, vendorId, page, limit],
    queryFn: async (): Promise<PaginatedPurchaseOrdersResponse> => {
      let endpoint = `/purchase-orders?page=${page}&limit=${limit}`;
      if (jobId) endpoint += `&job_id=${jobId}`;
      if (status) endpoint += `&status=${status}`;
      if (vendorId) endpoint += `&vendor_id=${vendorId}`;

      const response = await api<any>(endpoint);

      return {
        data: (response?.data || []) as PurchaseOrder[],
        meta: response?.meta || {
          page,
          limit,
          total: 0,
          totalPages: 0,
          hasMore: false,
        },
      };
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (po: Partial<PurchaseOrder>) => api<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(po),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('PO created successfully');
    },
    onError: (error: Error) => toast.error(`Failed to create PO: ${error.message}`),
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<PurchaseOrder> & { id: string }) =>
      api<PurchaseOrder>(`/purchase-orders/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('PO updated');
    },
    onError: (error: Error) => toast.error(`Failed to update PO: ${error.message}`),
  });
}

export function useUpdatePOLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, poId, ...updates }: Partial<POLineItem> & { id: string; poId: string }) =>
      api(`/purchase-orders/${poId}/line-items/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
    },
    onError: (error: Error) => toast.error(`Failed to update line item: ${error.message}`),
  });
}

export function useCreatePOLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, ...item }: Partial<POLineItem> & { poId: string }) =>
      api(`/purchase-orders/${poId}/line-items`, { method: 'POST', body: JSON.stringify(item) }),
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Line item added');
    },
    onError: (error: Error) => toast.error(`Failed to add line item: ${error.message}`),
  });
}

export function useDeletePOLineItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, poId }: { id: string; poId: string }) =>
      api(`/purchase-orders/${poId}/line-items/${id}`, { method: 'DELETE' }),
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success('Line item deleted');
    },
    onError: (error: Error) => toast.error(`Failed to delete line item: ${error.message}`),
  });
}

// Bulk PO status change
export function useBulkPOStatusChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: 'open' | 'closed' | 'cancelled' }) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/purchase-orders/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status })
        }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { succeeded, failed, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      if (result.failed > 0) {
        toast.warning(`${result.succeeded} POs changed to ${result.status}, ${result.failed} failed`);
      } else {
        toast.success(`${result.succeeded} PO(s) changed to ${result.status}`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Bulk PO approval
export function useBulkPOApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, approvedBy }: { ids: string[]; approvedBy: string }) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/purchase-orders/${id}/approve`, {
          method: 'POST',
          body: JSON.stringify({ approved_by: approvedBy })
        }))
      );
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      return { succeeded, failed };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      if (result.failed > 0) {
        toast.warning(`${result.succeeded} approved, ${result.failed} failed`);
      } else {
        toast.success(`${result.succeeded} PO(s) approved`);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// Bulk delete POs
export function useBulkDeletePOs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => api(`/purchase-orders/${id}`, { method: 'DELETE' }))
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        throw new Error(`${failed} of ${ids.length} deletions failed`);
      }
      return { deleted: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['budget-summary'] });
      toast.success(`${result.deleted} PO(s) deleted`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

// =====================================================
// DRAWS HOOKS
// =====================================================
export function useDraws(jobId?: string) {
  return useQuery({
    queryKey: ['draws', jobId],
    queryFn: () => api<Draw[]>(jobId ? `/draws?job_id=${jobId}` : '/draws'),
  });
}

export function useDraw(id: string) {
  return useQuery({
    queryKey: ['draw', id],
    queryFn: () => api<Draw>(`/draws/${id}`),
    enabled: !!id,
  });
}

export function useUnassignedApprovedInvoices(jobId?: string) {
  return useQuery({
    queryKey: ['unassigned-invoices', jobId],
    queryFn: () => api<Invoice[]>(`/invoices?status=approved&unassigned=true${jobId ? `&job_id=${jobId}` : ''}`),
    enabled: !!jobId,
  });
}

export function useCreateDraw() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (draw: Partial<Draw> & { job_id: string; invoiceIds?: string[] }) => {
      const { job_id, ...drawData } = draw;
      return api<Draw>(`/jobs/${job_id}/draws`, {
        method: 'POST',
        body: JSON.stringify(drawData),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-invoices'] });
      toast.success('Draw created');
    },
    onError: (error: Error) => toast.error(`Failed to create draw: ${error.message}`),
  });
}

// =====================================================
// CHANGE ORDERS HOOKS
// =====================================================
export function useChangeOrders(jobId?: string) {
  return useQuery({
    queryKey: ['change-orders', jobId],
    queryFn: () => api<ChangeOrder[]>(jobId ? `/change-orders?job_id=${jobId}` : '/change-orders'),
  });
}

export function useCreateChangeOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (co: Partial<ChangeOrder>) => api<ChangeOrder>('/change-orders', {
      method: 'POST',
      body: JSON.stringify(co),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success('Change order created');
    },
    onError: (error: Error) => toast.error(`Failed to create CO: ${error.message}`),
  });
}

// =====================================================
// BUDGET HOOKS
// =====================================================
export function useBudgetLines(jobId: string) {
  return useQuery({
    queryKey: ['budget-lines', jobId],
    queryFn: async () => {
      const data = await api<{ budget_lines: BudgetLine[] }>(`/jobs/${jobId}/budget`);
      return data.budget_lines || [];
    },
    enabled: !!jobId,
  });
}

// =====================================================
// PO ATTACHMENTS HOOKS
// =====================================================
export function usePOAttachments(poId: string) {
  return useQuery({
    queryKey: ['po-attachments', poId],
    queryFn: () => api<any[]>(`/purchase-orders/${poId}/attachments`),
    enabled: !!poId,
  });
}

export function useUploadPOAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ poId, file, category }: { poId: string; file: File; category?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (category) formData.append('category', category);

      const response = await apiFetch(`/api/purchase-orders/${poId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: ['po-attachments', poId] });
      toast.success('Attachment uploaded');
    },
    onError: (error: Error) => toast.error(`Upload failed: ${error.message}`),
  });
}

export function useDeletePOAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ poId, attachmentId }: { poId: string; attachmentId: string }) =>
      api(`/purchase-orders/${poId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: (_, { poId }) => {
      queryClient.invalidateQueries({ queryKey: ['po-attachments', poId] });
      toast.success('Attachment deleted');
    },
    onError: (error: Error) => toast.error(`Delete failed: ${error.message}`),
  });
}

// =====================================================
// LIEN RELEASES HOOKS
// =====================================================
export function useLienReleases(jobId?: string) {
  return useQuery({
    queryKey: ['lien-releases', jobId],
    queryFn: () => api<LienRelease[]>(jobId ? `/lien-releases?job_id=${jobId}` : '/lien-releases'),
  });
}

export function useLienReleasesByDraw(drawId?: string) {
  return useQuery({
    queryKey: ['lien-releases-draw', drawId],
    queryFn: () => api<LienRelease[]>(`/lien-releases?draw_id=${drawId}`),
    enabled: !!drawId,
  });
}

// =====================================================
// CHANGE ORDERS BY DRAW
// =====================================================
export function useChangeOrdersByDraw(drawId?: string) {
  return useQuery({
    queryKey: ['change-orders-draw', drawId],
    queryFn: () => api<ChangeOrder[]>(`/change-orders?draw_id=${drawId}`),
    enabled: !!drawId,
  });
}
