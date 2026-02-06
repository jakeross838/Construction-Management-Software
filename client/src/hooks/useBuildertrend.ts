import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiFetch } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export type BuildertrendImportType = 'jobs' | 'schedules' | 'budgets' | 'contacts';
export type BuildertrendImportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BuildertrendImport {
  id: string;
  builder_id?: string;
  import_type: BuildertrendImportType;
  file_name?: string;
  status: BuildertrendImportStatus;
  records_imported: number;
  records_skipped: number;
  records_failed: number;
  errors: ImportError[];
  mapping_notes?: {
    fieldMapping?: Record<string, string>;
    warnings?: string[];
  };
  imported_by?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ImportError {
  row?: number;
  error: string;
  data?: Record<string, string>;
}

export interface ImportRecord {
  id: string;
  import_id: string;
  bt_record_id?: string;
  entity_type: string;
  local_entity_id?: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  error_message?: string;
  raw_data?: Record<string, unknown>;
  created_at: string;
}

export interface ImportResult {
  success: boolean;
  import_id: string;
  summary: {
    total_rows: number;
    imported: number;
    skipped: number;
    failed: number;
  };
  field_mapping: Record<string, string>;
  warnings: string[];
  errors: ImportError[];
}

export interface ImportTemplate {
  type: BuildertrendImportType;
  headers: string[];
  sample: string[][];
  description: string;
  supported_fields: string[];
}

export interface PreviewResult {
  type: BuildertrendImportType;
  totalRows: number;
  successCount: number;
  errorCount: number;
  fieldMapping: Record<string, string>;
  warnings: string[];
  errors: ImportError[];
  preview: Record<string, unknown>[];
}

// ============================================================
// API FUNCTIONS
// ============================================================

async function importFile(
  type: BuildertrendImportType,
  file: File,
  options?: { job_id?: string; imported_by?: string }
): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.job_id) {
    formData.append('job_id', options.job_id);
  }
  if (options?.imported_by) {
    formData.append('imported_by', options.imported_by);
  }

  const response = await apiFetch(`/api/integrations/buildertrend/import/${type}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to import ${type}`);
  }

  return response.json();
}

async function fetchImports(params?: {
  import_type?: BuildertrendImportType;
  status?: BuildertrendImportStatus;
  limit?: number;
  offset?: number;
}): Promise<{ imports: BuildertrendImport[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.import_type) searchParams.append('import_type', params.import_type);
  if (params?.status) searchParams.append('status', params.status);
  if (params?.limit) searchParams.append('limit', params.limit.toString());
  if (params?.offset) searchParams.append('offset', params.offset.toString());

  const response = await apiGet(`/api/integrations/buildertrend/imports?${searchParams}`);
  if (!response.ok) {
    throw new Error('Failed to fetch imports');
  }
  return response.json();
}

async function fetchImportDetails(id: string): Promise<{
  import: BuildertrendImport;
  records: ImportRecord[];
}> {
  const response = await apiGet(`/api/integrations/buildertrend/imports/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch import details');
  }
  return response.json();
}

async function fetchTemplate(type: BuildertrendImportType): Promise<ImportTemplate> {
  const response = await apiGet(`/api/integrations/buildertrend/template/${type}`);
  if (!response.ok) {
    throw new Error('Failed to fetch template');
  }
  return response.json();
}

async function downloadTemplate(type: BuildertrendImportType): Promise<void> {
  const response = await apiGet(`/api/integrations/buildertrend/template/${type}?format=csv`);
  if (!response.ok) {
    throw new Error('Failed to download template');
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `buildertrend_${type}_template.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

async function previewFile(type: BuildertrendImportType, file: File): Promise<PreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', type);

  const response = await apiFetch('/api/integrations/buildertrend/preview', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to preview file');
  }

  return response.json();
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Fetch list of past imports
 */
export function useBuildertrendImports(params?: {
  import_type?: BuildertrendImportType;
  status?: BuildertrendImportStatus;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['buildertrend-imports', params],
    queryFn: () => fetchImports(params),
  });
}

/**
 * Fetch details of a specific import
 */
export function useBuildertrendImportDetails(id: string | null) {
  return useQuery({
    queryKey: ['buildertrend-import', id],
    queryFn: () => fetchImportDetails(id!),
    enabled: !!id,
  });
}

/**
 * Fetch CSV template for an import type
 */
export function useBuildertrendTemplate(type: BuildertrendImportType) {
  return useQuery({
    queryKey: ['buildertrend-template', type],
    queryFn: () => fetchTemplate(type),
  });
}

/**
 * Import jobs from CSV
 */
export function useImportJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { file: File; imported_by?: string }) =>
      importFile('jobs', params.file, { imported_by: params.imported_by }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildertrend-imports'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

/**
 * Import schedule tasks from CSV
 */
export function useImportSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { file: File; job_id?: string; imported_by?: string }) =>
      importFile('schedules', params.file, {
        job_id: params.job_id,
        imported_by: params.imported_by,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildertrend-imports'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

/**
 * Import budget lines from CSV
 */
export function useImportBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { file: File; job_id?: string; imported_by?: string }) =>
      importFile('budgets', params.file, {
        job_id: params.job_id,
        imported_by: params.imported_by,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildertrend-imports'] });
      queryClient.invalidateQueries({ queryKey: ['budget'] });
      queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
    },
  });
}

/**
 * Import contacts/vendors from CSV
 */
export function useImportContacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { file: File; imported_by?: string }) =>
      importFile('contacts', params.file, { imported_by: params.imported_by }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buildertrend-imports'] });
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

/**
 * Preview CSV before importing
 */
export function usePreviewFile() {
  return useMutation({
    mutationFn: (params: { type: BuildertrendImportType; file: File }) =>
      previewFile(params.type, params.file),
  });
}

/**
 * Download CSV template
 */
export function useDownloadTemplate() {
  return useMutation({
    mutationFn: (type: BuildertrendImportType) => downloadTemplate(type),
  });
}

/**
 * Generic import function that supports all types
 */
export function useImportFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      type: BuildertrendImportType;
      file: File;
      job_id?: string;
      imported_by?: string;
    }) =>
      importFile(params.type, params.file, {
        job_id: params.job_id,
        imported_by: params.imported_by,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['buildertrend-imports'] });

      // Invalidate relevant queries based on import type
      switch (variables.type) {
        case 'jobs':
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          break;
        case 'schedules':
          queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['schedules'] });
          break;
        case 'budgets':
          queryClient.invalidateQueries({ queryKey: ['budget'] });
          queryClient.invalidateQueries({ queryKey: ['budget-lines'] });
          break;
        case 'contacts':
          queryClient.invalidateQueries({ queryKey: ['vendors'] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
          break;
      }
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get human-readable label for import type
 */
export function getImportTypeLabel(type: BuildertrendImportType): string {
  const labels: Record<BuildertrendImportType, string> = {
    jobs: 'Jobs/Projects',
    schedules: 'Schedule Tasks',
    budgets: 'Budget Lines',
    contacts: 'Contacts/Vendors',
  };
  return labels[type] || type;
}

/**
 * Get status badge color class
 */
export function getStatusColor(status: BuildertrendImportStatus): string {
  const colors: Record<BuildertrendImportStatus, string> = {
    pending: 'bg-yellow-500/20 text-yellow-400',
    processing: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };
  return colors[status] || 'bg-gray-500/20 text-gray-400';
}

/**
 * Format import summary for display
 */
export function formatImportSummary(importData: BuildertrendImport): string {
  const parts = [];
  if (importData.records_imported > 0) {
    parts.push(`${importData.records_imported} imported`);
  }
  if (importData.records_skipped > 0) {
    parts.push(`${importData.records_skipped} skipped`);
  }
  if (importData.records_failed > 0) {
    parts.push(`${importData.records_failed} failed`);
  }
  return parts.join(', ') || 'No records processed';
}
