import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE = '/api/lead-imports';

export interface LeadImport {
  id: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  error_log: Array<{ row: number; error: string; data: Record<string, any> }>;
  created_lead_ids: string[];
  imported_by: string;
  started_at: string;
  completed_at: string;
  created_at: string;
}

export interface ImportMapping {
  id: string;
  name: string;
  description: string;
  mappings: Record<string, string>;
  defaults: Record<string, any>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadField {
  name: string;
  label: string;
  required: boolean;
}

// Fetch import history
export function useImportHistory(limit: number = 20) {
  return useQuery({
    queryKey: ['lead-imports', limit],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch imports');
      return res.json() as Promise<LeadImport[]>;
    },
  });
}

// Fetch single import
export function useImportDetails(importId: string | null) {
  return useQuery({
    queryKey: ['lead-import', importId],
    queryFn: async () => {
      if (!importId) return null;
      const res = await fetch(`${API_BASE}/${importId}`);
      if (!res.ok) throw new Error('Failed to fetch import');
      return res.json() as Promise<LeadImport>;
    },
    enabled: !!importId,
  });
}

// Preview CSV
export function usePreviewCSV() {
  return useMutation({
    mutationFn: async ({ csvContent, sampleSize = 5 }: { csvContent: string; sampleSize?: number }) => {
      const res = await fetch(`${API_BASE}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvContent, sample_size: sampleSize }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to preview CSV');
      }
      return res.json() as Promise<{
        headers: string[];
        sample_rows: Record<string, string>[];
        total_rows: number;
      }>;
    },
  });
}

// Import leads
export function useImportLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      csvContent,
      fileName,
      mappings,
      defaults,
    }: {
      csvContent: string;
      fileName?: string;
      mappings?: Record<string, string>;
      defaults?: Record<string, any>;
    }) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csv_content: csvContent,
          file_name: fileName,
          mappings,
          defaults,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import leads');
      }
      return res.json() as Promise<{
        import_id: string;
        total_rows: number;
        successful: number;
        failed: number;
        errors: Array<{ row: number; error: string; data: Record<string, any> }>;
      }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-imports'] });
      if (data.failed > 0) {
        toast.warning(`Imported ${data.successful} leads, ${data.failed} failed`);
      } else {
        toast.success(`Successfully imported ${data.successful} leads`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });
}

// Get mapping templates
export function useMappingTemplates() {
  return useQuery({
    queryKey: ['lead-import-mappings'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/mappings/templates`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json() as Promise<ImportMapping[]>;
    },
  });
}

// Save mapping template
export function useSaveMappingTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: { name: string; description?: string; mappings: Record<string, string>; defaults?: Record<string, any> }) => {
      const res = await fetch(`${API_BASE}/mappings/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });
      if (!res.ok) throw new Error('Failed to save template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-import-mappings'] });
      toast.success('Mapping template saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });
}

// Get available fields
export function useLeadFields() {
  return useQuery({
    queryKey: ['lead-fields'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/fields`);
      if (!res.ok) throw new Error('Failed to fetch fields');
      return res.json() as Promise<LeadField[]>;
    },
  });
}

// Export leads
export function useExportLeads() {
  return useMutation({
    mutationFn: async (filters?: { stage?: string; source_id?: string; created_after?: string; created_before?: string }) => {
      const params = new URLSearchParams();
      if (filters?.stage) params.append('stage', filters.stage);
      if (filters?.source_id) params.append('source_id', filters.source_id);
      if (filters?.created_after) params.append('created_after', filters.created_after);
      if (filters?.created_before) params.append('created_before', filters.created_before);

      const res = await fetch(`${API_BASE}/export?${params}`);
      if (!res.ok) throw new Error('Failed to export leads');

      // Get the CSV content and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { success: true };
    },
    onSuccess: () => {
      toast.success('Leads exported successfully');
    },
    onError: (error: Error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });
}
