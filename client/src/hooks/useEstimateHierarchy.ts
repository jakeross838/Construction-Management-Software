/**
 * Estimate Hierarchy Hooks
 * Full CRUD and reordering for phases → groups → subgroups → line items
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================
// TYPES
// ============================================================

export interface DBLineItem {
  id: string;
  subgroup_id: string;
  cost_code_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  amount: number;
  markup_percent: number;
  notes: string | null;
  sort_order: number;
  cost_code?: {
    id: string;
    code: string;
    name: string;
    category: string;
  } | null;
}

export interface DBSubgroup {
  id: string;
  group_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  subtotal: number;
  items: DBLineItem[];
}

export interface DBGroup {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  subtotal: number;
  subgroups: DBSubgroup[];
}

export interface DBPhase {
  id: string;
  estimate_id: string;
  name: string;
  phase_code: string | null;
  description: string | null;
  sort_order: number;
  subtotal: number;
  groups: DBGroup[];
}

export interface DBEstimateWithHierarchy {
  id: string;
  job_id: string;
  title: string;
  version: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted';
  total_amount: number;
  subtotal: number;
  markup_percent: number;
  markup_amount: number;
  overhead_percent: number;
  overhead_amount: number;
  profit_percent: number;
  profit_amount: number;
  contingency_percent: number;
  contingency_amount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string };
  phases: DBPhase[];
}

// ============================================================
// API HELPER
// ============================================================

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

// ============================================================
// FETCH FULL HIERARCHY
// ============================================================

export function useEstimateWithHierarchy(estimateId: string | undefined) {
  return useQuery({
    queryKey: ['estimate-hierarchy', estimateId],
    queryFn: async () => {
      if (!estimateId) return null;
      const data = await api<DBEstimateWithHierarchy>(`/estimates/${estimateId}`);
      return data;
    },
    enabled: !!estimateId,
    staleTime: 0, // Always refetch on mount for freshest data
  });
}

// ============================================================
// PHASE MUTATIONS
// ============================================================

export function useCreatePhase(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; phase_code?: string; description?: string }) => {
      return api<DBPhase>(`/estimates/${estimateId}/phases`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Phase created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create phase: ${error.message}`);
    },
  });
}

export function useUpdatePhase(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phaseId, ...data }: { phaseId: string; name?: string; description?: string; sort_order?: number }) => {
      return api<DBPhase>(`/estimates/${estimateId}/phases/${phaseId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update phase: ${error.message}`);
    },
  });
}

export function useDeletePhase(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phaseId: string) => {
      return api(`/estimates/${estimateId}/phases/${phaseId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Phase deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete phase: ${error.message}`);
    },
  });
}

// ============================================================
// GROUP MUTATIONS
// ============================================================

export function useCreateGroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { phaseId: string; name: string; description?: string }) => {
      const { phaseId, ...rest } = data;
      return api<DBGroup>(`/estimates/${estimateId}/phases/${phaseId}/groups`, {
        method: 'POST',
        body: JSON.stringify(rest),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Group created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });
}

export function useUpdateGroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, ...data }: { groupId: string; name?: string; description?: string; sort_order?: number }) => {
      return api<DBGroup>(`/estimates/${estimateId}/groups/${groupId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update group: ${error.message}`);
    },
  });
}

export function useDeleteGroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (groupId: string) => {
      return api(`/estimates/${estimateId}/groups/${groupId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Group deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete group: ${error.message}`);
    },
  });
}

// ============================================================
// SUBGROUP MUTATIONS
// ============================================================

export function useCreateSubgroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { groupId: string; name: string; description?: string }) => {
      const { groupId, ...rest } = data;
      return api<DBSubgroup>(`/estimates/${estimateId}/groups/${groupId}/subgroups`, {
        method: 'POST',
        body: JSON.stringify(rest),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Subgroup created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create subgroup: ${error.message}`);
    },
  });
}

export function useUpdateSubgroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subgroupId, ...data }: { subgroupId: string; name?: string; description?: string; sort_order?: number }) => {
      return api<DBSubgroup>(`/estimates/${estimateId}/subgroups/${subgroupId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update subgroup: ${error.message}`);
    },
  });
}

export function useDeleteSubgroup(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subgroupId: string) => {
      return api(`/estimates/${estimateId}/subgroups/${subgroupId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success('Subgroup deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete subgroup: ${error.message}`);
    },
  });
}

// ============================================================
// LINE ITEM MUTATIONS (using v2_estimate_line_items)
// ============================================================

export function useCreateLineItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      subgroup_id: string;
      cost_code_id?: string;
      description: string;
      quantity: number;
      unit: string;
      unit_cost: number;
      markup_percent?: number;
      notes?: string;
    }) => {
      return api<DBLineItem>(`/estimates/${estimateId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add line item: ${error.message}`);
    },
  });
}

export function useUpdateLineItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, ...data }: {
      itemId: string;
      subgroup_id?: string;
      cost_code_id?: string;
      description?: string;
      quantity?: number;
      unit?: string;
      unit_cost?: number;
      markup_percent?: number;
      notes?: string;
    }) => {
      return api<DBLineItem>(`/estimates/${estimateId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update line item: ${error.message}`);
    },
  });
}

export function useDeleteLineItem(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return api(`/estimates/${estimateId}/items/${itemId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete line item: ${error.message}`);
    },
  });
}

// ============================================================
// REORDERING
// ============================================================

export function useReorderHierarchy(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      type: 'phases' | 'groups' | 'subgroups' | 'items';
      items: Array<{ id: string; sort_order: number; parent_id?: string }>;
    }) => {
      return api(`/estimates/${estimateId}/reorder`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onMutate: async (data) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['estimate-hierarchy', estimateId] });

      // Snapshot previous value for rollback
      const previousData = queryClient.getQueryData(['estimate-hierarchy', estimateId]);

      return { previousData };
    },
    onError: (error, _, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['estimate-hierarchy', estimateId], context.previousData);
      }
      toast.error(`Failed to reorder: ${(error as Error).message}`);
    },
    onSettled: () => {
      // Always refetch after error or success to ensure sync
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
    },
  });
}

// ============================================================
// BULK OPERATIONS
// ============================================================

export function useBulkDeleteLineItems(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      return api(`/estimates/${estimateId}/items/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ item_ids: itemIds }),
      });
    },
    onSuccess: (_, itemIds) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success(`Deleted ${itemIds.length} item(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete items: ${error.message}`);
    },
  });
}

export function useBulkMoveLineItems(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { itemIds: string[]; targetSubgroupId: string }) => {
      return api(`/estimates/${estimateId}/items/bulk-move`, {
        method: 'POST',
        body: JSON.stringify({
          item_ids: data.itemIds,
          target_subgroup_id: data.targetSubgroupId,
        }),
      });
    },
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      toast.success(`Moved ${data.itemIds.length} item(s)`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to move items: ${error.message}`);
    },
  });
}

// ============================================================
// ESTIMATE METADATA UPDATE
// ============================================================

export function useUpdateEstimateSettings(estimateId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      title?: string;
      notes?: string;
      markup_percent?: number;
      overhead_percent?: number;
      profit_percent?: number;
      contingency_percent?: number;
    }) => {
      return api(`/estimates/${estimateId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-hierarchy', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update estimate: ${error.message}`);
    },
  });
}
