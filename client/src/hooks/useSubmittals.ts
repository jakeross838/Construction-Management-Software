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

export type SubmittalStatus = 'draft' | 'pending_review' | 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected';
export type SubmittalType = 'shop_drawing' | 'product_data' | 'sample' | 'mock_up' | 'other';

export interface Submittal {
  id: string;
  job_id: string;
  submittal_number: string;
  revision: string;
  title: string;
  type: SubmittalType;
  spec_section: string | null;
  cost_code_id: string | null;
  description: string | null;
  status: SubmittalStatus;
  submitted_by: string | null;
  submitted_to: string | null;
  subcontractor: string | null;
  manufacturer: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comments: string | null;
  date_submitted: string | null;
  date_required: string | null;
  date_returned: string | null;
  lead_time_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string };
  cost_code?: { id: string; code: string; name: string };
  items?: SubmittalItem[];
  attachments?: SubmittalAttachment[];
  log?: SubmittalLogEntry[];
}

export interface SubmittalItem {
  id: string;
  submittal_id: string;
  item_number: number;
  description: string;
  quantity: number;
  unit: string | null;
  manufacturer: string | null;
  model_number: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
}

export interface SubmittalAttachment {
  id: string;
  submittal_id: string;
  name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  attachment_type: 'submission' | 'review' | 'revised';
  uploaded_by: string | null;
  created_at: string;
}

export interface SubmittalLogEntry {
  id: string;
  submittal_id: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  comments: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface SubmittalStats {
  total: number;
  draft: number;
  pending_review: number;
  approved: number;
  approved_as_noted: number;
  revise_resubmit: number;
  rejected: number;
}

export interface CreateSubmittalData {
  job_id: string;
  title: string;
  type?: SubmittalType;
  spec_section?: string;
  cost_code_id?: string;
  description?: string;
  submitted_by?: string;
  submitted_to?: string;
  subcontractor?: string;
  manufacturer?: string;
  date_required?: string;
  lead_time_days?: number;
  notes?: string;
}

export interface UpdateSubmittalData {
  title?: string;
  type?: SubmittalType;
  spec_section?: string;
  cost_code_id?: string;
  description?: string;
  submitted_by?: string;
  submitted_to?: string;
  subcontractor?: string;
  manufacturer?: string;
  date_required?: string;
  lead_time_days?: number;
  notes?: string;
}

// ========================
// QUERIES
// ========================

export function useSubmittals(jobId?: string) {
  return useQuery({
    queryKey: ['submittals', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/submittals?job_id=${jobId}` : '/submittals';
      return api<Submittal[]>(endpoint);
    },
  });
}

export function useSubmittal(id: string | null) {
  return useQuery({
    queryKey: ['submittal', id],
    queryFn: async () => {
      if (!id) return null;
      return api<Submittal>(`/submittals/${id}`);
    },
    enabled: !!id,
  });
}

export function useSubmittalStats(jobId?: string) {
  return useQuery({
    queryKey: ['submittal-stats', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/submittals/stats?job_id=${jobId}` : '/submittals/stats';
      return api<SubmittalStats>(endpoint);
    },
  });
}

// ========================
// MUTATIONS
// ========================

export function useCreateSubmittal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSubmittalData) => api<Submittal>('/submittals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      toast.success(`Submittal ${data.submittal_number} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create submittal: ${error.message}`);
    },
  });
}

export function useUpdateSubmittal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateSubmittalData & { id: string }) =>
      api<Submittal>(`/submittals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal', data.id] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      toast.success('Submittal updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update submittal: ${error.message}`);
    },
  });
}

export function useSubmitForReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, submitted_by }: { id: string; submitted_by?: string }) =>
      api<Submittal>(`/submittals/${id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submitted_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      toast.success('Submittal submitted for review');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });
}

export function useReviewSubmittal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, review_comments, reviewed_by }: {
      id: string;
      status: 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected';
      review_comments?: string;
      reviewed_by?: string;
    }) =>
      api<Submittal>(`/submittals/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status, review_comments, reviewed_by }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      const statusLabels: Record<string, string> = {
        approved: 'Submittal approved',
        approved_as_noted: 'Submittal approved as noted',
        revise_resubmit: 'Revise and resubmit requested',
        rejected: 'Submittal rejected',
      };
      toast.success(statusLabels[variables.status] || 'Review submitted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to review: ${error.message}`);
    },
  });
}

export function useReviseSubmittal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api<Submittal>(`/submittals/${id}/revise`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      toast.success(`Revision ${data.revision} created`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to create revision: ${error.message}`);
    },
  });
}

export function useDeleteSubmittal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api(`/submittals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submittals'] });
      queryClient.invalidateQueries({ queryKey: ['submittal-stats'] });
      toast.success('Submittal deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete submittal: ${error.message}`);
    },
  });
}

// ========================
// ITEMS
// ========================

export function useAddSubmittalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submittalId, ...data }: {
      submittalId: string;
      description: string;
      quantity?: number;
      unit?: string;
      manufacturer?: string;
      model_number?: string;
      notes?: string;
    }) =>
      api<SubmittalItem>(`/submittals/${submittalId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.submittalId] });
      toast.success('Item added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
}

export function useDeleteSubmittalItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submittalId, itemId }: { submittalId: string; itemId: string }) =>
      api(`/submittals/${submittalId}/items/${itemId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.submittalId] });
      toast.success('Item deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete item: ${error.message}`);
    },
  });
}

// ========================
// ATTACHMENTS
// ========================

export function useAddSubmittalAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submittalId, ...data }: {
      submittalId: string;
      name: string;
      file_url: string;
      file_type?: string;
      file_size?: number;
      attachment_type?: 'submission' | 'review' | 'revised';
      uploaded_by?: string;
    }) =>
      api<SubmittalAttachment>(`/submittals/${submittalId}/attachments`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.submittalId] });
      toast.success('Attachment added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add attachment: ${error.message}`);
    },
  });
}

export function useDeleteSubmittalAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ submittalId, attachmentId }: { submittalId: string; attachmentId: string }) =>
      api(`/submittals/${submittalId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submittal', variables.submittalId] });
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

export const submittalStatusConfig: Record<SubmittalStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  pending_review: { label: 'Pending Review', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  approved: { label: 'Approved', color: 'text-green-600', bgColor: 'bg-green-100' },
  approved_as_noted: { label: 'Approved as Noted', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  revise_resubmit: { label: 'Revise & Resubmit', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  rejected: { label: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const submittalTypeConfig: Record<SubmittalType, { label: string }> = {
  shop_drawing: { label: 'Shop Drawing' },
  product_data: { label: 'Product Data' },
  sample: { label: 'Sample' },
  mock_up: { label: 'Mock-Up' },
  other: { label: 'Other' },
};
