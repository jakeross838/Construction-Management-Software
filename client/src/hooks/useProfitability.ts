import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost } from '@/lib/api';

const API_BASE = '/api/profitability';

// Types
export interface JobProfitability {
  job_id: string;
  job_name: string;
  job_status: string;
  contract_amount: string;
  change_order_total: string;
  total_contract: string;
  billed_amount: string;
  total_direct: string;
  total_overhead: string;
  total_cost: string;
  gross_profit: string;
  gross_margin: string;
  net_profit: string;
  net_margin: string;
  percent_complete: string;
}

export interface ProfitabilityTotals {
  total_contract: number;
  total_cost: number;
  gross_profit: number;
  net_profit: number;
  avg_gross_margin: number;
  avg_net_margin: number;
}

export interface ProfitabilitySummary {
  jobs: JobProfitability[];
  totals: ProfitabilityTotals;
}

export interface ProfitabilityDashboard {
  summary: {
    job_count: number;
    total_contract: number;
    total_cost: number;
    gross_profit: number;
    net_profit: number;
    avg_gross_margin: number;
    avg_net_margin: number;
  };
  top_performers: JobProfitability[];
  bottom_performers: JobProfitability[];
  unprofitable_jobs: JobProfitability[];
  all_jobs: JobProfitability[];
}

export interface BudgetVsActualItem {
  job_id: string;
  cost_code_id: string;
  cost_code: string;
  cost_code_name: string;
  budget: string;
  committed: string;
  actual: string;
  variance: string;
  variance_percent: string;
}

export interface BudgetVsActualResponse {
  cost_codes: BudgetVsActualItem[];
  totals: {
    budget: number;
    committed: number;
    actual: number;
    variance: number;
  };
}

export interface JobCostDetails {
  invoices: Array<{
    amount: number;
    cost_code: { id: string; code: string; name: string; category: string };
    invoice: { id: string; invoice_number: string; invoice_date: string; vendor: { name: string } };
  }>;
  labor: Array<{
    hours: number;
    overtime_hours: number;
    base_cost: number;
    burden_amount: number;
    total_cost: number;
    work_date: string;
    cost_code: { id: string; code: string; name: string };
    employee: { id: string; first_name: string; last_name: string };
  }>;
  purchase_orders: Array<{
    amount: number;
    invoiced_amount: number;
    cost_code: { id: string; code: string; name: string };
    po: { id: string; po_number: string; vendor: { name: string } };
  }>;
}

export interface JobProfitabilitySnapshot {
  id: string;
  job_id: string;
  period_id: string;
  contract_amount: string;
  change_order_amount: string;
  total_contract: string;
  billed_to_date: string;
  material_cost: string;
  labor_base_cost: string;
  labor_burden_cost: string;
  subcontractor_cost: string;
  equipment_cost: string;
  other_direct_cost: string;
  total_direct_cost: string;
  allocated_overhead: string;
  total_indirect_cost: string;
  total_cost: string;
  gross_profit: string;
  gross_margin_percent: string;
  net_profit: string;
  net_margin_percent: string;
  percent_complete: string;
  snapshot_date: string;
  created_at: string;
  period?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

// API Functions
async function fetchProfitabilitySummary(): Promise<ProfitabilitySummary> {
  const response = await apiFetch(`${API_BASE}/summary`);
  if (!response.ok) {
    throw new Error('Failed to fetch profitability summary');
  }
  return response.json();
}

async function fetchProfitabilityDashboard(): Promise<ProfitabilityDashboard> {
  const response = await apiFetch(`${API_BASE}/dashboard`);
  if (!response.ok) {
    throw new Error('Failed to fetch profitability dashboard');
  }
  return response.json();
}

async function fetchProfitabilityRanking(sortBy: 'profit' | 'margin' = 'margin'): Promise<JobProfitability[]> {
  const response = await apiFetch(`${API_BASE}/ranking?sort_by=${sortBy}`);
  if (!response.ok) {
    throw new Error('Failed to fetch profitability ranking');
  }
  return response.json();
}

async function fetchJobProfitability(jobId: string): Promise<{
  job: { id: string; name: string; status: string; client_name: string; address: string };
  profitability: Record<string, unknown>;
  direct_costs: Record<string, unknown>;
}> {
  const response = await apiFetch(`${API_BASE}/job/${jobId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch job profitability');
  }
  return response.json();
}

async function fetchBudgetVsActual(jobId: string): Promise<BudgetVsActualResponse> {
  const response = await apiFetch(`${API_BASE}/job/${jobId}/budget-vs-actual`);
  if (!response.ok) {
    throw new Error('Failed to fetch budget vs actual');
  }
  return response.json();
}

async function fetchJobCostDetails(jobId: string): Promise<JobCostDetails> {
  const response = await apiFetch(`${API_BASE}/job/${jobId}/costs`);
  if (!response.ok) {
    throw new Error('Failed to fetch job cost details');
  }
  return response.json();
}

async function fetchJobProfitabilityHistory(jobId: string): Promise<JobProfitabilitySnapshot[]> {
  const response = await apiFetch(`${API_BASE}/job/${jobId}/history`);
  if (!response.ok) {
    throw new Error('Failed to fetch job profitability history');
  }
  return response.json();
}

async function createProfitabilitySnapshot(jobId: string, periodId: string): Promise<{ snapshot_id: string; success: boolean }> {
  const response = await apiPost(`${API_BASE}/job/${jobId}/snapshot`, { period_id: periodId });
  if (!response.ok) {
    throw new Error('Failed to create profitability snapshot');
  }
  return response.json();
}

async function createBatchSnapshots(periodId: string): Promise<{ created: number; total: number }> {
  const response = await apiPost(`${API_BASE}/snapshots/batch`, { period_id: periodId });
  if (!response.ok) {
    throw new Error('Failed to create batch snapshots');
  }
  return response.json();
}

async function compareJobs(jobIds: string[]): Promise<Array<{
  job: { id: string; name: string; status: string };
  profitability: Record<string, unknown>;
}>> {
  const response = await apiPost(`${API_BASE}/compare`, { job_ids: jobIds });
  if (!response.ok) {
    throw new Error('Failed to compare jobs');
  }
  return response.json();
}

// Hooks
export function useProfitabilitySummary() {
  return useQuery({
    queryKey: ['profitability', 'summary'],
    queryFn: fetchProfitabilitySummary,
    staleTime: 30000, // 30 seconds
  });
}

export function useProfitabilityDashboard() {
  return useQuery({
    queryKey: ['profitability', 'dashboard'],
    queryFn: fetchProfitabilityDashboard,
    staleTime: 30000,
  });
}

export function useProfitabilityRanking(sortBy: 'profit' | 'margin' = 'margin') {
  return useQuery({
    queryKey: ['profitability', 'ranking', sortBy],
    queryFn: () => fetchProfitabilityRanking(sortBy),
    staleTime: 30000,
  });
}

export function useJobProfitability(jobId: string | undefined) {
  return useQuery({
    queryKey: ['profitability', 'job', jobId],
    queryFn: () => fetchJobProfitability(jobId!),
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useBudgetVsActual(jobId: string | undefined) {
  return useQuery({
    queryKey: ['profitability', 'budget-vs-actual', jobId],
    queryFn: () => fetchBudgetVsActual(jobId!),
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useJobCostDetails(jobId: string | undefined) {
  return useQuery({
    queryKey: ['profitability', 'costs', jobId],
    queryFn: () => fetchJobCostDetails(jobId!),
    enabled: !!jobId,
    staleTime: 30000,
  });
}

export function useJobProfitabilityHistory(jobId: string | undefined) {
  return useQuery({
    queryKey: ['profitability', 'history', jobId],
    queryFn: () => fetchJobProfitabilityHistory(jobId!),
    enabled: !!jobId,
    staleTime: 60000, // 1 minute - history changes less frequently
  });
}

export function useCreateProfitabilitySnapshot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, periodId }: { jobId: string; periodId: string }) =>
      createProfitabilitySnapshot(jobId, periodId),
    onSuccess: (_, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ['profitability', 'history', jobId] });
    },
  });
}

export function useCreateBatchSnapshots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (periodId: string) => createBatchSnapshots(periodId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitability'] });
    },
  });
}

export function useCompareJobs() {
  return useMutation({
    mutationFn: (jobIds: string[]) => compareJobs(jobIds),
  });
}

// Helper to format currency
export function formatCurrency(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
}

// Helper to format percentage
export function formatPercent(value: string | number, decimals = 1): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  // If margin is already a decimal (e.g., 0.25 for 25%), multiply by 100
  const percentValue = numValue > 1 ? numValue : numValue * 100;
  return `${percentValue.toFixed(decimals)}%`;
}

// Helper to parse numeric string
export function parseNumeric(value: string | number): number {
  return typeof value === 'string' ? parseFloat(value) || 0 : value || 0;
}
