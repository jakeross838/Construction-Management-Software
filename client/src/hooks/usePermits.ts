import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Permit {
  id: string;
  job_id: string;
  type: string;
  number: string | null;
  status: string;
  submitted_date: string | null;
  approved_date: string | null;
  expires_date: string | null;
  jurisdiction: string | null;
  inspector_name: string | null;
  inspector_phone: string | null;
  inspector_email: string | null;
  fee_amount: number | null;
  fee_paid: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  jobs?: {
    name: string;
  };
}

export type PermitInsert = Omit<Permit, 'id' | 'created_at' | 'updated_at' | 'jobs'>;
export type PermitUpdate = Partial<PermitInsert>;

export const permitTypes = [
  'Building Permit',
  'Electrical Permit',
  'Plumbing Permit',
  'Mechanical/HVAC Permit',
  'Demolition Permit',
  'Grading Permit',
  'Driveway Permit',
  'Septic Permit',
  'Well Permit',
  'Pool Permit',
  'Fence Permit',
  'Sign Permit',
  'Fire Permit',
  'Environmental Permit',
  'Zoning Variance',
  'Other'
];

export const permitStatuses = [
  { value: 'not_submitted', label: 'Not Submitted' },
  { value: 'pending', label: 'Pending Submission' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'revoked', label: 'Revoked' }
];

export function usePermits(jobId?: string | null) {
  return useQuery({
    queryKey: ['permits', jobId],
    queryFn: async () => {
      let query = supabase
        .from('permits')
        .select(`
          *,
          jobs:job_id (name)
        `)
        .order('created_at', { ascending: false });
      
      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Permit[];
    }
  });
}

export function useCreatePermit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (permit: PermitInsert) => {
      const { data, error } = await supabase
        .from('permits')
        .insert(permit)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      toast.success('Permit created successfully');
    },
    onError: (error) => {
      console.error('Error creating permit:', error);
      toast.error('Failed to create permit');
    }
  });
}

export function useUpdatePermit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: PermitUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('permits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      toast.success('Permit updated successfully');
    },
    onError: (error) => {
      console.error('Error updating permit:', error);
      toast.error('Failed to update permit');
    }
  });
}

export function useDeletePermit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('permits')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permits'] });
      toast.success('Permit deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting permit:', error);
      toast.error('Failed to delete permit');
    }
  });
}
