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

export interface LienRelease {
  id: string;
  job_id: string;
  draw_id: string;
  vendor_id: string;
  release_type: string;
  amount: number;
  through_date: string | null;
  status: string;
  document_url: string | null;
  received_at: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  vendor?: { id: string; name: string } | null;
  draw?: { id: string; draw_number: number } | null;
  job?: { id: string; name: string } | null;
}

export type LienReleaseInsert = {
  job_id: string;
  draw_id: string;
  vendor_id: string;
  release_type: string;
  amount: number;
  through_date?: string | null;
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
        body: JSON.stringify({ ...release, status: release.status || 'pending' }),
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
          status: 'received',
          received_at: new Date().toISOString(),
          received_by: receivedBy || null,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lien-releases'] });
      queryClient.invalidateQueries({ queryKey: ['draws'] });
      toast.success('Lien release marked as received');
    },
    onError: (error: Error) => {
      console.error('Failed to mark lien release as received:', error);
      toast.error('Failed to update lien release');
    },
  });
}

export const releaseTypeOptions = [
  { value: 'conditional', label: 'Conditional' },
  { value: 'unconditional', label: 'Unconditional' },
  { value: 'final', label: 'Final' },
  { value: 'partial', label: 'Partial' },
];

export const releaseStatusOptions = [
  { value: 'pending', label: 'Pending' },
  { value: 'requested', label: 'Requested' },
  { value: 'received', label: 'Received' },
];
