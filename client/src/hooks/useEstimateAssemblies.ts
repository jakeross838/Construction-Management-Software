/**
 * Estimate Assemblies Hook
 * Manages reusable assembly packages for estimates
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface AssemblyComponent {
  cost_code_id?: string;
  description: string;
  quantity_formula: string;
  unit_cost: number;
  is_labor: boolean;
  // Enriched from API
  cost_code?: {
    id: string;
    code: string;
    name: string;
    category?: string;
  };
}

export interface EstimateAssembly {
  id: string;
  builder_id?: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_type: string;
  base_cost: number;
  labor_cost: number;
  material_cost: number;
  components: AssemblyComponent[];
  tags: string[];
  is_active: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  component_count: number;
}

export interface AssemblyApplication {
  id: string;
  estimate_id: string;
  assembly_id: string;
  quantity: number;
  unit_override: string | null;
  cost_multiplier: number;
  notes: string | null;
  applied_at: string;
  applied_by: string | null;
  generated_line_ids: string[];
  assembly?: {
    id: string;
    name: string;
    category: string | null;
    unit_type: string;
    base_cost: number;
  };
}

export interface AssemblyStats {
  total: number;
  active: number;
  inactive: number;
  by_category: Record<string, number>;
  total_usage: number;
  avg_base_cost: number;
}

export interface ApplyAssemblyResult {
  success: boolean;
  message: string;
  application_id: string;
  lines_created: number;
  generated_line_ids: string[];
  new_estimate_total: number;
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
 * Get all estimate assemblies with optional filters
 */
export function useEstimateAssemblies(filters?: {
  category?: string;
  unit_type?: string;
  is_active?: boolean;
  search?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();
  if (filters?.category) params.set('category', filters.category);
  if (filters?.unit_type) params.set('unit_type', filters.unit_type);
  if (filters?.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.tag) params.set('tag', filters.tag);

  const queryString = params.toString();
  const endpoint = `/estimate-assemblies${queryString ? `?${queryString}` : ''}`;

  return useQuery({
    queryKey: ['estimate-assemblies', filters],
    queryFn: () => api<EstimateAssembly[]>(endpoint),
  });
}

/**
 * Get a single assembly with full component details
 */
export function useEstimateAssembly(id: string | null) {
  return useQuery({
    queryKey: ['estimate-assembly', id],
    queryFn: () => api<EstimateAssembly>(`/estimate-assemblies/${id}`),
    enabled: !!id,
  });
}

/**
 * Get assembly statistics
 */
export function useAssemblyStats(category?: string) {
  const params = category ? `?category=${encodeURIComponent(category)}` : '';
  return useQuery({
    queryKey: ['assembly-stats', category],
    queryFn: () => api<AssemblyStats>(`/estimate-assemblies/stats${params}`),
  });
}

/**
 * Get assembly categories for filter dropdowns
 */
export function useAssemblyCategories() {
  return useQuery({
    queryKey: ['assembly-categories'],
    queryFn: () => api<string[]>('/estimate-assemblies/categories'),
  });
}

/**
 * Get assemblies applied to a specific estimate
 */
export function useEstimateAssemblyApplications(estimateId: string | null) {
  return useQuery({
    queryKey: ['estimate-assembly-applications', estimateId],
    queryFn: () => api<AssemblyApplication[]>(`/estimate-assemblies/applications/by-estimate/${estimateId}`),
    enabled: !!estimateId,
  });
}

// ============================================================
// HOOKS: MUTATIONS
// ============================================================

/**
 * Create a new assembly
 */
export function useCreateAssembly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      category?: string;
      unit_type?: string;
      components?: AssemblyComponent[];
      tags?: string[];
      created_by?: string;
    }) => api<EstimateAssembly>('/estimate-assemblies', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-assemblies'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-stats'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-categories'] });
      toast.success('Assembly created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create assembly: ${error.message}`);
    },
  });
}

/**
 * Update an assembly
 */
export function useUpdateAssembly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: Partial<EstimateAssembly> & { id: string }) =>
      api<EstimateAssembly>(`/estimate-assemblies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-assemblies'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-assembly', id] });
      queryClient.invalidateQueries({ queryKey: ['assembly-stats'] });
      toast.success('Assembly updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update assembly: ${error.message}`);
    },
  });
}

/**
 * Delete (deactivate) an assembly
 */
export function useDeleteAssembly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api<{ success: boolean; message: string }>(`/estimate-assemblies/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-assemblies'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-stats'] });
      toast.success('Assembly deactivated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete assembly: ${error.message}`);
    },
  });
}

/**
 * Apply an assembly to an estimate
 */
export function useApplyAssembly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assemblyId, ...data }: {
      assemblyId: string;
      estimate_id: string;
      quantity?: number;
      cost_multiplier?: number;
      notes?: string;
      applied_by?: string;
    }) => api<ApplyAssemblyResult>(`/estimate-assemblies/${assemblyId}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (result, { estimate_id }) => {
      queryClient.invalidateQueries({ queryKey: ['estimate-assemblies'] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate', estimate_id] });
      queryClient.invalidateQueries({ queryKey: ['db-estimate-lines', estimate_id] });
      queryClient.invalidateQueries({ queryKey: ['db-estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-assembly-applications', estimate_id] });
      toast.success(result.message);
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply assembly: ${error.message}`);
    },
  });
}

/**
 * Duplicate an assembly
 */
export function useDuplicateAssembly() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, created_by }: {
      id: string;
      name?: string;
      created_by?: string;
    }) => api<EstimateAssembly>(`/estimate-assemblies/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name, created_by }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estimate-assemblies'] });
      queryClient.invalidateQueries({ queryKey: ['assembly-stats'] });
      toast.success('Assembly duplicated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to duplicate assembly: ${error.message}`);
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Common unit types for assemblies
 */
export const ASSEMBLY_UNIT_TYPES = [
  { value: 'each', label: 'Each' },
  { value: 'sqft', label: 'Square Feet (SF)' },
  { value: 'lf', label: 'Linear Feet (LF)' },
  { value: 'cy', label: 'Cubic Yards (CY)' },
  { value: 'hr', label: 'Hours' },
  { value: 'day', label: 'Days' },
  { value: 'ls', label: 'Lump Sum' },
  { value: 'ton', label: 'Tons' },
  { value: 'gal', label: 'Gallons' },
] as const;

/**
 * Common assembly categories
 */
export const ASSEMBLY_CATEGORIES = [
  'Sitework',
  'Foundation',
  'Framing',
  'Roofing',
  'Exterior',
  'Plumbing',
  'Electrical',
  'HVAC',
  'Insulation',
  'Drywall',
  'Flooring',
  'Doors & Windows',
  'Cabinets & Millwork',
  'Painting',
  'Appliances',
  'Landscaping',
  'General Conditions',
  'Other',
] as const;

/**
 * Format assembly cost for display
 */
export function formatAssemblyCost(assembly: EstimateAssembly): string {
  const cost = assembly.base_cost || 0;
  const unit = assembly.unit_type || 'each';
  return `$${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/${unit}`;
}

/**
 * Calculate total cost for an assembly application
 */
export function calculateApplicationCost(
  assembly: EstimateAssembly,
  quantity: number,
  multiplier: number = 1
): number {
  return (assembly.base_cost || 0) * quantity * multiplier;
}
