/**
 * Historical Costs Hook
 * Cost trending and analytics for construction projects
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface HistoricalCost {
  id: string;
  builder_id?: string;
  job_id: string | null;
  cost_code_id: string | null;
  vendor_id: string | null;
  description: string | null;
  unit_type: string | null;
  unit_cost: number | null;
  quantity: number;
  total_cost: number;
  cost_date: string;
  source: 'invoice' | 'estimate' | 'po' | 'manual' | 'bid';
  source_id: string | null;
  job_type: string | null;
  sqft: number | null;
  location: string | null;
  year: number;
  month: number;
  quarter: number;
  created_at: string;
  // Joined relations
  cost_code?: { id: string; code: string; name: string };
  vendor?: { id: string; name: string };
  job?: { id: string; name: string };
}

export interface HistoricalCostStats {
  total_records: number;
  total_value: number;
  by_source: Record<string, number>;
  by_year: Record<string, number>;
}

export interface CostTrend {
  period: string;
  count: number;
  total_cost: number;
  avg_total_cost: number;
  avg_unit_cost: number | null;
  min_unit_cost: number | null;
  max_unit_cost: number | null;
}

export interface CostTrendsResponse {
  cost_code_id: string;
  period: 'month' | 'quarter' | 'year';
  trends: CostTrend[];
  summary: {
    total_records: number;
    trend_direction: 'increasing' | 'decreasing' | 'stable';
    trend_percent: number;
    first_date: string | null;
    last_date: string | null;
  };
}

export interface CostAverageResponse {
  cost_code_id: string;
  period_months: number;
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  median: number | null;
  by_vendor: VendorCostSummary[];
  by_unit_type: Record<string, {
    count: number;
    total: number;
    avg_unit_cost: number | null;
  }>;
}

export interface VendorCostSummary {
  vendor_id: string;
  vendor_name: string;
  count: number;
  total: number;
  avg_unit_cost: number | null;
}

export interface VendorComparisonResponse {
  cost_code_id: string;
  period_months: number;
  vendor_count: number;
  vendors: VendorComparisonEntry[];
  best_value: VendorComparisonEntry | null;
  most_used: VendorComparisonEntry | null;
}

export interface VendorComparisonEntry {
  vendor_id: string;
  vendor_name: string;
  invoice_count: number;
  total_spent: number;
  avg_unit_cost: number | null;
  min_unit_cost: number | null;
  max_unit_cost: number | null;
  last_cost_date: string | null;
  rank: number;
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
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// HOOKS: QUERIES
// ============================================================

/**
 * Get historical costs with filters
 */
export function useHistoricalCosts(filters?: {
  cost_code_id?: string;
  vendor_id?: string;
  job_id?: string;
  source?: string;
  year?: number;
  limit?: number;
  offset?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.cost_code_id) params.set('cost_code_id', filters.cost_code_id);
  if (filters?.vendor_id) params.set('vendor_id', filters.vendor_id);
  if (filters?.job_id) params.set('job_id', filters.job_id);
  if (filters?.source) params.set('source', filters.source);
  if (filters?.year) params.set('year', String(filters.year));
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const queryString = params.toString();
  const endpoint = `/historical-costs${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['historical-costs', filters],
    queryFn: () => api<{
      data: HistoricalCost[];
      total: number;
      limit: number;
      offset: number;
    }>(endpoint),
  });
}

/**
 * Get historical cost statistics
 */
export function useHistoricalCostStats(filters?: {
  cost_code_id?: string;
  vendor_id?: string;
  year?: number;
}) {
  const params = new URLSearchParams();
  if (filters?.cost_code_id) params.set('cost_code_id', filters.cost_code_id);
  if (filters?.vendor_id) params.set('vendor_id', filters.vendor_id);
  if (filters?.year) params.set('year', String(filters.year));

  const queryString = params.toString();
  const endpoint = `/historical-costs/stats${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['historical-cost-stats', filters],
    queryFn: () => api<HistoricalCostStats>(endpoint),
  });
}

/**
 * Get cost trends over time for a specific cost code
 */
export function useCostTrends(
  costCodeId: string | null,
  options?: {
    vendor_id?: string;
    unit_type?: string;
    period?: 'month' | 'quarter' | 'year';
    limit?: number;
  }
) {
  const params = new URLSearchParams();
  if (costCodeId) params.set('cost_code_id', costCodeId);
  if (options?.vendor_id) params.set('vendor_id', options.vendor_id);
  if (options?.unit_type) params.set('unit_type', options.unit_type);
  if (options?.period) params.set('period', options.period);
  if (options?.limit) params.set('limit', String(options.limit));

  const queryString = params.toString();
  const endpoint = `/historical-costs/trends${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['cost-trends', costCodeId, options],
    queryFn: () => api<CostTrendsResponse>(endpoint),
    enabled: !!costCodeId,
  });
}

/**
 * Get average cost per unit for a cost code
 */
export function useCostAverage(
  costCodeId: string | null,
  options?: {
    vendor_id?: string;
    unit_type?: string;
    months?: number;
    job_type?: string;
  }
) {
  const params = new URLSearchParams();
  if (costCodeId) params.set('cost_code_id', costCodeId);
  if (options?.vendor_id) params.set('vendor_id', options.vendor_id);
  if (options?.unit_type) params.set('unit_type', options.unit_type);
  if (options?.months) params.set('months', String(options.months));
  if (options?.job_type) params.set('job_type', options.job_type);

  const queryString = params.toString();
  const endpoint = `/historical-costs/average${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['cost-average', costCodeId, options],
    queryFn: () => api<CostAverageResponse>(endpoint),
    enabled: !!costCodeId,
  });
}

/**
 * Compare vendors for a specific cost code
 */
export function useVendorComparison(
  costCodeId: string | null,
  months: number = 12
) {
  const params = new URLSearchParams();
  if (costCodeId) params.set('cost_code_id', costCodeId);
  params.set('months', String(months));

  const endpoint = `/historical-costs/compare-vendors?${params.toString()}`;

  return useQuery({
    queryKey: ['vendor-comparison', costCodeId, months],
    queryFn: () => api<VendorComparisonResponse>(endpoint),
    enabled: !!costCodeId,
  });
}

// ============================================================
// HOOKS: MUTATIONS
// ============================================================

/**
 * Add a manual cost record
 */
export function useAddHistoricalCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      job_id?: string;
      cost_code_id?: string;
      vendor_id?: string;
      description?: string;
      unit_type?: string;
      unit_cost?: number;
      quantity?: number;
      total_cost?: number;
      cost_date?: string;
      source?: 'invoice' | 'estimate' | 'po' | 'manual' | 'bid';
      job_type?: string;
      sqft?: number;
      location?: string;
    }) => api<HistoricalCost>('/historical-costs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-costs'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cost-stats'] });
      queryClient.invalidateQueries({ queryKey: ['cost-trends'] });
      queryClient.invalidateQueries({ queryKey: ['cost-average'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-comparison'] });
      toast.success('Cost record added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add cost record: ${error.message}`);
    },
  });
}

/**
 * Bulk import cost records
 */
export function useBulkImportCosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (costs: Array<{
      job_id?: string;
      cost_code_id?: string;
      vendor_id?: string;
      description?: string;
      unit_type?: string;
      unit_cost?: number;
      quantity?: number;
      total_cost?: number;
      cost_date?: string;
      source?: string;
      job_type?: string;
      sqft?: number;
      location?: string;
    }>) => api<{ success: boolean; imported: number; message: string }>('/historical-costs/bulk', {
      method: 'POST',
      body: JSON.stringify({ costs }),
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['historical-costs'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cost-stats'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(`Failed to import costs: ${error.message}`);
    },
  });
}

/**
 * Delete a cost record
 */
export function useDeleteHistoricalCost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean; message: string }>(`/historical-costs/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-costs'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cost-stats'] });
      toast.success('Cost record deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete cost record: ${error.message}`);
    },
  });
}

/**
 * Backfill historical costs from existing invoices
 */
export function useBackfillFromInvoices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (limit?: number) =>
      api<{ success: boolean; captured: number; invoices_processed: number; message: string }>(
        '/historical-costs/backfill-from-invoices',
        {
          method: 'POST',
          body: JSON.stringify({ limit }),
        }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['historical-costs'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cost-stats'] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(`Failed to backfill costs: ${error.message}`);
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Format trend direction with icon
 */
export function formatTrendDirection(direction: 'increasing' | 'decreasing' | 'stable'): {
  icon: string;
  color: string;
  label: string;
} {
  switch (direction) {
    case 'increasing':
      return { icon: 'trending-up', color: 'text-red-500', label: 'Increasing' };
    case 'decreasing':
      return { icon: 'trending-down', color: 'text-green-500', label: 'Decreasing' };
    default:
      return { icon: 'minus', color: 'text-gray-500', label: 'Stable' };
  }
}

/**
 * Format cost trend percentage
 */
export function formatTrendPercent(percent: number): string {
  const sign = percent >= 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

/**
 * Get cost data for chart display
 */
export function prepareTrendChartData(trends: CostTrend[]): {
  labels: string[];
  avgCosts: (number | null)[];
  minCosts: (number | null)[];
  maxCosts: (number | null)[];
} {
  return {
    labels: trends.map(t => t.period),
    avgCosts: trends.map(t => t.avg_unit_cost),
    minCosts: trends.map(t => t.min_unit_cost),
    maxCosts: trends.map(t => t.max_unit_cost),
  };
}

/**
 * Calculate savings vs highest vendor
 */
export function calculateVendorSavings(
  comparison: VendorComparisonResponse
): { vendor: string; savings: number; percent: number } | null {
  if (!comparison.vendors || comparison.vendors.length < 2) return null;

  const withCosts = comparison.vendors.filter(v => v.avg_unit_cost !== null);
  if (withCosts.length < 2) return null;

  const sorted = [...withCosts].sort((a, b) => (a.avg_unit_cost || 0) - (b.avg_unit_cost || 0));
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  const savings = (highest.avg_unit_cost || 0) - (lowest.avg_unit_cost || 0);
  const percent = highest.avg_unit_cost ? (savings / highest.avg_unit_cost) * 100 : 0;

  return {
    vendor: lowest.vendor_name,
    savings,
    percent,
  };
}

/**
 * Common sources for filtering
 */
export const COST_SOURCES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'estimate', label: 'Estimate' },
  { value: 'po', label: 'Purchase Order' },
  { value: 'bid', label: 'Bid' },
  { value: 'manual', label: 'Manual Entry' },
] as const;

/**
 * Common period options for trend analysis
 */
export const TREND_PERIODS = [
  { value: 'month', label: 'Monthly' },
  { value: 'quarter', label: 'Quarterly' },
  { value: 'year', label: 'Yearly' },
] as const;
