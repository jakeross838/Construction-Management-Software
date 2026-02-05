import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// API helper with auth
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export interface ScopeCategory {
  id: string;
  code: string;
  name: string;
  trade: string;
  description: string | null;
  primary_unit: string;
  baseline_days_per_unit: number;
  baseline_cost_per_unit: number | null;
  requires_square_footage: boolean;
  requires_linear_footage: boolean;
  requires_fixture_count: boolean;
  typical_crew_size: number;
  created_at: string;
}

export interface ScopeCategoryGrouped {
  trade: string;
  categories: ScopeCategory[];
}

// Fetch all scope categories
export function useScopeCategories() {
  return useQuery({
    queryKey: ['scope-categories'],
    queryFn: async () => {
      try {
        const response = await api<{ categories: ScopeCategory[] }>('/scope-categories');
        return response.categories || [];
      } catch (error) {
        // Return empty array if scope categories table doesn't exist
        // This is optional functionality for performance tracking
        console.warn('Scope categories not available:', error);
        return [];
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false, // Don't retry if table doesn't exist
  });
}

// Fetch scope categories grouped by trade
export function useScopeCategoriesGrouped() {
  return useQuery({
    queryKey: ['scope-categories', 'grouped'],
    queryFn: () => api<ScopeCategoryGrouped[]>('/scope-categories/grouped/by-trade'),
    staleTime: 1000 * 60 * 5,
  });
}

// Calculate estimated days based on scope category and quantity
export function calculateEstimatedDays(
  category: ScopeCategory | undefined,
  quantity: number | null | undefined
): number | null {
  if (!category || !quantity || quantity <= 0) return null;
  return Math.round(category.baseline_days_per_unit * quantity * 10) / 10;
}

// Helper to get unit label for a category
export function getUnitLabel(category: ScopeCategory | undefined): string {
  if (!category) return 'units';
  const unit = category.primary_unit;
  switch (unit) {
    case 'SF': return 'sq ft';
    case 'LF': return 'linear ft';
    case 'SY': return 'sq yds';
    case 'EA': return 'each';
    case 'LS': return 'lump sum';
    default: return unit.toLowerCase();
  }
}
