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
      const endpoint = activeOnly ? '/employees?active_only=true' : '/employees';
      return api<Employee[]>(endpoint);
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (employee: Omit<Employee, 'id' | 'created_at' | 'updated_at'>) => {
      return api<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify(employee),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create employee: ${error.message}`);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Employee> & { id: string }) => {
      return api<Employee>(`/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update employee: ${error.message}`);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/employees/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('Employee deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete employee: ${error.message}`);
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
