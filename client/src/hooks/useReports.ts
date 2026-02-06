import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export type EntityType =
  | 'jobs'
  | 'invoices'
  | 'vendors'
  | 'purchase_orders'
  | 'draws'
  | 'expenses'
  | 'daily_logs'
  | 'budget_lines';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'is_null'
  | 'is_not_null'
  | 'between';

export type AggregationFunction = 'sum' | 'avg' | 'min' | 'max' | 'count';

export type SortDirection = 'asc' | 'desc';

export interface ReportColumn {
  field: string;
  label?: string;
  visible?: boolean;
  width?: number;
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: string | number | boolean | string[] | number[] | [number, number];
}

export interface ReportAggregation {
  field: string;
  function: AggregationFunction;
  alias?: string;
}

export interface ReportGrouping {
  groupBy?: string[];
  aggregations?: ReportAggregation[];
}

export interface ReportSort {
  field: string;
  direction: SortDirection;
}

export interface ReportTemplate {
  id: string;
  builder_id: string | null;
  name: string;
  description: string | null;
  entity_type: EntityType;
  columns: ReportColumn[];
  filters: ReportFilter[];
  grouping: ReportGrouping;
  sort: ReportSort[];
  options: Record<string, unknown>;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportTemplateInsert {
  name: string;
  description?: string;
  entity_type: EntityType;
  columns?: ReportColumn[];
  filters?: ReportFilter[];
  grouping?: ReportGrouping;
  sort?: ReportSort[];
  options?: Record<string, unknown>;
  is_public?: boolean;
  created_by?: string;
}

export interface ReportTemplateUpdate {
  id: string;
  name?: string;
  description?: string;
  columns?: ReportColumn[];
  filters?: ReportFilter[];
  grouping?: ReportGrouping;
  sort?: ReportSort[];
  options?: Record<string, unknown>;
  is_public?: boolean;
}

export interface FieldSchema {
  type: 'uuid' | 'text' | 'number' | 'date' | 'timestamp' | 'boolean';
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  aggregatable?: boolean;
  relation?: string;
}

export interface JoinSchema {
  table: string;
  fields: string[];
}

export interface EntitySchema {
  entity: EntityType;
  label: string;
  table: string;
  fields: Record<string, FieldSchema>;
  joins: Record<string, JoinSchema>;
  defaultColumns: string[];
}

export interface EntitySchemaSummary {
  entity: EntityType;
  label: string;
  fieldCount: number;
}

export interface ReportExecuteParams {
  entity_type: EntityType;
  columns?: ReportColumn[];
  filters?: ReportFilter[];
  grouping?: ReportGrouping;
  sort?: ReportSort[];
  limit?: number;
  offset?: number;
  template_id?: string;
}

export interface ReportExecuteResult<T = Record<string, unknown>> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    executionTimeMs: number;
    groupedBy: string[] | null;
  };
}

export interface ReportPreviewResult<T = Record<string, unknown>> {
  preview: boolean;
  data: T[];
  meta: {
    total: number;
    showing: number;
    hasMore: boolean;
  };
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
// SCHEMA HOOKS
// ============================================================

/**
 * Get list of all available entity types for reports
 */
export function useReportSchemas() {
  return useQuery({
    queryKey: ['report-schemas'],
    queryFn: () => api<EntitySchemaSummary[]>('/reports/schemas'),
    staleTime: 1000 * 60 * 60, // 1 hour - schemas don't change often
  });
}

/**
 * Get detailed schema for a specific entity type
 */
export function useReportSchema(entityType: EntityType | null) {
  return useQuery({
    queryKey: ['report-schema', entityType],
    queryFn: () => api<EntitySchema>(`/reports/schema/${entityType}`),
    enabled: !!entityType,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}

// ============================================================
// TEMPLATE HOOKS
// ============================================================

/**
 * List all accessible report templates
 */
export function useReportTemplates(entityType?: EntityType) {
  const params = new URLSearchParams();
  if (entityType) params.append('entity_type', entityType);
  const queryString = params.toString();

  return useQuery({
    queryKey: ['report-templates', entityType],
    queryFn: () => api<ReportTemplate[]>(`/reports/templates${queryString ? `?${queryString}` : ''}`),
  });
}

/**
 * Get a single report template by ID
 */
export function useReportTemplate(id: string | null) {
  return useQuery({
    queryKey: ['report-template', id],
    queryFn: () => api<ReportTemplate>(`/reports/templates/${id}`),
    enabled: !!id,
  });
}

/**
 * Create a new report template
 */
export function useCreateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: ReportTemplateInsert) => {
      return api<ReportTemplate>('/reports/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Report template created');
    },
    onError: (error: Error) => {
      console.error('Failed to create report template:', error);
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

/**
 * Update an existing report template
 */
export function useUpdateReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: ReportTemplateUpdate) => {
      return api<ReportTemplate>(`/reports/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      queryClient.invalidateQueries({ queryKey: ['report-template', id] });
      toast.success('Report template updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update report template:', error);
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

/**
 * Delete a report template
 */
export function useDeleteReportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api<{ success: boolean; message: string }>(`/reports/templates/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-templates'] });
      toast.success('Report template deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete report template:', error);
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// ============================================================
// EXECUTION HOOKS
// ============================================================

/**
 * Execute a report query
 */
export function useExecuteReport() {
  return useMutation({
    mutationFn: async (params: ReportExecuteParams) => {
      return api<ReportExecuteResult>('/reports/execute', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onError: (error: Error) => {
      console.error('Failed to execute report:', error);
      toast.error(`Report execution failed: ${error.message}`);
    },
  });
}

/**
 * Preview a report (limited to 10 rows)
 */
export function usePreviewReport() {
  return useMutation({
    mutationFn: async (params: ReportExecuteParams) => {
      return api<ReportPreviewResult>('/reports/preview', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    },
    onError: (error: Error) => {
      console.error('Failed to preview report:', error);
      toast.error(`Report preview failed: ${error.message}`);
    },
  });
}

/**
 * Execute a saved template directly
 */
export function useExecuteTemplate() {
  return useMutation({
    mutationFn: async ({
      templateId,
      runtimeFilters,
      limit,
      offset
    }: {
      templateId: string;
      runtimeFilters?: ReportFilter[];
      limit?: number;
      offset?: number;
    }) => {
      // First fetch the template
      const template = await api<ReportTemplate>(`/reports/templates/${templateId}`);

      // Merge runtime filters with template filters
      const filters = runtimeFilters
        ? [...template.filters, ...runtimeFilters]
        : template.filters;

      // Execute the report
      return api<ReportExecuteResult>('/reports/execute', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: template.entity_type,
          columns: template.columns,
          filters,
          grouping: template.grouping,
          sort: template.sort,
          limit,
          offset,
          template_id: templateId,
        }),
      });
    },
    onError: (error: Error) => {
      console.error('Failed to execute template:', error);
      toast.error(`Template execution failed: ${error.message}`);
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Build filter condition for common use cases
 */
export const filterHelpers = {
  equals: (field: string, value: string | number | boolean): ReportFilter => ({
    field,
    operator: 'eq',
    value,
  }),

  notEquals: (field: string, value: string | number | boolean): ReportFilter => ({
    field,
    operator: 'neq',
    value,
  }),

  contains: (field: string, value: string): ReportFilter => ({
    field,
    operator: 'ilike',
    value,
  }),

  greaterThan: (field: string, value: number): ReportFilter => ({
    field,
    operator: 'gt',
    value,
  }),

  greaterOrEqual: (field: string, value: number | string): ReportFilter => ({
    field,
    operator: 'gte',
    value,
  }),

  lessThan: (field: string, value: number): ReportFilter => ({
    field,
    operator: 'lt',
    value,
  }),

  lessOrEqual: (field: string, value: number | string): ReportFilter => ({
    field,
    operator: 'lte',
    value,
  }),

  isIn: (field: string, values: string[] | number[]): ReportFilter => ({
    field,
    operator: 'in',
    value: values,
  }),

  isNull: (field: string): ReportFilter => ({
    field,
    operator: 'is_null',
    value: true,
  }),

  isNotNull: (field: string): ReportFilter => ({
    field,
    operator: 'is_not_null',
    value: true,
  }),

  between: (field: string, min: number, max: number): ReportFilter => ({
    field,
    operator: 'between',
    value: [min, max],
  }),

  dateRange: (field: string, startDate: string, endDate: string): ReportFilter => ({
    field,
    operator: 'between',
    value: [startDate, endDate] as [number, number],
  }),
};

/**
 * Build aggregation configuration
 */
export const aggregationHelpers = {
  sum: (field: string, alias?: string): ReportAggregation => ({
    field,
    function: 'sum',
    alias: alias || `sum_${field}`,
  }),

  avg: (field: string, alias?: string): ReportAggregation => ({
    field,
    function: 'avg',
    alias: alias || `avg_${field}`,
  }),

  min: (field: string, alias?: string): ReportAggregation => ({
    field,
    function: 'min',
    alias: alias || `min_${field}`,
  }),

  max: (field: string, alias?: string): ReportAggregation => ({
    field,
    function: 'max',
    alias: alias || `max_${field}`,
  }),

  count: (alias?: string): ReportAggregation => ({
    field: 'id',
    function: 'count',
    alias: alias || 'count',
  }),
};

/**
 * Format field labels for display
 */
export function formatFieldLabel(field: string, schema?: EntitySchema): string {
  if (!schema) {
    // Default formatting: convert snake_case to Title Case
    return field
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // Handle nested fields like 'job.name'
  if (field.includes('.')) {
    const [joinName, fieldName] = field.split('.');
    const joinSchema = schema.joins[joinName];
    if (joinSchema) {
      return `${joinName.charAt(0).toUpperCase() + joinName.slice(1)} ${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}`;
    }
  }

  // Get label from schema
  const fieldSchema = schema.fields[field];
  return fieldSchema?.label || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get operator display label
 */
export const operatorLabels: Record<FilterOperator, string> = {
  eq: 'equals',
  neq: 'not equals',
  gt: 'greater than',
  gte: 'greater or equal',
  lt: 'less than',
  lte: 'less or equal',
  like: 'matches pattern',
  ilike: 'contains',
  in: 'is one of',
  is_null: 'is empty',
  is_not_null: 'is not empty',
  between: 'is between',
};

/**
 * Get operators available for a field type
 */
export function getOperatorsForType(type: FieldSchema['type']): FilterOperator[] {
  switch (type) {
    case 'text':
      return ['eq', 'neq', 'ilike', 'like', 'in', 'is_null', 'is_not_null'];
    case 'number':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'is_null', 'is_not_null'];
    case 'date':
    case 'timestamp':
      return ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_null', 'is_not_null'];
    case 'boolean':
      return ['eq', 'neq', 'is_null', 'is_not_null'];
    case 'uuid':
      return ['eq', 'neq', 'in', 'is_null', 'is_not_null'];
    default:
      return ['eq', 'neq', 'is_null', 'is_not_null'];
  }
}
