import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  hourly_rate: number | null;
  is_active: boolean;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useEmployees(activeOnly = true) {
  return useQuery({
    queryKey: ['employees', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('employees')
        .select('*')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('employees')
        .insert(employee)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      const { data, error } = await supabase
        .from('employees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export const departmentOptions = [
  'Management',
  'Field Operations',
  'Office',
  'Estimating',
  'Project Management',
  'Safety',
  'Quality Control',
];

export const roleOptions = [
  'Owner',
  'Project Manager',
  'Superintendent',
  'Site Supervisor',
  'Foreman',
  'Lead Carpenter',
  'Carpenter',
  'Laborer',
  'Estimator',
  'Office Manager',
  'Accountant',
  'Project Coordinator',
  'Safety Manager',
];
