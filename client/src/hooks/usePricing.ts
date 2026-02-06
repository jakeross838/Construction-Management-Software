import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ==================== TYPES ====================

export interface MasterItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  default_unit: string;
  waste_factor_percent: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorItemAlias {
  id: string;
  master_item_id: string;
  vendor_id: string;
  vendor_sku: string | null;
  vendor_description: string;
  unit_conversion_factor: number;
  vendor_unit: string | null;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
  master_item_name?: string;
}

export interface PriceHistory {
  id: string;
  master_item_id: string;
  vendor_id: string;
  unit_price: number;
  unit: string;
  quantity: number;
  source_type: 'invoice' | 'quote' | 'manual' | 'catalog';
  source_id: string | null;
  job_id: string | null;
  captured_at: string;
  notes: string | null;
  created_at: string;
  vendor_name?: string;
  master_item_name?: string;
  job_name?: string;
}

export interface CurrentPrice {
  id: string;
  master_item_id: string;
  vendor_id: string;
  latest_price: number;
  unit: string;
  price_count: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  last_updated: string;
  vendor_name?: string;
  master_item_name?: string;
  master_item_category?: string;
}

export interface PriceConfidence {
  id: string;
  master_item_id: string;
  vendor_id: string;
  recency_score: number;
  source_score: number;
  variance_score: number;
  overall_confidence: number;
  calculated_at: string;
}

export interface LaborCategory {
  id: string;
  name: string;
  description: string | null;
  min_price_per_sf: number | null;
  max_price_per_sf: number | null;
  typical_price_per_sf: number | null;
  unit: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface LaborSpecification {
  id: string;
  labor_category_id: string;
  name: string;
  description: string | null;
  price_multiplier: number;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  category_name?: string;
}

export interface LaborBid {
  id: string;
  job_id: string;
  labor_category_id: string;
  labor_specification_id: string | null;
  vendor_id: string;
  bid_amount: number;
  square_footage: number | null;
  calculated_per_sf: number | null;
  scope_description: string | null;
  inclusions: string[];
  exclusions: string[];
  terms: string | null;
  is_lowest_bid: boolean;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'withdrawn';
  submitted_at: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
  job_name?: string;
  category_name?: string;
  specification_name?: string;
}

export interface SubPerformance {
  id: string;
  vendor_id: string;
  labor_category_id: string | null;
  jobs_bid: number;
  jobs_won: number;
  jobs_completed: number;
  win_rate: number;
  avg_budget_variance: number;
  quality_score: number;
  on_time_rate: number;
  last_evaluated: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
  category_name?: string;
}

export interface BurdenClass {
  id: string;
  name: string;
  description: string | null;
  fica_rate: number;
  futa_rate: number;
  suta_rate: number;
  workers_comp_rate: number;
  health_insurance_rate: number;
  retirement_match_rate: number;
  pto_accrual_rate: number;
  other_benefits_rate: number;
  total_burden_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== MASTER ITEMS ====================

// Database returns different field names than frontend expects
interface DBMasterItem {
  id: string;
  standard_name: string;
  standard_unit: string;
  category: string;
  subcategory: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useMasterItems(category?: string) {
  return useQuery({
    queryKey: ['master-items', category],
    queryFn: async () => {
      let endpoint = '/price-intelligence/master-items';
      if (category) {
        endpoint += `?category=${encodeURIComponent(category)}`;
      }
      const data = await api<DBMasterItem[]>(endpoint);
      // Map database fields to frontend interface
      return data.map(item => ({
        id: item.id,
        name: item.standard_name,
        description: item.subcategory,
        category: item.category,
        default_unit: item.standard_unit,
        waste_factor_percent: 0,
        is_active: item.is_active,
        created_at: item.created_at,
        updated_at: item.updated_at,
      })) as MasterItem[];
    },
  });
}

export function useCreateMasterItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; category: string; description?: string; default_unit?: string; waste_factor_percent?: number }) => {
      return api<MasterItem>('/price-intelligence/master-items', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-items'] });
      toast.success('Item created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateMasterItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<MasterItem> & { id: string }) => {
      return api<MasterItem>(`/price-intelligence/master-items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['master-items'] });
      toast.success('Item updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== CURRENT PRICES ====================

export function useCurrentPrices(category?: string) {
  return useQuery({
    queryKey: ['current-prices', category],
    queryFn: async () => {
      let endpoint = '/price-intelligence/current-prices';
      if (category) {
        endpoint += `?category=${encodeURIComponent(category)}`;
      }
      return api<CurrentPrice[]>(endpoint);
    },
  });
}

// ==================== PRICE HISTORY ====================

export function usePriceHistory(masterItemId?: string, vendorId?: string) {
  return useQuery({
    queryKey: ['price-history', masterItemId, vendorId],
    queryFn: async () => {
      let endpoint = '/price-intelligence/price-history?';
      if (masterItemId) endpoint += `master_item_id=${masterItemId}&`;
      if (vendorId) endpoint += `vendor_id=${vendorId}&`;
      return api<PriceHistory[]>(endpoint);
    },
  });
}

export function useCreatePriceEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { master_item_id: string; vendor_id: string; unit_price: number; unit: string; source_type: string; quantity?: number; source_id?: string; job_id?: string; notes?: string }) => {
      return api<PriceHistory>('/price-intelligence/price-history', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-history'] });
      queryClient.invalidateQueries({ queryKey: ['current-prices'] });
      toast.success('Price recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== LABOR CATEGORIES ====================

export function useLaborCategories() {
  return useQuery({
    queryKey: ['labor-categories'],
    queryFn: async () => {
      return api<LaborCategory[]>('/labor-bids/categories');
    },
  });
}

export function useUpdateLaborCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<LaborCategory> & { id: string }) => {
      return api<LaborCategory>(`/labor-bids/categories/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-categories'] });
      toast.success('Category updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== LABOR BIDS ====================

export function useLaborBids(jobId?: string) {
  return useQuery({
    queryKey: ['labor-bids', jobId],
    queryFn: async () => {
      let endpoint = '/labor-bids';
      if (jobId) {
        endpoint += `?job_id=${jobId}`;
      }
      return api<LaborBid[]>(endpoint);
    },
  });
}

export function useCreateLaborBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { job_id: string; labor_category_id: string; vendor_id: string; bid_amount: number; labor_specification_id?: string; square_footage?: number; scope_description?: string; inclusions?: string[]; exclusions?: string[]; terms?: string; valid_until?: string; notes?: string }) => {
      return api<LaborBid>('/labor-bids', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-bids'] });
      toast.success('Bid recorded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLaborBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<LaborBid> & { id: string }) => {
      return api<LaborBid>(`/labor-bids/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor-bids'] });
      toast.success('Bid updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BURDEN CLASSES ====================

export function useBurdenClasses() {
  return useQuery({
    queryKey: ['burden-classes'],
    queryFn: async () => {
      return api<BurdenClass[]>('/overhead/burden-classes');
    },
  });
}

export function useUpdateBurdenClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BurdenClass> & { id: string }) => {
      return api<BurdenClass>(`/overhead/burden-classes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['burden-classes'] });
      toast.success('Burden class updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== SUB PERFORMANCE ====================

export function useSubPerformance(vendorId?: string) {
  return useQuery({
    queryKey: ['sub-performance', vendorId],
    queryFn: async () => {
      let endpoint = '/vendors/performance';
      if (vendorId) {
        endpoint += `?vendor_id=${vendorId}`;
      }
      return api<SubPerformance[]>(endpoint);
    },
  });
}

// ==================== CATEGORIES ====================

export const MATERIAL_CATEGORIES = [
  'lumber',
  'drywall',
  'insulation',
  'roofing',
  'tile',
  'flooring',
  'electrical',
  'plumbing',
  'paint',
  'hardware',
  'concrete',
  'masonry',
  'windows',
  'doors',
  'cabinets',
  'countertops',
  'appliances',
  'hvac',
  'other',
];

export const PRICE_SOURCE_TYPES = [
  { value: 'invoice', label: 'Invoice', color: 'text-green-600' },
  { value: 'quote', label: 'Quote', color: 'text-blue-600' },
  { value: 'manual', label: 'Manual Entry', color: 'text-amber-600' },
  { value: 'catalog', label: 'Catalog', color: 'text-purple-600' },
];

export const BID_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'expired', label: 'Expired', color: 'bg-gray-100 text-gray-700' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-600' },
];
