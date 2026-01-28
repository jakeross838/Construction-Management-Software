import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Job type based on backend API response
export interface Job {
  id: string;
  name: string;
  address?: string;
  client_name?: string;
  contract_amount?: number;
  status: string;
  created_at: string;
  [key: string]: any;
}

export type JobInsert = Partial<Job>;
export type JobUpdate = Partial<Job>;

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async (): Promise<Job[]> => {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Failed to fetch jobs');
      return response.json();
    },
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: async (): Promise<Job | null> => {
      if (!id) return null;
      const response = await fetch(`/api/jobs/${id}`);
      if (!response.ok) throw new Error('Failed to fetch job');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (job: Partial<JobInsert>) => {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!response.ok) throw new Error('Failed to create job');
      return response.json();
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
      const response = await fetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update job');
      return response.json();
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
      const response = await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete job');
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
