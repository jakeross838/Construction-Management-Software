import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export function useMasterItems(category?: string) {
  return useQuery({
    queryKey: ['master-items', category],
    queryFn: async () => {
      let query = supabase
        .from('v2_master_items')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MasterItem[];
    },
  });
}

export function useCreateMasterItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; category: string; description?: string; default_unit?: string; waste_factor_percent?: number }) => {
      const { data: result, error } = await supabase
        .from('v2_master_items')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
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
      const { data: result, error } = await supabase
        .from('v2_master_items')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
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
      const { data, error } = await supabase
        .from('v2_current_prices')
        .select(`
          *,
          v2_master_items!inner(name, category),
          vendors!inner(name)
        `)
        .order('last_updated', { ascending: false });

      if (error) throw error;

      let results = (data || []).map((p: any) => ({
        ...p,
        master_item_name: p.v2_master_items?.name,
        master_item_category: p.v2_master_items?.category,
        vendor_name: p.vendors?.name,
      })) as CurrentPrice[];

      if (category) {
        results = results.filter(p => p.master_item_category === category);
      }

      return results;
    },
  });
}

// ==================== PRICE HISTORY ====================

export function usePriceHistory(masterItemId?: string, vendorId?: string) {
  return useQuery({
    queryKey: ['price-history', masterItemId, vendorId],
    queryFn: async () => {
      let query = supabase
        .from('v2_price_history')
        .select(`
          *,
          v2_master_items(name),
          vendors(name),
          jobs(name)
        `)
        .order('captured_at', { ascending: false })
        .limit(100);

      if (masterItemId) query = query.eq('master_item_id', masterItemId);
      if (vendorId) query = query.eq('vendor_id', vendorId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p,
        master_item_name: p.v2_master_items?.name,
        vendor_name: p.vendors?.name,
        job_name: p.jobs?.name,
      })) as PriceHistory[];
    },
  });
}

export function useCreatePriceEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { master_item_id: string; vendor_id: string; unit_price: number; unit: string; source_type: string; quantity?: number; source_id?: string; job_id?: string; notes?: string }) => {
      const { data: result, error } = await supabase
        .from('v2_price_history')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
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
      const { data, error } = await supabase
        .from('v2_labor_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;
      return data as LaborCategory[];
    },
  });
}

export function useUpdateLaborCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<LaborCategory> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('v2_labor_categories')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
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
      let query = supabase
        .from('v2_labor_bids')
        .select(`
          *,
          vendors(name),
          jobs(name),
          v2_labor_categories(name),
          v2_labor_specifications(name)
        `)
        .order('submitted_at', { ascending: false });

      if (jobId) query = query.eq('job_id', jobId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((b: any) => ({
        ...b,
        inclusions: b.inclusions || [],
        exclusions: b.exclusions || [],
        vendor_name: b.vendors?.name,
        job_name: b.jobs?.name,
        category_name: b.v2_labor_categories?.name,
        specification_name: b.v2_labor_specifications?.name,
      })) as LaborBid[];
    },
  });
}

export function useCreateLaborBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { job_id: string; labor_category_id: string; vendor_id: string; bid_amount: number; labor_specification_id?: string; square_footage?: number; scope_description?: string; inclusions?: string[]; exclusions?: string[]; terms?: string; valid_until?: string; notes?: string }) => {
      const insertData = {
        ...data,
        inclusions: data.inclusions as any,
        exclusions: data.exclusions as any,
      };
      const { data: result, error } = await supabase
        .from('v2_labor_bids')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return result;
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
      const updateData = {
        ...data,
        inclusions: data.inclusions as any,
        exclusions: data.exclusions as any,
      };
      const { data: result, error } = await supabase
        .from('v2_labor_bids')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
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
      const { data, error } = await supabase
        .from('v2_burden_classes')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as BurdenClass[];
    },
  });
}

export function useUpdateBurdenClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<BurdenClass> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('v2_burden_classes')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
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
      let query = supabase
        .from('v2_sub_performance')
        .select(`
          *,
          vendors(name),
          v2_labor_categories(name)
        `)
        .order('quality_score', { ascending: false });

      if (vendorId) query = query.eq('vendor_id', vendorId);

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p,
        vendor_name: p.vendors?.name,
        category_name: p.v2_labor_categories?.name,
      })) as SubPerformance[];
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
