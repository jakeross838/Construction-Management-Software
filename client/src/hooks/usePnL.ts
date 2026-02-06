import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

const API_BASE = '/api/pnl';

// Types
export interface PnLData {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  gross_margin: number;
  total_opex: number;
  operating_income: number;
  operating_margin: number;
  net_income: number;
  net_margin: number;
}

export interface MonthlyTrend {
  id?: string;
  period_name?: string;
  start_date: string;
  end_date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
  gross_margin: number;
  net_margin: number;
}

export interface TopJob {
  job_id: string;
  job_name: string;
  total_contract: number;
  total_cost: number;
  gross_profit: number;
  net_profit: number;
  net_margin: number;
}

export interface FinancialPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
}

export interface PnLDashboard {
  ytd: PnLData;
  current_period: FinancialPeriod | null;
  current_pnl: PnLData | null;
  monthly_trend: MonthlyTrend[];
  top_jobs: TopJob[];
}

export interface CostBreakdown {
  category: string;
  amount: number;
}

export interface RevenueByJob {
  job_id: string;
  job_name: string;
  billed_amount: number;
  contract_amount: number;
}

// API Functions
async function fetchPnLDashboard(year?: number): Promise<PnLDashboard> {
  const params = year ? `?year=${year}` : '';
  const response = await apiFetch(`${API_BASE}/dashboard${params}`);
  if (!response.ok) throw new Error('Failed to fetch P&L dashboard');
  return response.json();
}

async function fetchYTD(year?: number): Promise<PnLData> {
  const params = year ? `?year=${year}` : '';
  const response = await apiFetch(`${API_BASE}/ytd${params}`);
  if (!response.ok) throw new Error('Failed to fetch YTD P&L');
  return response.json();
}

async function fetchPnLForRange(startDate: string, endDate: string): Promise<PnLData> {
  const response = await apiFetch(`${API_BASE}/calculate?start_date=${startDate}&end_date=${endDate}`);
  if (!response.ok) throw new Error('Failed to calculate P&L');
  return response.json();
}

async function fetchPnLTrend(): Promise<MonthlyTrend[]> {
  const response = await apiFetch(`${API_BASE}/trend`);
  if (!response.ok) throw new Error('Failed to fetch P&L trend');
  return response.json();
}

async function fetchRevenueByJob(): Promise<RevenueByJob[]> {
  const response = await apiFetch(`${API_BASE}/revenue/by-job`);
  if (!response.ok) throw new Error('Failed to fetch revenue by job');
  return response.json();
}

async function fetchCostsByCategory(): Promise<CostBreakdown[]> {
  const response = await apiFetch(`${API_BASE}/costs/by-category`);
  if (!response.ok) throw new Error('Failed to fetch costs by category');
  return response.json();
}

// Hooks
export function usePnLDashboard(year?: number) {
  return useQuery({
    queryKey: ['pnl', 'dashboard', year],
    queryFn: () => fetchPnLDashboard(year),
    staleTime: 60000, // 1 minute
  });
}

export function useYTD(year?: number) {
  return useQuery({
    queryKey: ['pnl', 'ytd', year],
    queryFn: () => fetchYTD(year),
    staleTime: 60000,
  });
}

export function usePnLForRange(startDate: string | undefined, endDate: string | undefined) {
  return useQuery({
    queryKey: ['pnl', 'range', startDate, endDate],
    queryFn: () => fetchPnLForRange(startDate!, endDate!),
    enabled: !!startDate && !!endDate,
    staleTime: 60000,
  });
}

export function usePnLTrend() {
  return useQuery({
    queryKey: ['pnl', 'trend'],
    queryFn: fetchPnLTrend,
    staleTime: 60000,
  });
}

export function useRevenueByJob() {
  return useQuery({
    queryKey: ['pnl', 'revenue', 'by-job'],
    queryFn: fetchRevenueByJob,
    staleTime: 60000,
  });
}

export function useCostsByCategory() {
  return useQuery({
    queryKey: ['pnl', 'costs', 'by-category'],
    queryFn: fetchCostsByCategory,
    staleTime: 60000,
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
  // If value is already a decimal (e.g., 0.15), multiply by 100
  const pct = Math.abs(value) < 1 ? value * 100 : value;
  return `${pct.toFixed(1)}%`;
}

export function getMarginColor(margin: number): string {
  if (margin >= 0.15) return 'text-green-600';
  if (margin >= 0.08) return 'text-amber-600';
  return 'text-red-600';
}

export function formatMonthFromDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short' });
}
