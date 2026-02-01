import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { ChangeOrder, COLineItem, COStatus, COType, RequestedBy } from '@/types/financial';

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

// =====================================================
// CHANGE ORDERS HOOKS
// =====================================================

export function useChangeOrders(jobId?: string, status?: string) {
  return useQuery({
    queryKey: ['change-orders', jobId, status],
    queryFn: async () => {
      let endpoint = '/change-orders?';
      if (jobId) endpoint += `job_id=${jobId}&`;
      if (status && status !== 'all') endpoint += `status=${status}&`;
      return api<(ChangeOrder & { vendor_name?: string })[]>(endpoint);
    },
  });
}

export function useChangeOrder(id: string) {
  return useQuery({
    queryKey: ['change-order', id],
    queryFn: () => api<ChangeOrder & { job_client?: string; vendor_name?: string; line_items?: COLineItem[] }>(`/change-orders/${id}`),
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
      return api<ChangeOrder>('/change-orders', {
        method: 'POST',
        body: JSON.stringify({ ...co, line_items }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success(`Change Order ${data.co_number} created`);
    },
    onError: (error: Error) => {
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
      return api<ChangeOrder>(`/change-orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...updates, line_items }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Change order updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update change order: ${error.message}`);
    },
  });
}

export function useApproveChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by: string }) => {
      return api<ChangeOrder>(`/change-orders/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({ approved_by }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      queryClient.invalidateQueries({ queryKey: ['db-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['db-job'] });
      toast.success(`Change Order ${data.co_number} approved`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve change order: ${error.message}`);
    },
  });
}

export function useRejectChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return api<ChangeOrder>(`/change-orders/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      queryClient.invalidateQueries({ queryKey: ['change-order', data.id] });
      toast.success(`Change Order ${data.co_number} rejected`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject change order: ${error.message}`);
    },
  });
}

export function useDeleteChangeOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/change-orders/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success('Change order deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete change order: ${error.message}`);
    },
  });
}

// =====================================================
// REVISION HOOKS
// =====================================================

export interface CORevision {
  id: string;
  change_order_id: string;
  revision_number: number;
  title?: string;
  description?: string;
  reason?: string;
  amount?: number;
  base_amount?: number;
  gc_fee_percent?: number;
  gc_fee_amount?: number;
  admin_hours?: number;
  admin_rate?: number;
  admin_cost?: number;
  days_added?: number;
  markup_percent?: number;
  markup_amount?: number;
  subtotal?: number;
  total_amount?: number;
  pm_hours?: number;
  pm_hourly_rate?: number;
  pm_cost?: number;
  days_impact?: number;
  line_items?: any[];
  revision_reason?: string;
  revised_by?: string;
  created_at: string;
}

export interface RevisionComparison {
  revision1: CORevision;
  revision2: CORevision;
  changes: Array<{
    field: string;
    from: any;
    to: any;
  }>;
}

export function useChangeOrderRevisions(changeOrderId: string) {
  return useQuery({
    queryKey: ['change-order-revisions', changeOrderId],
    queryFn: () => api<CORevision[]>(`/change-orders/${changeOrderId}/revisions`),
    enabled: !!changeOrderId,
  });
}

export function useChangeOrderRevision(changeOrderId: string, revisionNumber: number) {
  return useQuery({
    queryKey: ['change-order-revision', changeOrderId, revisionNumber],
    queryFn: () => api<CORevision>(`/change-orders/${changeOrderId}/revisions/${revisionNumber}`),
    enabled: !!changeOrderId && revisionNumber >= 0,
  });
}

export function useCreateRevision() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      changeOrderId,
      revision_reason,
      revised_by,
    }: {
      changeOrderId: string;
      revision_reason: string;
      revised_by: string;
    }) => {
      return api<{ revision: CORevision; change_order: ChangeOrder }>(
        `/change-orders/${changeOrderId}/revisions`,
        {
          method: 'POST',
          body: JSON.stringify({ revision_reason, revised_by }),
        }
      );
    },
    onSuccess: (data, { changeOrderId }) => {
      queryClient.invalidateQueries({ queryKey: ['change-order-revisions', changeOrderId] });
      queryClient.invalidateQueries({ queryKey: ['change-order', changeOrderId] });
      queryClient.invalidateQueries({ queryKey: ['change-orders'] });
      toast.success(`Revision ${data.revision.revision_number} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create revision: ${error.message}`);
    },
  });
}

export function useCompareRevisions(changeOrderId: string, rev1: number, rev2: number) {
  return useQuery({
    queryKey: ['change-order-revision-compare', changeOrderId, rev1, rev2],
    queryFn: () => api<RevisionComparison>(`/change-orders/${changeOrderId}/revisions/compare/${rev1}/${rev2}`),
    enabled: !!changeOrderId && rev1 >= 0 && rev2 >= 0 && rev1 !== rev2,
  });
}
