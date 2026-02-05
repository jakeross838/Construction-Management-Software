import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';

// =====================================================
// TYPES
// =====================================================

export interface JobCounts {
  active: number;
  completed: number;
  on_hold: number;
  planning: number;
  total: number;
}

export interface AmountCount {
  count: number;
  amount: number;
}

export interface ExecutiveSummary {
  total_jobs: JobCounts;
  total_revenue: number;
  total_invoices_pending: AmountCount;
  total_ar_outstanding: AmountCount;
  total_committed: AmountCount;
}

export interface JobSummary {
  id: string;
  name: string;
  status: string;
  address?: string;
  client_name?: string;
  contract_amount: number;
  billed_amount: number;
  percent_complete: number;
  remaining: number;
  created_at: string;
}

export interface JobsSummaryTotals {
  total_contract: number;
  total_billed: number;
  total_remaining: number;
  job_count: number;
  overall_percent_complete: number;
}

export interface JobsSummaryResponse {
  jobs: JobSummary[];
  totals: JobsSummaryTotals;
}

export interface AgingBuckets {
  current: number;
  days_30: number;
  days_60: number;
  days_90_plus: number;
}

export interface CashPositionSummary {
  ar_invoice_count: number;
  ap_invoice_count: number;
  health: 'positive' | 'negative';
}

export interface CashPosition {
  ar_total: number;
  ap_total: number;
  net_position: number;
  ar_aging: AgingBuckets;
  ap_aging: AgingBuckets;
  summary: CashPositionSummary;
}

// =====================================================
// PIPELINE TYPES
// =====================================================

export interface PipelineStageData {
  count: number;
  estimated_value: number;
  leads: Array<{
    id: string;
    qualification_score: number;
    estimated_value: number;
    created_at: string;
  }>;
}

export interface PipelineByStage {
  inquiry: PipelineStageData;
  qualification: PipelineStageData;
  consultation: PipelineStageData;
  design_agreement: PipelineStageData;
  proposal: PipelineStageData;
  contract: PipelineStageData;
}

export interface Pipeline {
  by_stage: PipelineByStage;
  total_count: number;
  total_value: number;
  weighted_value: number;
}

export interface EstimatesPipeline {
  draft: { count: number; total_value: number };
  submitted: { count: number; total_value: number };
  approved: { count: number; total_value: number };
}

export interface ConversionRates {
  overall: number;
  total_leads: number;
  won: number;
  lost: number;
  active: number;
  by_stage: Record<string, number>;
}

export interface BacklogByStatus {
  active: { count: number; value: number };
  planning: { count: number; value: number };
  on_hold: { count: number; value: number };
}

export interface Backlog {
  total_count: number;
  total_value: number;
  by_status: BacklogByStatus;
}

export interface PipelineSummary {
  total_pipeline_and_backlog: number;
  pipeline_health: 'healthy' | 'needs_attention';
}

export interface PipelineData {
  pipeline: Pipeline;
  estimates: EstimatesPipeline;
  conversion_rates: ConversionRates;
  backlog: Backlog;
  summary: PipelineSummary;
}

// =====================================================
// API HELPER
// =====================================================

async function api<T>(endpoint: string): Promise<T> {
  const response = await apiGet(`/api/executive${endpoint}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

// =====================================================
// HOOKS
// =====================================================

/**
 * Fetch executive summary with company-wide KPIs
 * Includes: job counts, revenue, pending invoices, AR outstanding, committed amounts
 */
export function useExecutiveSummary() {
  return useQuery({
    queryKey: ['executive-summary'],
    queryFn: () => api<ExecutiveSummary>('/summary'),
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

/**
 * Fetch jobs summary with financial metrics per job
 * @param status - Optional filter by job status
 */
export function useJobsSummary(status?: string) {
  return useQuery({
    queryKey: ['executive-jobs-summary', status],
    queryFn: () => {
      const params = status && status !== 'all' ? `?status=${status}` : '';
      return api<JobsSummaryResponse>(`/jobs-summary${params}`);
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Fetch cash position including AR/AP totals and aging buckets
 */
export function useCashPosition() {
  return useQuery({
    queryKey: ['executive-cash-position'],
    queryFn: () => api<CashPosition>('/cash-position'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

/**
 * Fetch pipeline data including leads by stage, conversion rates, and backlog
 * Includes: lead pipeline, estimate pipeline, conversion rates, and job backlog
 */
export function usePipelineData() {
  return useQuery({
    queryKey: ['executive-pipeline'],
    queryFn: () => api<PipelineData>('/pipeline'),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get status color class for job status
 */
export function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'active':
      return 'text-green-500';
    case 'completed':
      return 'text-blue-500';
    case 'on_hold':
    case 'on-hold':
      return 'text-yellow-500';
    case 'planning':
      return 'text-purple-500';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get badge style for cash position health
 */
export function getCashHealthStyle(health: 'positive' | 'negative'): string {
  return health === 'positive'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
}

/**
 * Get badge style for pipeline health
 */
export function getPipelineHealthStyle(health: 'healthy' | 'needs_attention'): string {
  return health === 'healthy'
    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
}

/**
 * Get color for pipeline stage (for charts/visualizations)
 */
export function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    inquiry: '#6366f1',        // Indigo
    qualification: '#8b5cf6',  // Purple
    consultation: '#a855f7',   // Fuchsia
    design_agreement: '#d946ef', // Pink
    proposal: '#ec4899',       // Rose
    contract: '#f43f5e',       // Red
  };
  return colors[stage] || '#94a3b8'; // Default gray
}

/**
 * Format stage name for display (e.g., "design_agreement" -> "Design Agreement")
 */
export function formatStageName(stage: string): string {
  return stage
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate pipeline funnel percentages for visualization
 */
export function calculateFunnelData(pipeline: Pipeline): Array<{
  stage: string;
  label: string;
  count: number;
  value: number;
  color: string;
  percentage: number;
}> {
  const stages = ['inquiry', 'qualification', 'consultation', 'design_agreement', 'proposal', 'contract'] as const;
  const maxCount = Math.max(...stages.map(s => pipeline.by_stage[s].count), 1);

  return stages.map(stage => ({
    stage,
    label: formatStageName(stage),
    count: pipeline.by_stage[stage].count,
    value: pipeline.by_stage[stage].estimated_value,
    color: getStageColor(stage),
    percentage: (pipeline.by_stage[stage].count / maxCount) * 100
  }));
}
