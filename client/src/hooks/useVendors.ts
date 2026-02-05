import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

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

interface VendorsPaginationParams {
  page?: number;
  limit?: number;
}

interface PaginatedVendorsResponse {
  data: Vendor[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export function useVendors(pagination?: VendorsPaginationParams) {
  return useQuery({
    queryKey: ['vendors', pagination?.page, pagination?.limit],
    queryFn: async (): Promise<Vendor[] | PaginatedVendorsResponse> => {
      const params = new URLSearchParams();
      if (pagination?.page) params.append('page', String(pagination.page));
      if (pagination?.limit) params.append('limit', String(pagination.limit));

      const url = `/api/vendors${params.size > 0 ? `?${params.toString()}` : ''}`;
      const response = await apiGet(url);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      return response.json();
    },
  });
}

export function useCreateVendor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendor: VendorInsert) => {
      const response = await apiPost('/api/vendors', vendor);
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
      const response = await apiPatch(`/api/vendors/${id}`, updates);
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
      const response = await apiDelete(`/api/vendors/${id}`);
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

// Bulk import vendors
export function useBulkImportVendors() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vendors: VendorInsert[]) => {
      const results = await Promise.allSettled(
        vendors.map(vendor =>
          apiPost('/api/vendors', vendor).then(res => {
            if (!res.ok) throw new Error('Failed');
            return res.json();
          })
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      if (failed > 0 && succeeded === 0) {
        throw new Error('All imports failed');
      }

      return { succeeded, failed, total: vendors.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] });
      if (result.failed > 0) {
        toast.warning(`Imported ${result.succeeded} of ${result.total} vendors (${result.failed} failed)`);
      } else {
        toast.success(`Successfully imported ${result.succeeded} vendor(s)`);
      }
    },
    onError: (error: Error) => {
      console.error('Bulk import failed:', error);
      toast.error('Failed to import vendors');
    },
  });
}
