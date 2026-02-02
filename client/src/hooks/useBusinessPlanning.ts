import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = '/api/business-planning';

// Types
export interface BusinessPlan {
  id: string;
  plan_name: string;
  plan_type: 'annual' | 'quarterly';
  year: number;
  quarter?: number;
  start_date: string;
  end_date: string;
  revenue_target: number;
  gross_margin_target: number;
  net_margin_target: number;
  jobs_target: number;
  avg_job_size_target: number;
  labor_cost_target: number;
  material_cost_target: number;
  overhead_target: number;
  revenue_growth_target: number;
  status: 'draft' | 'active' | 'completed';
  notes?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
}

export interface PlanSummary extends BusinessPlan {
  completed_revenue?: number;
  percent_complete?: number;
}

export interface PlanPerformance {
  plan_id: string;
  revenue_actual: number;
  revenue_target: number;
  revenue_variance: number;
  revenue_percent: number;
  gross_margin_actual: number;
  gross_margin_target: number;
  net_margin_actual: number;
  net_margin_target: number;
  jobs_actual: number;
  jobs_target: number;
  avg_job_size_actual: number;
}

export interface Milestone {
  id: string;
  plan_id: string;
  milestone_name: string;
  target_date: string;
  category?: string;
  target_value?: number;
  target_metric?: string;
  actual_value?: number;
  achieved_date?: string;
  status: 'pending' | 'on_track' | 'at_risk' | 'completed' | 'missed';
  notes?: string;
}

export interface KPIDefinition {
  id: string;
  kpi_name: string;
  kpi_code: string;
  description?: string;
  category: string;
  calculation_type: string;
  format: string;
  higher_is_better: boolean;
  default_target?: number;
  warning_threshold?: number;
  danger_threshold?: number;
  is_active: boolean;
  display_order: number;
}

export interface KPITarget {
  id: string;
  plan_id: string;
  kpi_id: string;
  target_value: number;
  stretch_target?: number;
  current_value?: number;
  notes?: string;
  kpi?: KPIDefinition;
}

export interface PlanActual {
  id: string;
  plan_id: string;
  period_id: string;
  snapshot_date: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  opex: number;
  net_income: number;
  jobs_count: number;
  period?: {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
  };
}

export interface PlanDetail {
  plan: BusinessPlan;
  performance: PlanPerformance;
  milestones: Milestone[];
  actuals: PlanActual[];
  kpi_targets: KPITarget[];
}

export interface BusinessPlanningDashboard {
  active_plan: BusinessPlan | null;
  performance: PlanPerformance | null;
  upcoming_milestones: Milestone[];
  kpis: KPIDefinition[];
}

// API Functions
async function fetchDashboard(): Promise<BusinessPlanningDashboard> {
  const response = await fetch(`${API_BASE}/dashboard`);
  if (!response.ok) throw new Error('Failed to fetch business planning dashboard');
  return response.json();
}

async function fetchPlans(params?: { year?: number; status?: string }): Promise<PlanSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.year) searchParams.set('year', params.year.toString());
  if (params?.status) searchParams.set('status', params.status);

  const query = searchParams.toString() ? `?${searchParams}` : '';
  const response = await fetch(`${API_BASE}/plans${query}`);
  if (!response.ok) throw new Error('Failed to fetch plans');
  return response.json();
}

async function fetchPlanDetail(planId: string): Promise<PlanDetail> {
  const response = await fetch(`${API_BASE}/plans/${planId}`);
  if (!response.ok) throw new Error('Failed to fetch plan detail');
  return response.json();
}

async function createPlan(plan: Partial<BusinessPlan>): Promise<BusinessPlan> {
  const response = await fetch(`${API_BASE}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (!response.ok) throw new Error('Failed to create plan');
  return response.json();
}

async function updatePlan(planId: string, updates: Partial<BusinessPlan>): Promise<BusinessPlan> {
  const response = await fetch(`${API_BASE}/plans/${planId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update plan');
  return response.json();
}

async function activatePlan(planId: string, approvedBy: string): Promise<BusinessPlan> {
  const response = await fetch(`${API_BASE}/plans/${planId}/activate`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: approvedBy }),
  });
  if (!response.ok) throw new Error('Failed to activate plan');
  return response.json();
}

async function fetchMilestones(planId: string): Promise<Milestone[]> {
  const response = await fetch(`${API_BASE}/plans/${planId}/milestones`);
  if (!response.ok) throw new Error('Failed to fetch milestones');
  return response.json();
}

async function createMilestone(planId: string, milestone: Partial<Milestone>): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/plans/${planId}/milestones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(milestone),
  });
  if (!response.ok) throw new Error('Failed to create milestone');
  return response.json();
}

async function updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<Milestone> {
  const response = await fetch(`${API_BASE}/milestones/${milestoneId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update milestone');
  return response.json();
}

async function fetchKPIs(): Promise<KPIDefinition[]> {
  const response = await fetch(`${API_BASE}/kpis`);
  if (!response.ok) throw new Error('Failed to fetch KPIs');
  return response.json();
}

async function setKPITarget(planId: string, target: Partial<KPITarget>): Promise<KPITarget> {
  const response = await fetch(`${API_BASE}/plans/${planId}/kpi-targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target),
  });
  if (!response.ok) throw new Error('Failed to set KPI target');
  return response.json();
}

// Hooks
export function useBusinessPlanningDashboard() {
  return useQuery({
    queryKey: ['business-planning', 'dashboard'],
    queryFn: fetchDashboard,
    staleTime: 60000,
  });
}

export function usePlans(params?: { year?: number; status?: string }) {
  return useQuery({
    queryKey: ['business-planning', 'plans', params],
    queryFn: () => fetchPlans(params),
    staleTime: 60000,
  });
}

export function usePlanDetail(planId: string | undefined) {
  return useQuery({
    queryKey: ['business-planning', 'plans', planId],
    queryFn: () => fetchPlanDetail(planId!),
    enabled: !!planId,
    staleTime: 30000,
  });
}

export function useMilestones(planId: string | undefined) {
  return useQuery({
    queryKey: ['business-planning', 'milestones', planId],
    queryFn: () => fetchMilestones(planId!),
    enabled: !!planId,
    staleTime: 30000,
  });
}

export function useKPIs() {
  return useQuery({
    queryKey: ['business-planning', 'kpis'],
    queryFn: fetchKPIs,
    staleTime: 300000, // 5 minutes
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlan,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-planning'] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, updates }: { planId: string; updates: Partial<BusinessPlan> }) =>
      updatePlan(planId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-planning'] });
    },
  });
}

export function useActivatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, approvedBy }: { planId: string; approvedBy: string }) =>
      activatePlan(planId, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-planning'] });
    },
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, milestone }: { planId: string; milestone: Partial<Milestone> }) =>
      createMilestone(planId, milestone),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['business-planning', 'milestones', planId] });
      queryClient.invalidateQueries({ queryKey: ['business-planning', 'plans', planId] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ milestoneId, updates }: { milestoneId: string; updates: Partial<Milestone> }) =>
      updateMilestone(milestoneId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-planning'] });
    },
  });
}

export function useSetKPITarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, target }: { planId: string; target: Partial<KPITarget> }) =>
      setKPITarget(planId, target),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business-planning'] });
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
  return `${(value * 100).toFixed(1)}%`;
}

export function getMilestoneStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-600';
    case 'on_track': return 'text-blue-600';
    case 'at_risk': return 'text-amber-600';
    case 'missed': return 'text-red-600';
    case 'pending': return 'text-muted-foreground';
    default: return 'text-muted-foreground';
  }
}

export function getMilestoneStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'on_track': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'at_risk': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    case 'missed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    case 'pending': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    default: return '';
  }
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getVarianceClass(variance: number): string {
  if (variance >= 0) return 'text-green-600';
  if (variance >= -0.1) return 'text-amber-600';
  return 'text-red-600';
}
