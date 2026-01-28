import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Job = Tables<'jobs'>;
export type JobInsert = TablesInsert<'jobs'>;
export type JobUpdate = TablesUpdate<'jobs'>;

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async (): Promise<Job | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: Partial<JobInsert>) => {
      const { data, error } = await supabase
        .from('jobs')
        .insert({
          name: job.name || 'Untitled Job',
          client: job.client,
          address: job.address,
          status: job.status || 'planning',
          budget_amount: job.budget_amount || 0,
          contract_amount: job.contract_amount || 0,
          start_date: job.start_date,
          end_date: job.end_date,
          percent_complete: job.percent_complete || 0,
          project_manager: job.project_manager,
          site_supervisor: job.site_supervisor,
          architect: job.architect,
          engineer: job.engineer,
          client_email: job.client_email,
          client_phone: job.client_phone,
          client_cell: job.client_cell,
          square_footage: job.square_footage,
          bedrooms: job.bedrooms,
          bathrooms: job.bathrooms,
          half_baths: job.half_baths,
          stories: job.stories,
          garage_spaces: job.garage_spaces,
          construction_type: job.construction_type,
          architectural_style: job.architectural_style,
          foundation_type: job.foundation_type,
          roof_type: job.roof_type,
          exterior_finish: job.exterior_finish,
          hvac_system: job.hvac_system,
          electrical_service: job.electrical_service,
          plumbing_type: job.plumbing_type,
          target_margin: job.target_margin || 10,
          retainage_percent: job.retainage_percent || 10,
          notes: job.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to create job:', error);
      toast.error('Failed to create job');
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: JobUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['jobs', id] });
      toast.success('Job updated successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to update job:', error);
      toast.error('Failed to update job');
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to delete job:', error);
      toast.error('Failed to delete job');
    },
  });
}

export const statusOptions = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on-hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
];

export const constructionTypeOptions = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'addition', label: 'Addition' },
  { value: 'renovation', label: 'Renovation' },
];

export const architecturalStyleOptions = [
  { value: 'modern', label: 'Modern' },
  { value: 'contemporary', label: 'Contemporary' },
  { value: 'traditional', label: 'Traditional' },
  { value: 'craftsman', label: 'Craftsman' },
  { value: 'colonial', label: 'Colonial' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'coastal', label: 'Coastal' },
  { value: 'farmhouse', label: 'Farmhouse' },
];
