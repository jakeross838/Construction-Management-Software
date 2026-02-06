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

export type RFIStatus = 'open' | 'pending' | 'answered' | 'closed';
export type RFIPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface RFI {
  id: string;
  job_id: string;
  rfi_number: string;
  subject: string;
  question: string;
  response: string | null;
  reference_drawings: string | null;
  reference_specs: string | null;
  priority: RFIPriority;
  status: RFIStatus;
  assigned_to: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  responded_by: string | null;
  responded_at: string | null;
  due_date: string | null;
  date_required: string | null;
  closed_at: string | null;
  cost_impact: number | null;
  schedule_impact_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string };
  responses?: RFIResponse[];
  attachments?: RFIAttachment[];
}

export interface RFIResponse {
  id: string;
  rfi_id: string;
  content: string;
  response_type: 'question' | 'response' | 'clarification';
  responded_by: string;
  created_at: string;
}

export interface RFIAttachment {
  id: string;
  rfi_id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: 'question' | 'response';
  uploaded_by: string | null;
  created_at: string;
}

export interface RFIStats {
  total: number;
  open: number;
  pending: number;
  answered: number;
  closed: number;
  overdue: number;
}

export interface CreateRFIData {
  job_id: string;
  subject: string;
  question: string;
  reference_drawings?: string;
  reference_specs?: string;
  priority?: RFIPriority;
  assigned_to?: string;
  due_date?: string;
  date_required?: string;
  submitted_by?: string;
  notes?: string;
}

export interface UpdateRFIData {
  subject?: string;
  question?: string;
  response?: string;
  reference_drawings?: string;
  reference_specs?: string;
  priority?: RFIPriority;
  status?: RFIStatus;
  assigned_to?: string;
  due_date?: string;
  date_required?: string;
  cost_impact?: number;
  schedule_impact_days?: number;
  notes?: string;
}

// ========================
// QUERIES
// ========================

export function useRFIs(jobId?: string) {
  return useQuery({
    queryKey: ['rfis', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/rfis?job_id=${jobId}` : '/rfis';
      return api<RFI[]>(endpoint);
    },
  });
}

export function useRFI(id: string | null) {
  return useQuery({
    queryKey: ['rfi', id],
    queryFn: async () => {
      if (!id) return null;
      return api<RFI>(`/rfis/${id}`);
    },
    enabled: !!id,
  });
}

export function useRFIStats(jobId?: string) {
  return useQuery({
    queryKey: ['rfi-stats', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/rfis/stats?job_id=${jobId}` : '/rfis/stats';
      return api<RFIStats>(endpoint);
    },
  });
}

// ========================
// MUTATIONS
// ========================

export function useCreateRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRFIData) => api<RFI>('/rfis', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success(`RFI ${data.rfi_number} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create RFI: ${error.message}`);
    },
  });
}

export function useUpdateRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateRFIData & { id: string }) =>
      api<RFI>(`/rfis/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi', data.id] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success('RFI updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update RFI: ${error.message}`);
    },
  });
}

export function useRespondToRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, content, response_type, responded_by }: {
      id: string;
      content: string;
      response_type?: 'question' | 'response' | 'clarification';
      responded_by?: string;
    }) =>
      api<RFIResponse>(`/rfis/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify({ content, response_type, responded_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success('Response added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add response: ${error.message}`);
    },
  });
}

export function useCloseRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/rfis/${id}/close`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success('RFI closed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to close RFI: ${error.message}`);
    },
  });
}

export function useReopenRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/rfis/${id}/reopen`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success('RFI reopened');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reopen RFI: ${error.message}`);
    },
  });
}

export function useDeleteRFI() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/rfis/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfis'] });
      queryClient.invalidateQueries({ queryKey: ['rfi-stats'] });
      toast.success('RFI deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete RFI: ${error.message}`);
    },
  });
}

// ========================
// ATTACHMENTS
// ========================

export function useAddRFIAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rfiId, ...data }: {
      rfiId: string;
      name: string;
      file_url: string;
      file_type?: string;
      file_size?: number;
      attachment_type?: 'question' | 'response';
      uploaded_by?: string;
    }) =>
      api<RFIAttachment>(`/rfis/${rfiId}/attachments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rfi', variables.rfiId] });
      toast.success('Attachment added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add attachment: ${error.message}`);
    },
  });
}

export function useDeleteRFIAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ rfiId, attachmentId }: { rfiId: string; attachmentId: string }) =>
      api(`/rfis/${rfiId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['rfi', variables.rfiId] });
      toast.success('Attachment deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete attachment: ${error.message}`);
    },
  });
}

// ========================
// HELPERS
// ========================

export const rfiStatusConfig: Record<RFIStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  pending: { label: 'Pending', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  answered: { label: 'Answered', color: 'text-green-600', bgColor: 'bg-green-100' },
  closed: { label: 'Closed', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

export const rfiPriorityConfig: Record<RFIPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  normal: { label: 'Normal', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  high: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  urgent: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-100' },
};
