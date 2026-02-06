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

export type ExpenseCategory = 'labor-burden' | 'fleet' | 'office' | 'professional' | 'tools' | 'insurance' | 'marketing';
export type ExpenseFrequency = 'weekly' | 'monthly' | 'quarterly' | 'annual';
export type ExpenseStatus = 'active' | 'inactive' | 'cancelled';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  name: string;
  description: string | null;
  amount: number;
  recurring: boolean;
  frequency: ExpenseFrequency | null;
  vendor_id: string | null;
  payment_date: string | null;
  next_due_date: string | null;
  status: ExpenseStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendor?: {
    id: string;
    name: string;
  } | null;
}

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'vendor'>;
export type ExpenseUpdate = Partial<ExpenseInsert> & { id: string };

export const categoryConfig: Record<ExpenseCategory, { label: string; color: string }> = {
  'labor-burden': { label: 'Labor Burden', color: 'hsl(38, 92%, 50%)' },
  'fleet': { label: 'Fleet & Equipment', color: 'hsl(199, 89%, 48%)' },
  'office': { label: 'Office Overhead', color: 'hsl(142, 71%, 45%)' },
  'professional': { label: 'Professional Services', color: 'hsl(280, 65%, 60%)' },
  'tools': { label: 'Tools & Equipment', color: 'hsl(0, 72%, 51%)' },
  'insurance': { label: 'Insurance', color: 'hsl(220, 70%, 55%)' },
  'marketing': { label: 'Marketing & Sales', color: 'hsl(340, 75%, 55%)' },
};

export const frequencyConfig: Record<ExpenseFrequency, { label: string; multiplier: number }> = {
  'weekly': { label: 'Weekly', multiplier: 52 },
  'monthly': { label: 'Monthly', multiplier: 12 },
  'quarterly': { label: 'Quarterly', multiplier: 4 },
  'annual': { label: 'Annual', multiplier: 1 },
};

export function useExpenses(status?: ExpenseStatus | 'all') {
  return useQuery({
    queryKey: ['expenses', status],
    queryFn: async (): Promise<Expense[]> => {
      let endpoint = '/expenses';
      if (status && status !== 'all') {
        endpoint += `?status=${status}`;
      }
      return api<Expense[]>(endpoint);
    },
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expense', id],
    queryFn: () => api<Expense>(`/expenses/${id}`),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (expense: ExpenseInsert) => {
      return api<Expense>('/expenses', {
        method: 'POST',
        body: JSON.stringify(expense),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense created');
    },
    onError: (error: Error) => {
      console.error('Failed to create expense:', error);
      toast.error('Failed to create expense');
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ExpenseUpdate) => {
      return api<Expense>(`/expenses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update expense:', error);
      toast.error('Failed to update expense');
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/expenses/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete expense:', error);
      toast.error('Failed to delete expense');
    },
  });
}

export function calculateAnnualAmount(amount: number, frequency: ExpenseFrequency | null, recurring: boolean): number {
  if (!recurring || !frequency) return amount;
  return amount * frequencyConfig[frequency].multiplier;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
