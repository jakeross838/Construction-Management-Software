import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Warranty {
  id: string;
  job_id: string;
  warranty_number: string;
  name: string;
  description?: string;
  type: 'manufacturer' | 'contractor' | 'extended' | 'labor';
  category?: string;
  coverage_details?: string;
  vendor_id?: string;
  manufacturer?: string;
  model_number?: string;
  serial_number?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  start_date: string;
  end_date: string;
  installation_date?: string;
  status: 'active' | 'expired' | 'claimed' | 'void';
  claim_count: number;
  last_claim_date?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  job?: { id: string; name: string };
  vendor?: { id: string; name: string };
  claims?: WarrantyClaim[];
  attachments?: WarrantyAttachment[];
}

export interface WarrantyClaim {
  id: string;
  warranty_id: string;
  claim_number: string;
  issue_description: string;
  claim_date: string;
  status: 'submitted' | 'in_progress' | 'approved' | 'denied' | 'completed';
  resolution_description?: string;
  resolution_date?: string;
  resolved_by?: string;
  claim_amount?: number;
  approved_amount?: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface WarrantyAttachment {
  id: string;
  warranty_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  attachment_type: 'warranty' | 'manual' | 'receipt' | 'claim' | 'photo';
  uploaded_by?: string;
  created_at: string;
}

export interface WarrantyStats {
  total: number;
  active: number;
  expired: number;
  claimed: number;
  expiring_soon: number;
}

interface WarrantyFilters {
  job_id?: string;
  status?: string;
  type?: string;
  category?: string;
  expiring_soon?: boolean;
}

async function fetchWarranties(filters: WarrantyFilters = {}): Promise<Warranty[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.type) params.append('type', filters.type);
  if (filters.category) params.append('category', filters.category);
  if (filters.expiring_soon) params.append('expiring_soon', 'true');

  const response = await fetch(`/api/warranties?${params}`);
  if (!response.ok) throw new Error('Failed to fetch warranties');
  return response.json();
}

async function fetchWarrantyStats(jobId?: string): Promise<WarrantyStats> {
  const params = jobId ? `?job_id=${jobId}` : '';
  const response = await fetch(`/api/warranties/stats${params}`);
  if (!response.ok) throw new Error('Failed to fetch warranty stats');
  return response.json();
}

async function fetchWarranty(id: string): Promise<Warranty> {
  const response = await fetch(`/api/warranties/${id}`);
  if (!response.ok) throw new Error('Failed to fetch warranty');
  return response.json();
}

async function createWarranty(warranty: Partial<Warranty>): Promise<Warranty> {
  const response = await fetch('/api/warranties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(warranty),
  });
  if (!response.ok) throw new Error('Failed to create warranty');
  return response.json();
}

async function updateWarranty(id: string, updates: Partial<Warranty>): Promise<Warranty> {
  const response = await fetch(`/api/warranties/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update warranty');
  return response.json();
}

async function deleteWarranty(id: string): Promise<void> {
  const response = await fetch(`/api/warranties/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete warranty');
}

export function useWarranties(filters: WarrantyFilters = {}) {
  return useQuery({
    queryKey: ['warranties', filters],
    queryFn: () => fetchWarranties(filters),
  });
}

export function useWarrantyStats(jobId?: string) {
  return useQuery({
    queryKey: ['warranty-stats', jobId],
    queryFn: () => fetchWarrantyStats(jobId),
  });
}

export function useWarranty(id: string) {
  return useQuery({
    queryKey: ['warranty', id],
    queryFn: () => fetchWarranty(id),
    enabled: !!id,
  });
}

export function useCreateWarranty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createWarranty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-stats'] });
    },
  });
}

export function useUpdateWarranty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Warranty> }) =>
      updateWarranty(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty', id] });
      queryClient.invalidateQueries({ queryKey: ['warranty-stats'] });
    },
  });
}

export function useDeleteWarranty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteWarranty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty-stats'] });
    },
  });
}

// Claim mutations
async function createClaim(warrantyId: string, claim: Partial<WarrantyClaim>): Promise<WarrantyClaim> {
  const response = await fetch(`/api/warranties/${warrantyId}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(claim),
  });
  if (!response.ok) throw new Error('Failed to create claim');
  return response.json();
}

async function updateClaim(warrantyId: string, claimId: string, updates: Partial<WarrantyClaim>): Promise<WarrantyClaim> {
  const response = await fetch(`/api/warranties/${warrantyId}/claims/${claimId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update claim');
  return response.json();
}

async function resolveClaim(warrantyId: string, claimId: string, resolution: {
  resolution_description?: string;
  approved_amount?: number;
  resolved_by?: string;
}): Promise<WarrantyClaim> {
  const response = await fetch(`/api/warranties/${warrantyId}/claims/${claimId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(resolution),
  });
  if (!response.ok) throw new Error('Failed to resolve claim');
  return response.json();
}

export function useCreateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ warrantyId, claim }: { warrantyId: string; claim: Partial<WarrantyClaim> }) =>
      createClaim(warrantyId, claim),
    onSuccess: (_, { warrantyId }) => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty', warrantyId] });
      queryClient.invalidateQueries({ queryKey: ['warranty-stats'] });
    },
  });
}

export function useUpdateClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ warrantyId, claimId, updates }: { warrantyId: string; claimId: string; updates: Partial<WarrantyClaim> }) =>
      updateClaim(warrantyId, claimId, updates),
    onSuccess: (_, { warrantyId }) => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty', warrantyId] });
    },
  });
}

export function useResolveClaim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ warrantyId, claimId, resolution }: {
      warrantyId: string;
      claimId: string;
      resolution: {
        resolution_description?: string;
        approved_amount?: number;
        resolved_by?: string;
      };
    }) => resolveClaim(warrantyId, claimId, resolution),
    onSuccess: (_, { warrantyId }) => {
      queryClient.invalidateQueries({ queryKey: ['warranties'] });
      queryClient.invalidateQueries({ queryKey: ['warranty', warrantyId] });
      queryClient.invalidateQueries({ queryKey: ['warranty-stats'] });
    },
  });
}

// Warranty types and categories constants
export const warrantyTypes = [
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'extended', label: 'Extended' },
  { value: 'labor', label: 'Labor' },
] as const;

export const warrantyCategories = [
  'Appliances',
  'HVAC',
  'Roofing',
  'Plumbing',
  'Electrical',
  'Structural',
  'Windows & Doors',
  'Flooring',
  'Exterior',
  'Interior',
  'Pool/Spa',
  'Landscaping',
  'Other',
] as const;

export const claimStatuses = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'denied', label: 'Denied' },
  { value: 'completed', label: 'Completed' },
] as const;
