import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_id: string | null;
  w9_on_file: boolean;
  insurance_expiry: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type VendorInsert = Omit<Vendor, 'id' | 'created_at' | 'updated_at'>;
export type VendorUpdate = Partial<VendorInsert> & { id: string };

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async (): Promise<Vendor[]> => {
      const response = await fetch('/api/vendors');
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json();
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendor: VendorInsert) => {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendor),
      });
      if (!response.ok) throw new Error('Failed to create vendor');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor created');
    },
    onError: (error: Error) => {
      console.error('Failed to create vendor:', error);
      toast.error('Failed to create vendor');
    },
  });
}

export function useUpdateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: VendorUpdate) => {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error('Failed to update vendor');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update vendor:', error);
      toast.error('Failed to update vendor');
    },
  });
}

export function useDeleteVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete vendor');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      toast.success('Vendor deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete vendor:', error);
      toast.error('Failed to delete vendor - it may be linked to purchase orders');
    },
  });
}

export function getVendorStatus(insuranceExpiry: string | null): 'active' | 'expiring' | 'expired' {
  if (!insuranceExpiry) return 'active';

  const expiry = new Date(insuranceExpiry);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry < now) return 'expired';
  if (expiry <= thirtyDaysFromNow) return 'expiring';
  return 'active';
}
