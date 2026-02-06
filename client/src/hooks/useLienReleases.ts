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

export interface LienRelease {
  id: string;
  job_id: string;
  vendor_id: string;
  draw_id: string | null;
  release_type: string;
  release_date: string | null;
  through_date: string | null;
  amount: number;
  pdf_url: string | null;
  ai_processed: boolean;
  ai_confidence: Record<string, number> | null;
  ai_extracted_data: Record<string, unknown> | null;
  status: string;
  needs_review: boolean;
  review_flags: string[] | null;
  notary_name: string | null;
  notary_county: string | null;
  notary_expiration: string | null;
  signer_name: string | null;
  signer_title: string | null;
  notes: string | null;
  version: number;
  created_at: string;
  uploaded_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  // Joined data
  vendor?: { id: string; name: string } | null;
  draw?: { id: string; draw_number: number } | null;
  job?: { id: string; name: string } | null;
}

export type LienReleaseInsert = {
  job_id: string;
  draw_id?: string | null;
  vendor_id: string;
  release_type: string;
  amount: number;
  through_date?: string | null;
  release_date?: string | null;
  status?: string;
  notes?: string | null;
};

export type LienReleaseUpdate = Partial<LienReleaseInsert> & { id: string };

export function useLienReleases(jobId?: string | null) {
  return useQuery({
    queryKey: ['lien-releases', jobId],
    queryFn: async (): Promise<LienRelease[]> => {
      const endpoint = jobId ? `/lien-releases?job_id=${jobId}` : '/lien-releases';
      return api<LienRelease[]>(endpoint);
    },
  });
}

export function useCreateLienRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (release: LienReleaseInsert) => {
      return api<LienRelease>('/lien-releases', {
        method: 'POST',
        body: JSON.stringify({ ...release, status: release.status || 'received' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Lien release request created');
    },
    onError: (error: Error) => {
      console.error('Failed to create lien release:', error);
      toast.error('Failed to create lien release request');
    },
  });
}

export function useUpdateLienRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LienReleaseUpdate) => {
      return api<LienRelease>(`/lien-releases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Lien release updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update lien release:', error);
      toast.error('Failed to update lien release');
    },
  });
}

export function useDeleteLienRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/lien-releases/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Lien release deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete lien release:', error);
      toast.error('Failed to delete lien release');
    },
  });
}

export function useMarkLienReleaseReceived() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, receivedBy }: { id: string; receivedBy?: string }) => {
      return api<LienRelease>(`/lien-releases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: receivedBy || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Lien release marked as verified');
    },
    onError: (error: Error) => {
      console.error('Failed to mark lien release as verified:', error);
      toast.error('Failed to update lien release');
    },
  });
}

export const releaseTypeOptions = [
  { value: 'conditional_progress', label: 'Conditional Waiver - Progress Payment' },
  { value: 'unconditional_progress', label: 'Unconditional Waiver - Progress Payment' },
  { value: 'conditional_final', label: 'Conditional Waiver - Final Payment' },
  { value: 'unconditional_final', label: 'Unconditional Waiver - Final Payment' },
];

export const releaseStatusOptions = [
  { value: 'received', label: 'Received' },
  { value: 'verified', label: 'Verified' },
  { value: 'attached', label: 'Attached' },
];
