import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/wip';

// Types
export interface WIPJob {
  job_id: string;
  job_name: string;
  job_status: string;
  client_name: string;
  original_contract: number | null;
  approved_changes: number | null;
  revised_contract: number | null;
  estimated_cost: number | null;
  cost_to_date: number | null;
  estimated_cost_to_complete: number | null;
  revised_estimated_cost: number | null;
  percent_complete: number | null;
  earned_revenue: number | null;
  billed_to_date: number | null;
  overbilling: number | null;
  underbilling: number | null;
  estimated_gross_profit: number | null;
  gross_profit_to_date: number | null;
  projected_final_cost: number | null;
  projected_final_profit: number | null;
  projected_margin: number | null;
}

export interface WIPSummary {
  total_revised_contract: number;
  total_earned_revenue: number;
  total_billed: number;
  total_cost_to_date: number;
  total_overbilling: number;
  total_underbilling: number;
  total_projected_profit: number;
  job_count: number;
  overbilled_jobs: WIPJob[];
  underbilled_jobs: WIPJob[];
  at_risk_jobs: WIPJob[];
  net_wip_position: number;
  avg_projected_margin: number;
}

export interface WIPDashboard {
  summary: WIPSummary;
  jobs: WIPJob[];
}

export interface WIPAgingBucket {
  jobs: WIPJob[];
  total_contract: number;
  total_cost: number;
}

export interface WIPAgingReport {
  '0-25%': WIPAgingBucket;
  '26-50%': WIPAgingBucket;
  '51-75%': WIPAgingBucket;
  '76-99%': WIPAgingBucket;
  '100%': WIPAgingBucket;
}

export interface WIPBillingReport {
  overbilled: WIPJob[];
  underbilled: WIPJob[];
  balanced: WIPJob[];
  summary: {
    total_overbilling: number;
    total_underbilling: number;
    overbilled_count: number;
    underbilled_count: number;
    balanced_count: number;
  };
}

// API Functions
async function fetchWIPDashboard(): Promise<WIPDashboard> {
  const response = await fetch(`${API_BASE}/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch WIP dashboard');
  return response.json();
}

async function fetchWIPCurrent(): Promise<WIPJob[]> {
  const response = await fetch(`${API_BASE}/current`);
  if (!response.ok) throw new Error('Failed to fetch current WIP');
  return response.json();
}

async function fetchWIPSummary(): Promise<WIPSummary> {
  const response = await fetch(`${API_BASE}/summary`);
  if (!response.ok) throw new Error('Failed to fetch WIP summary');
  return response.json();
}

async function fetchJobWIP(jobId: string): Promise<{
  job: { id: string; name: string; status: string; client_name: string; contract_amount: number };
  wip: WIPJob;
  estimates: Array<{ id: string; estimate_type: string; total_estimated_cost: number; effective_date: string }>;
}> {
  const response = await fetch(`${API_BASE}/job/${jobId}`);
  if (!response.ok) throw new Error('Failed to fetch job WIP');
  return response.json();
}

async function fetchAgingReport(): Promise<WIPAgingReport> {
  const response = await fetch(`${API_BASE}/reports/aging`);
  if (!response.ok) throw new Error('Failed to fetch aging report');
  return response.json();
}

async function fetchBillingReport(): Promise<WIPBillingReport> {
  const response = await fetch(`${API_BASE}/reports/billing`);
  if (!response.ok) throw new Error('Failed to fetch billing report');
  return response.json();
}

async function createWIPSnapshot(jobId: string, periodId: string): Promise<{ snapshot_id: string; success: boolean }> {
  const response = await fetch(`${API_BASE}/job/${jobId}/snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period_id: periodId }),
  });
  if (!response.ok) throw new Error('Failed to create WIP snapshot');
  return response.json();
}

// Hooks
export function useWIPDashboard() {
  return useQuery({
    queryKey: ['wip', 'dashboard'],
    queryFn: fetchWIPDashboard,
    staleTime: 30000,
  });
}

export function useWIPCurrent() {
  return useQuery({
    queryKey: ['wip', 'current'],
    queryFn: fetchWIPCurrent,
    staleTime: 30000,
  });
}

export function useWIPSummary() {
  return useQuery({
    queryKey: ['wip', 'summary'],
    queryFn: fetchWIPSummary,
    staleTime: 30000,
  });
}

export function useJobWIP(jobId: string | undefined) {
  return useQuery({
    queryKey: ['wip', 'job', jobId],
    queryFn: () => fetchJobWIP(jobId!),
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useWIPAgingReport() {
  return useQuery({
    queryKey: ['wip', 'reports', 'aging'],
    queryFn: fetchAgingReport,
    staleTime: 60000,
  });
}

export function useWIPBillingReport() {
  return useQuery({
    queryKey: ['wip', 'reports', 'billing'],
    queryFn: fetchBillingReport,
    staleTime: 60000,
  });
}

export function useCreateWIPSnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, periodId }: { jobId: string; periodId: string }) =>
      createWIPSnapshot(jobId, periodId),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['wip'] });
    },
  });
}

// Helper functions
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function getWIPStatus(job: WIPJob): 'overbilled' | 'underbilled' | 'balanced' | 'at-risk' {
  if ((job.overbilling ?? 0) > 0) return 'overbilled';
  if ((job.underbilling ?? 0) > 0) return 'underbilled';
  if ((job.projected_margin ?? 0) < 0.05) return 'at-risk';
  return 'balanced';
}

export function getWIPStatusColor(status: ReturnType<typeof getWIPStatus>): string {
  switch (status) {
    case 'overbilled': return 'text-amber-600';
    case 'underbilled': return 'text-blue-600';
    case 'at-risk': return 'text-red-600';
    case 'balanced': return 'text-green-600';
  }
}
