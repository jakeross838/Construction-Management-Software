import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export type InspectionResult = 'scheduled' | 'passed' | 'failed' | 'partial' | 'cancelled' | 'no_show';
export type DeficiencySeverity = 'minor' | 'major' | 'critical';
export type DeficiencyStatus = 'open' | 'in_progress' | 'resolved';

export interface Inspection {
  id: string;
  job_id: string;
  inspection_type: string;
  inspection_number: number;
  scheduled_date: string;
  scheduled_time: string | null;
  inspector_name: string | null;
  inspector_phone: string | null;
  inspector_agency: string | null;
  result: InspectionResult;
  result_date: string | null;
  result_notes: string | null;
  parent_inspection_id: string | null;
  reinspection_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string; address: string };
  deficiencies?: InspectionDeficiency[];
  attachments?: InspectionAttachment[];
  activity?: InspectionActivity[];
  parent_inspection?: Inspection;
  reinspections?: Inspection[];
  next_reinspection?: { id: string; scheduled_date: string; result: string } | null;
  open_deficiency_count?: number;
}

export interface InspectionDeficiency {
  id: string;
  inspection_id: string;
  description: string;
  location: string | null;
  severity: DeficiencySeverity;
  status: DeficiencyStatus;
  assigned_vendor_id: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  vendor?: { id: string; name: string };
}

export interface InspectionAttachment {
  id: string;
  inspection_id: string;
  deficiency_id: string | null;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  caption: string | null;
  category: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface InspectionActivity {
  id: string;
  inspection_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface InspectionStats {
  scheduled: number;
  passed: number;
  failed: number;
  partial: number;
  cancelled: number;
  no_show: number;
  upcoming: number;
  total: number;
}

export interface CreateInspectionData {
  job_id: string;
  inspection_type: string;
  scheduled_date: string;
  scheduled_time?: string;
  inspector_name?: string;
  inspector_phone?: string;
  inspector_agency?: string;
  created_by: string;
}

export interface UpdateInspectionData {
  inspection_type?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  inspector_name?: string;
  inspector_phone?: string;
  inspector_agency?: string;
  updated_by?: string;
}

// ========================
// QUERIES
// ========================

export function useInspections(filters?: { job_id?: string; result?: string; type?: string }) {
  return useQuery({
    queryKey: ['inspections', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.result) params.set('result', filters.result);
      if (filters?.type) params.set('type', filters.type);
      const queryString = params.toString();
      const endpoint = queryString ? `/inspections?${queryString}` : '/inspections';
      return api<Inspection[]>(endpoint);
    },
  });
}

export function useInspection(id: string | null) {
  return useQuery({
    queryKey: ['inspection', id],
    queryFn: async () => {
      if (!id) return null;
      return api<Inspection>(`/inspections/${id}`);
    },
    enabled: !!id,
  });
}

export function useInspectionStats(jobId: string) {
  return useQuery({
    queryKey: ['inspection-stats', jobId],
    queryFn: async () => {
      return api<InspectionStats>(`/inspections/stats?job_id=${jobId}`);
    },
    enabled: !!jobId,
  });
}

export function useUpcomingInspections(jobId?: string) {
  return useQuery({
    queryKey: ['inspections-upcoming', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/inspections/upcoming?job_id=${jobId}` : '/inspections/upcoming';
      return api<Inspection[]>(endpoint);
    },
  });
}

export function useInspectionTypes() {
  return useQuery({
    queryKey: ['inspection-types'],
    queryFn: async () => api<string[]>('/inspections/types'),
    staleTime: Infinity, // Types don't change
  });
}

// ========================
// MUTATIONS
// ========================

export function useCreateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateInspectionData) => api<Inspection>('/inspections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection scheduled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create inspection: ${error.message}`);
    },
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateInspectionData & { id: string }) =>
      api<Inspection>(`/inspections/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', data.id] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update inspection: ${error.message}`);
    },
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/inspections/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete inspection: ${error.message}`);
    },
  });
}

export function usePassInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, result_notes, result_date, performed_by }: {
      id: string;
      result_notes?: string;
      result_date?: string;
      performed_by?: string;
    }) =>
      api<Inspection>(`/inspections/${id}/pass`, {
        method: 'POST',
        body: JSON.stringify({ result_notes, result_date, performed_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection passed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as passed: ${error.message}`);
    },
  });
}

export function useFailInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, result_notes, result_date, deficiencies, performed_by }: {
      id: string;
      result_notes?: string;
      result_date?: string;
      deficiencies?: Array<{
        description: string;
        location?: string;
        severity?: DeficiencySeverity;
        assigned_vendor_id?: string;
      }>;
      performed_by?: string;
    }) =>
      api<Inspection>(`/inspections/${id}/fail`, {
        method: 'POST',
        body: JSON.stringify({ result_notes, result_date, deficiencies, performed_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection marked as failed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to mark as failed: ${error.message}`);
    },
  });
}

export function useCancelInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, result_notes, performed_by }: {
      id: string;
      result_notes?: string;
      performed_by?: string;
    }) =>
      api<Inspection>(`/inspections/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ result_notes, performed_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection cancelled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });
}

export function useRescheduleInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scheduled_date, scheduled_time, result_notes, performed_by }: {
      id: string;
      scheduled_date: string;
      scheduled_time?: string;
      result_notes?: string;
      performed_by?: string;
    }) =>
      api<Inspection>(`/inspections/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_date, scheduled_time, result_notes, performed_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Inspection rescheduled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reschedule: ${error.message}`);
    },
  });
}

export function useCreateReinspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scheduled_date, scheduled_time, created_by }: {
      id: string;
      scheduled_date: string;
      scheduled_time?: string;
      created_by: string;
    }) =>
      api<Inspection>(`/inspections/${id}/reinspect`, {
        method: 'POST',
        body: JSON.stringify({ scheduled_date, scheduled_time, created_by }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      queryClient.invalidateQueries({ queryKey: ['inspection-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inspections-upcoming'] });
      toast.success('Re-inspection scheduled');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create re-inspection: ${error.message}`);
    },
  });
}

// ========================
// DEFICIENCY MUTATIONS
// ========================

export function useAddDeficiency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ inspectionId, ...data }: {
      inspectionId: string;
      description: string;
      location?: string;
      severity?: DeficiencySeverity;
      assigned_vendor_id?: string;
      created_by?: string;
    }) =>
      api<InspectionDeficiency>(`/inspections/${inspectionId}/deficiencies`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.inspectionId] });
      toast.success('Deficiency added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add deficiency: ${error.message}`);
    },
  });
}

export function useUpdateDeficiency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, inspectionId, ...data }: {
      id: string;
      inspectionId: string;
      description?: string;
      location?: string;
      severity?: DeficiencySeverity;
      status?: DeficiencyStatus;
      assigned_vendor_id?: string;
      updated_by?: string;
    }) =>
      api<InspectionDeficiency>(`/inspections/deficiencies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.inspectionId] });
      toast.success('Deficiency updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update deficiency: ${error.message}`);
    },
  });
}

export function useResolveDeficiency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, inspectionId, resolved_by, resolution_notes }: {
      id: string;
      inspectionId: string;
      resolved_by?: string;
      resolution_notes?: string;
    }) =>
      api<InspectionDeficiency>(`/inspections/deficiencies/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolved_by, resolution_notes }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inspection', variables.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['inspections'] });
      toast.success('Deficiency resolved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to resolve deficiency: ${error.message}`);
    },
  });
}

// ========================
// HELPERS
// ========================

export const inspectionResultConfig: Record<InspectionResult, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  passed: { label: 'Passed', color: 'text-green-600', bgColor: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100' },
  partial: { label: 'Partial', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  no_show: { label: 'No Show', color: 'text-orange-600', bgColor: 'bg-orange-100' },
};

export const deficiencySeverityConfig: Record<DeficiencySeverity, { label: string; color: string; bgColor: string }> = {
  minor: { label: 'Minor', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  major: { label: 'Major', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const deficiencyStatusConfig: Record<DeficiencyStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-red-600', bgColor: 'bg-red-100' },
  in_progress: { label: 'In Progress', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  resolved: { label: 'Resolved', color: 'text-green-600', bgColor: 'bg-green-100' },
};
