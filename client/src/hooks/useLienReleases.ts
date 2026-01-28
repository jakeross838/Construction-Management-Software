import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      let query = supabase
        .from('lien_releases')
        .select(`
          *,
          vendor:vendors(id, name),
          draw:draws(id, draw_number),
          job:jobs(id, name)
        `)
        .order('created_at', { ascending: false });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateLienRelease() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (release: LienReleaseInsert) => {
      const { data, error } = await supabase
        .from('lien_releases')
        .insert({
          ...release,
          status: release.status || 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { data, error } = await supabase
        .from('lien_releases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { error } = await supabase.from('lien_releases').delete().eq('id', id);
      if (error) throw error;
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
      const { data, error } = await supabase
        .from('lien_releases')
        .update({
          status: 'received',
          received_at: new Date().toISOString(),
          received_by: receivedBy || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
