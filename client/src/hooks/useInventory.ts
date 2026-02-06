import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface InventoryItem {
  id: string;
  builder_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  category: string | null;
  unit_type: string;
  current_quantity: number;
  reorder_point: number;
  reorder_quantity: number;
  preferred_vendor_id: string | null;
  cost_code_id: string | null;
  location: string | null;
  last_count_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  preferred_vendor?: { id: string; name: string; email?: string };
  cost_code?: { id: string; code: string; name: string };
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  job_id: string | null;
  transaction_type: 'received' | 'used' | 'adjusted' | 'returned' | 'transferred';
  quantity: number;
  unit_cost: number | null;
  total_cost: number | null;
  po_id: string | null;
  invoice_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  // Joined data
  job?: { id: string; name: string };
  po?: { id: string; po_number: string };
  invoice?: { id: string; invoice_number: string };
}

export interface VendorPrice {
  id: string;
  vendor_id: string;
  item_id: string;
  sku: string | null;
  unit_price: number;
  min_quantity: number;
  effective_date: string;
  expires_at: string | null;
  lead_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  vendor?: { id: string; name: string; email?: string; phone?: string };
  vendor_name?: string;
  is_preferred?: boolean;
  total_price?: number;
}

export interface LowStockItem extends InventoryItem {
  shortage: number;
  best_price: {
    vendor_id: string;
    vendor_name: string;
    unit_price: number;
    lead_days: number | null;
  } | null;
  estimated_order_cost: number | null;
}

export interface AutoPOPreview {
  vendor_id: string;
  vendor_name: string;
  line_items: number;
  total_amount: number;
  items: Array<{
    item_id: string;
    item_name: string;
    sku: string | null;
    quantity: number;
    unit_price: number | null;
    cost_code_id: string | null;
    current_quantity: number;
    reorder_point: number;
  }>;
}

export interface AutoPOResult {
  po_id: string;
  po_number: string;
  vendor_id: string;
  vendor_name: string;
  line_items_count: number;
  total_amount: number;
  items: Array<{
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number | null;
  }>;
}

export interface PriceComparison {
  item: { id: string; name: string; sku: string | null };
  quantity: number;
  prices: VendorPrice[];
  best_price: {
    vendor_id: string;
    vendor_name: string;
    unit_price: number;
    total_price: number;
    lead_days: number | null;
  } | null;
  preferred_vendor_price: {
    vendor_id: string;
    vendor_name: string;
    unit_price: number;
    total_price: number;
    lead_days: number | null;
  } | null;
  potential_savings: number;
}

export interface InventoryStats {
  total_items: number;
  low_stock_count: number;
  categories: Record<string, { count: number; low_stock: number }>;
}

export type InventoryItemInsert = Omit<InventoryItem, 'id' | 'created_at' | 'updated_at' | 'preferred_vendor' | 'cost_code'>;
export type InventoryItemUpdate = Partial<InventoryItemInsert> & { id: string };

// ============================================================
// INVENTORY ITEMS HOOKS
// ============================================================

interface UseInventoryParams {
  category?: string;
  low_stock?: boolean;
  vendor_id?: string;
  search?: string;
}

export function useInventory(params?: UseInventoryParams) {
  return useQuery({
    queryKey: ['inventory', params],
    queryFn: async (): Promise<InventoryItem[]> => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.append('category', params.category);
      if (params?.low_stock) searchParams.append('low_stock', 'true');
      if (params?.vendor_id) searchParams.append('vendor_id', params.vendor_id);
      if (params?.search) searchParams.append('search', params.search);

      const url = `/api/inventory${searchParams.size > 0 ? `?${searchParams.toString()}` : ''}`;
      const response = await apiGet(url);
      if (!response.ok) throw new Error('Failed to fetch inventory');
      return response.json();
    },
  });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ['inventory', id],
    queryFn: async (): Promise<InventoryItem> => {
      const response = await apiGet(`/api/inventory/${id}`);
      if (!response.ok) throw new Error('Failed to fetch inventory item');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: InventoryItemInsert) => {
      const response = await apiPost('/api/inventory', item);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create inventory item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: InventoryItemUpdate) => {
      const response = await apiPatch(`/api/inventory/${id}`, updates);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update inventory item');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item updated');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiDelete(`/api/inventory/${id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete inventory item');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Inventory item deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================================
// INVENTORY ADJUSTMENTS & TRANSACTIONS
// ============================================================

interface AdjustInventoryParams {
  item_id: string;
  transaction_type: 'received' | 'used' | 'adjusted' | 'returned' | 'transferred';
  quantity: number;
  job_id?: string;
  unit_cost?: number;
  po_id?: string;
  invoice_id?: string;
  notes?: string;
  created_by?: string;
}

export function useAdjustInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item_id, ...params }: AdjustInventoryParams) => {
      const response = await apiPost(`/api/inventory/${item_id}/adjust`, params);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to adjust inventory');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success(`Inventory adjusted: ${data.previous_quantity} -> ${data.new_quantity}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useInventoryTransactions(itemId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['inventory-transactions', itemId, limit],
    queryFn: async () => {
      const response = await apiGet(`/api/inventory/${itemId}/transactions?limit=${limit}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json() as Promise<{
        data: InventoryTransaction[];
        total: number;
        limit: number;
        offset: number;
      }>;
    },
    enabled: !!itemId,
  });
}

// ============================================================
// LOW STOCK & AUTO-PO
// ============================================================

export function useLowStockItems(vendorId?: string) {
  return useQuery({
    queryKey: ['inventory', 'low-stock', vendorId],
    queryFn: async () => {
      const params = vendorId ? `?vendor_id=${vendorId}` : '';
      const response = await apiGet(`/api/inventory/low-stock${params}`);
      if (!response.ok) throw new Error('Failed to fetch low stock items');
      return response.json() as Promise<{
        items: LowStockItem[];
        count: number;
        total_estimated_cost: number;
      }>;
    },
  });
}

interface AutoPOParams {
  job_id?: string;
  created_by?: string;
  dry_run?: boolean;
}

export function useGenerateAutoPO() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AutoPOParams = {}) => {
      const response = await apiPost('/api/inventory/auto-po', params);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate auto-PO');
      }
      return response.json() as Promise<{
        success: boolean;
        dry_run?: boolean;
        preview?: AutoPOPreview[];
        vendors_count?: number;
        items_count?: number;
        total_estimated_cost?: number;
        pos_created?: number;
        pos?: AutoPOResult[];
        total_amount?: number;
        message?: string;
      }>;
    },
    onSuccess: (data) => {
      if (!data.dry_run) {
        queryClient.invalidateQueries({ queryKey: ['inventory'] });
        queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        if (data.pos_created && data.pos_created > 0) {
          toast.success(`Created ${data.pos_created} purchase order(s)`);
        } else {
          toast.info(data.message || 'No items need restocking');
        }
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================================
// PRICE COMPARISON
// ============================================================

export function useItemPrices(itemId: string | undefined, quantity = 1) {
  return useQuery({
    queryKey: ['inventory-prices', itemId, quantity],
    queryFn: async (): Promise<PriceComparison> => {
      const response = await apiGet(`/api/inventory/${itemId}/prices?quantity=${quantity}`);
      if (!response.ok) throw new Error('Failed to fetch prices');
      return response.json();
    },
    enabled: !!itemId,
  });
}

interface AddVendorPriceParams {
  item_id: string;
  vendor_id: string;
  unit_price: number;
  min_quantity?: number;
  sku?: string;
  lead_days?: number;
  effective_date?: string;
  expires_at?: string;
  notes?: string;
}

export function useAddVendorPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item_id, ...params }: AddVendorPriceParams) => {
      const response = await apiPost(`/api/inventory/${item_id}/prices`, params);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add vendor price');
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-prices', variables.item_id] });
      toast.success('Vendor price added');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useDeleteVendorPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ item_id, price_id }: { item_id: string; price_id: string }) => {
      const response = await apiDelete(`/api/inventory/${item_id}/prices/${price_id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete vendor price');
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-prices', variables.item_id] });
      toast.success('Vendor price deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================================
// STATISTICS
// ============================================================

export function useInventoryStats() {
  return useQuery({
    queryKey: ['inventory', 'stats'],
    queryFn: async (): Promise<InventoryStats> => {
      const response = await apiGet('/api/inventory/stats');
      if (!response.ok) throw new Error('Failed to fetch inventory stats');
      return response.json();
    },
  });
}

// ============================================================
// BULK OPERATIONS
// ============================================================

interface BulkImportParams {
  items: InventoryItemInsert[];
}

export function useBulkImportInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ items }: BulkImportParams) => {
      const response = await apiPost('/api/inventory/bulk-import', { items });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import inventory');
      }
      return response.json() as Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: Array<{ item: string; error: string }>;
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (data.failed > 0) {
        toast.warning(`Imported ${data.imported} items, ${data.failed} failed`);
      } else {
        toast.success(`Imported ${data.imported} items`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

interface InventoryCountItem {
  item_id: string;
  counted_quantity: number;
}

interface InventoryCountParams {
  items: InventoryCountItem[];
  counted_by?: string;
}

export function useInventoryCount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: InventoryCountParams) => {
      const response = await apiPost('/api/inventory/count', params);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit count');
      }
      return response.json() as Promise<{
        success: boolean;
        adjusted: number;
        unchanged: number;
        errors: Array<{ item_id: string; error: string }>;
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success(`Count complete: ${data.adjusted} adjusted, ${data.unchanged} unchanged`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getStockStatus(item: InventoryItem): 'in-stock' | 'low-stock' | 'out-of-stock' {
  if (item.current_quantity <= 0) return 'out-of-stock';
  if (item.reorder_point > 0 && item.current_quantity <= item.reorder_point) return 'low-stock';
  return 'in-stock';
}

export function formatQuantity(quantity: number, unitType: string): string {
  const formatted = quantity % 1 === 0 ? quantity.toString() : quantity.toFixed(2);
  return `${formatted} ${unitType}`;
}

export function calculateReorderUrgency(item: InventoryItem): number {
  if (item.reorder_point <= 0) return 0;
  if (item.current_quantity <= 0) return 100;
  const ratio = (item.reorder_point - item.current_quantity) / item.reorder_point;
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
}
