import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiPost } from '@/lib/api';

const API_BASE = '/api/cash-flow';

// Types
export interface CashFlowSummary {
  total_receivables: number;
  total_payables: number;
  overdue_receivables: number;
  overdue_payables: number;
  net_position: number;
  payments_due_7_days: number;
  payments_overdue: number;
}

export interface CashPosition {
  total_receivables: number;
  total_payables: number;
  overdue_receivables: number;
  overdue_payables: number;
  submitted_draws: number;
  pending_payments: number;
}

export interface UpcomingPayment {
  id: string;
  vendor_name: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  urgency: 'overdue' | 'due_soon' | 'upcoming';
  job_name?: string;
}

export interface ExpectedReceipt {
  id: string;
  job_name: string;
  draw_number: number;
  total_amount: number;
  submitted_at: string;
  status: string;
}

export interface WeeklyForecast {
  id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  opening_balance: number;
  projected_inflows: number;
  projected_outflows: number;
  closing_balance: number;
}

export interface CashFlowDashboard {
  summary: CashFlowSummary;
  position: CashPosition;
  upcoming_payments: UpcomingPayment[];
  expected_receipts: ExpectedReceipt[];
  weekly_forecast: WeeklyForecast[];
}

export interface CashFlowEntry {
  id: string;
  entry_date: string;
  entry_type: 'inflow' | 'outflow';
  category: string;
  subcategory?: string;
  amount: number;
  job_id?: string;
  vendor_id?: string;
  description?: string;
  reference_number?: string;
  is_projected: boolean;
  is_recurring: boolean;
  status: string;
  job?: { id: string; name: string };
  vendor?: { id: string; name: string };
}

export interface CashFlowByJob {
  job_id: string;
  job_name: string;
  inflows: number;
  outflows: number;
  net: number;
}

// API Functions
async function fetchCashFlowDashboard(): Promise<CashFlowDashboard> {
  const response = await apiFetch(`${API_BASE}/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch cash flow dashboard');
  return response.json();
}

async function fetchCashPosition(asOfDate?: string): Promise<CashPosition> {
  const params = asOfDate ? `?as_of_date=${asOfDate}` : '';
  const response = await apiFetch(`${API_BASE}/position${params}`);
  if (!response.ok) throw new Error('Failed to fetch cash position');
  return response.json();
}

async function fetchWeeklyForecast(weeks: number = 12): Promise<WeeklyForecast[]> {
  const response = await apiFetch(`${API_BASE}/forecast/weekly?weeks=${weeks}`);
  if (!response.ok) throw new Error('Failed to fetch weekly forecast');
  return response.json();
}

async function generateForecast(params: {
  start_date?: string;
  weeks?: number;
  opening_balance?: number;
}): Promise<{ forecasts: WeeklyForecast[]; count: number }> {
  const response = await apiPost(`${API_BASE}/forecast/generate`, params);
  if (!response.ok) throw new Error('Failed to generate forecast');
  return response.json();
}

async function fetchUpcomingPayments(days: number = 30): Promise<{
  payments: {
    overdue: UpcomingPayment[];
    due_soon: UpcomingPayment[];
    upcoming: UpcomingPayment[];
  };
  totals: {
    overdue: number;
    due_soon: number;
    upcoming: number;
    total: number;
  };
}> {
  const response = await apiFetch(`${API_BASE}/payments/upcoming?days=${days}`);
  if (!response.ok) throw new Error('Failed to fetch upcoming payments');
  return response.json();
}

async function fetchExpectedReceipts(): Promise<{
  receipts: ExpectedReceipt[];
  total: number;
}> {
  const response = await apiFetch(`${API_BASE}/receipts/expected`);
  if (!response.ok) throw new Error('Failed to fetch expected receipts');
  return response.json();
}

async function fetchCashFlowByJob(params?: {
  start_date?: string;
  end_date?: string;
}): Promise<CashFlowByJob[]> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);

  const query = searchParams.toString() ? `?${searchParams}` : '';
  const response = await apiFetch(`${API_BASE}/reports/by-job${query}`);
  if (!response.ok) throw new Error('Failed to fetch cash flow by job');
  return response.json();
}

async function fetchCashFlowTrend(months: number = 6): Promise<WeeklyForecast[]> {
  const response = await apiFetch(`${API_BASE}/reports/trend?months=${months}`);
  if (!response.ok) throw new Error('Failed to fetch cash flow trend');
  return response.json();
}

async function fetchCashFlowEntries(params?: {
  start_date?: string;
  end_date?: string;
  type?: string;
  category?: string;
  job_id?: string;
}): Promise<CashFlowEntry[]> {
  const searchParams = new URLSearchParams();
  if (params?.start_date) searchParams.set('start_date', params.start_date);
  if (params?.end_date) searchParams.set('end_date', params.end_date);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.category) searchParams.set('category', params.category);
  if (params?.job_id) searchParams.set('job_id', params.job_id);

  const query = searchParams.toString() ? `?${searchParams}` : '';
  const response = await apiFetch(`${API_BASE}/entries${query}`);
  if (!response.ok) throw new Error('Failed to fetch cash flow entries');
  return response.json();
}

// Hooks
export function useCashFlowDashboard() {
  return useQuery({
    queryKey: ['cash-flow', 'dashboard'],
    queryFn: fetchCashFlowDashboard,
    staleTime: 30000,
  });
}

export function useCashPosition(asOfDate?: string) {
  return useQuery({
    queryKey: ['cash-flow', 'position', asOfDate],
    queryFn: () => fetchCashPosition(asOfDate),
    staleTime: 30000,
  });
}

export function useWeeklyForecast(weeks: number = 12) {
  return useQuery({
    queryKey: ['cash-flow', 'forecast', 'weekly', weeks],
    queryFn: () => fetchWeeklyForecast(weeks),
    staleTime: 60000,
  });
}

export function useUpcomingPayments(days: number = 30) {
  return useQuery({
    queryKey: ['cash-flow', 'payments', 'upcoming', days],
    queryFn: () => fetchUpcomingPayments(days),
    staleTime: 30000,
  });
}

export function useExpectedReceipts() {
  return useQuery({
    queryKey: ['cash-flow', 'receipts', 'expected'],
    queryFn: fetchExpectedReceipts,
    staleTime: 30000,
  });
}

export function useCashFlowByJob(params?: { start_date?: string; end_date?: string }) {
  return useQuery({
    queryKey: ['cash-flow', 'reports', 'by-job', params],
    queryFn: () => fetchCashFlowByJob(params),
    staleTime: 60000,
  });
}

export function useCashFlowTrend(months: number = 6) {
  return useQuery({
    queryKey: ['cash-flow', 'reports', 'trend', months],
    queryFn: () => fetchCashFlowTrend(months),
    staleTime: 60000,
  });
}

export function useCashFlowEntries(params?: {
  start_date?: string;
  end_date?: string;
  type?: string;
  category?: string;
  job_id?: string;
}) {
  return useQuery({
    queryKey: ['cash-flow', 'entries', params],
    queryFn: () => fetchCashFlowEntries(params),
    staleTime: 30000,
  });
}

export function useGenerateForecast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateForecast,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-flow'] });
    },
  });
}

// Helper functions
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '$0';
  if (Math.abs(amount) >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}K`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(1)}%`;
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'overdue': return 'text-red-600';
    case 'due_soon': return 'text-amber-600';
    case 'upcoming': return 'text-blue-600';
    default: return 'text-muted-foreground';
  }
}

export function getUrgencyBadgeClass(urgency: string): string {
  switch (urgency) {
    case 'overdue': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'due_soon': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'upcoming': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    default: return '';
  }
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatWeekRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
