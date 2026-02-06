import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

export interface Contract {
  id: string;
  contract_number: string;
  name: string;
  description?: string;
  contract_type: 'prime' | 'subcontract' | 'proposal' | 'change_order' | 'amendment' | 'nda' | 'purchase_agreement' | 'other';
  category?: string;
  job_id?: string;
  lead_id?: string;
  company_id?: string;
  vendor_id?: string;
  contact_id?: string;
  parent_contract_id?: string;
  contract_amount?: number;
  original_amount?: number;
  retainage_percent?: number;
  payment_terms?: string;
  start_date?: string;
  end_date?: string;
  expiration_date?: string;
  execution_date?: string;
  signature_status: 'draft' | 'pending_internal' | 'sent' | 'pending_signature' | 'partially_signed' | 'fully_executed' | 'declined' | 'expired';
  status: 'draft' | 'active' | 'completed' | 'terminated' | 'expired' | 'cancelled';
  sent_for_signature_at?: string;
  internal_signed_at?: string;
  internal_signed_by?: string;
  external_signed_at?: string;
  external_signed_by?: string;
  file_url?: string;
  signed_file_url?: string;
  scope_of_work?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string };
  company?: { id: string; name: string };
  vendor?: { id: string; name: string };
  contact?: { id: string; first_name: string; last_name: string };
}

export interface ContractStats {
  total: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_signature: Record<string, number>;
  pending_signature: number;
  expiring_soon: number;
}

interface ContractFilters {
  job_id?: string;
  company_id?: string;
  vendor_id?: string;
  type?: string;
  status?: string;
  signature_status?: string;
  search?: string;
  expiring_soon?: boolean;
}

async function fetchContracts(filters: ContractFilters = {}): Promise<Contract[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.company_id) params.append('company_id', filters.company_id);
  if (filters.vendor_id) params.append('vendor_id', filters.vendor_id);
  if (filters.type) params.append('type', filters.type);
  if (filters.status) params.append('status', filters.status);
  if (filters.signature_status) params.append('signature_status', filters.signature_status);
  if (filters.search) params.append('search', filters.search);
  if (filters.expiring_soon) params.append('expiring_soon', 'true');

  const response = await apiGet(`/api/contracts?${params}`);
  if (!response.ok) throw new Error('Failed to fetch contracts');
  const data = await response.json();
  return data.contracts;
}

async function fetchContractStats(jobId?: string): Promise<ContractStats> {
  const params = jobId ? `?job_id=${jobId}` : '';
  const response = await apiGet(`/api/contracts/stats${params}`);
  if (!response.ok) throw new Error('Failed to fetch contract stats');
  return response.json();
}

async function fetchContract(id: string): Promise<Contract> {
  const response = await apiGet(`/api/contracts/${id}`);
  if (!response.ok) throw new Error('Failed to fetch contract');
  const data = await response.json();
  return data.contract;
}

async function createContract(contract: Partial<Contract>): Promise<Contract> {
  const response = await apiPost('/api/contracts', contract);
  if (!response.ok) throw new Error('Failed to create contract');
  const data = await response.json();
  return data.contract;
}

async function updateContract(id: string, updates: Partial<Contract>): Promise<Contract> {
  const response = await apiPatch(`/api/contracts/${id}`, updates);
  if (!response.ok) throw new Error('Failed to update contract');
  const data = await response.json();
  return data.contract;
}

async function deleteContract(id: string): Promise<void> {
  const response = await apiDelete(`/api/contracts/${id}`);
  if (!response.ok) throw new Error('Failed to delete contract');
}

export function useContracts(filters: ContractFilters = {}) {
  return useQuery({
    queryKey: ['contracts', filters],
    queryFn: () => fetchContracts(filters),
  });
}

export function useContractStats(jobId?: string) {
  return useQuery({
    queryKey: ['contract-stats', jobId],
    queryFn: () => fetchContractStats(jobId),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => fetchContract(id),
    enabled: !!id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Contract> }) =>
      updateContract(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', id] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
    },
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteContract,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract-stats'] });
    },
  });
}
