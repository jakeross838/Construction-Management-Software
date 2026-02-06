import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

// ============================================================
// TYPES
// ============================================================

export interface Signer {
  name: string;
  email: string;
  role: string;
  order: number;
  status: 'pending' | 'signed' | 'declined';
  signed_at: string | null;
  signature_id: string | null;
  declined_at: string | null;
  decline_reason: string | null;
}

export interface Signature {
  id: string;
  request_id: string;
  signer_email: string;
  signer_name: string;
  signer_role?: string;
  signature_type: 'drawn' | 'typed' | 'uploaded' | 'external';
  signature_data?: string;
  typed_name?: string;
  ip_address?: string;
  user_agent?: string;
  geo_location?: {
    city?: string;
    region?: string;
    country?: string;
    lat?: number;
    lng?: number;
  };
  signed_at: string;
  created_at: string;
}

export interface SignatureRequest {
  id: string;
  builder_id?: string;
  document_id: string;
  document_type: 'contract' | 'change_order' | 'daily_log' | 'proposal' | 'subcontract' | 'lien_release' | 'purchase_order' | 'other';
  title: string;
  description?: string;
  message?: string;
  status: 'draft' | 'pending' | 'completed' | 'declined' | 'expired' | 'cancelled';
  signers: Signer[];
  external_provider: 'docusign' | 'hellosign' | 'internal' | null;
  external_id?: string;
  external_status?: string;
  external_envelope_url?: string;
  expires_at?: string;
  sent_at?: string;
  completed_at?: string;
  original_document_url?: string;
  signed_document_url?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  signatures?: Signature[];
}

export interface SignatureAuditEntry {
  id: string;
  request_id: string;
  action: 'created' | 'updated' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired' | 'cancelled' | 'reminded' | 'downloaded' | 'voided' | 'resent';
  actor_email?: string;
  actor_name?: string;
  actor_role?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
  created_at: string;
}

export interface SignatureTemplate {
  id: string;
  builder_id?: string;
  name: string;
  description?: string;
  document_type: string;
  default_signers: Array<{
    role: string;
    order: number;
    required: boolean;
  }>;
  default_message?: string;
  default_expiration_days: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SignatureStats {
  total: number;
  by_status: Record<string, number>;
  by_document_type: Record<string, number>;
  by_provider: Record<string, number>;
  awaiting_signature: number;
}

interface SignatureRequestFilters {
  document_type?: string;
  document_id?: string;
  status?: string;
  external_provider?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

async function fetchSignatureStats(params?: { document_type?: string; document_id?: string }): Promise<SignatureStats> {
  const searchParams = new URLSearchParams();
  if (params?.document_type) searchParams.append('document_type', params.document_type);
  if (params?.document_id) searchParams.append('document_id', params.document_id);

  const response = await apiGet(`/api/signatures/stats?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch signature stats');
  return response.json();
}

async function fetchSignatureRequests(filters: SignatureRequestFilters = {}): Promise<SignatureRequest[]> {
  const params = new URLSearchParams();
  if (filters.document_type) params.append('document_type', filters.document_type);
  if (filters.document_id) params.append('document_id', filters.document_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.external_provider) params.append('external_provider', filters.external_provider);
  if (filters.search) params.append('search', filters.search);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const response = await apiGet(`/api/signatures/requests?${params}`);
  if (!response.ok) throw new Error('Failed to fetch signature requests');
  const data = await response.json();
  return data.requests;
}

async function fetchSignatureRequest(id: string): Promise<SignatureRequest> {
  const response = await apiGet(`/api/signatures/requests/${id}`);
  if (!response.ok) throw new Error('Failed to fetch signature request');
  const data = await response.json();
  return data.request;
}

async function createSignatureRequest(request: Partial<SignatureRequest>): Promise<SignatureRequest> {
  const response = await apiPost('/api/signatures/requests', request);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create signature request');
  }
  const data = await response.json();
  return data.request;
}

async function updateSignatureRequest(id: string, updates: Partial<SignatureRequest>): Promise<SignatureRequest> {
  const response = await apiPatch(`/api/signatures/requests/${id}`, updates);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update signature request');
  }
  const data = await response.json();
  return data.request;
}

async function deleteSignatureRequest(id: string): Promise<void> {
  const response = await apiDelete(`/api/signatures/requests/${id}`);
  if (!response.ok) throw new Error('Failed to delete signature request');
}

async function sendSignatureRequest(id: string, params?: { message?: string; sent_by?: string }): Promise<SignatureRequest> {
  const response = await apiPost(`/api/signatures/requests/${id}/send`, params || {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send signature request');
  }
  const data = await response.json();
  return data.request;
}

export interface SignParams {
  signer_email: string;
  signer_name?: string;
  signature_type: 'drawn' | 'typed' | 'uploaded';
  signature_data?: string;
  typed_name?: string;
}

async function signRequest(id: string, params: SignParams): Promise<{ request: SignatureRequest; signature: Signature }> {
  const response = await apiPost(`/api/signatures/requests/${id}/sign`, params);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit signature');
  }
  return response.json();
}

async function declineRequest(id: string, params: { signer_email: string; decline_reason?: string }): Promise<SignatureRequest> {
  const response = await apiPost(`/api/signatures/requests/${id}/decline`, params);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to decline request');
  }
  const data = await response.json();
  return data.request;
}

async function cancelRequest(id: string, params?: { reason?: string }): Promise<SignatureRequest> {
  const response = await apiPost(`/api/signatures/requests/${id}/cancel`, params || {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel request');
  }
  const data = await response.json();
  return data.request;
}

async function resendRequest(id: string, params?: { signer_email?: string }): Promise<void> {
  const response = await apiPost(`/api/signatures/requests/${id}/resend`, params || {});
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to resend request');
  }
}

async function fetchAuditTrail(requestId: string, limit?: number): Promise<SignatureAuditEntry[]> {
  const params = limit ? `?limit=${limit}` : '';
  const response = await apiGet(`/api/signatures/requests/${requestId}/audit${params}`);
  if (!response.ok) throw new Error('Failed to fetch audit trail');
  const data = await response.json();
  return data.audit;
}

async function recordView(requestId: string, params: { viewer_email?: string; viewer_name?: string }): Promise<void> {
  await apiPost(`/api/signatures/requests/${requestId}/view`, params);
}

async function fetchSignatureTemplates(params?: { document_type?: string; is_active?: boolean }): Promise<SignatureTemplate[]> {
  const searchParams = new URLSearchParams();
  if (params?.document_type) searchParams.append('document_type', params.document_type);
  if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());

  const response = await apiGet(`/api/signatures/templates?${searchParams}`);
  if (!response.ok) throw new Error('Failed to fetch signature templates');
  const data = await response.json();
  return data.templates;
}

async function createSignatureTemplate(template: Partial<SignatureTemplate>): Promise<SignatureTemplate> {
  const response = await apiPost('/api/signatures/templates', template);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create template');
  }
  const data = await response.json();
  return data.template;
}

// ============================================================
// HOOKS
// ============================================================

export function useSignatureStats(params?: { document_type?: string; document_id?: string }) {
  return useQuery({
    queryKey: ['signature-stats', params],
    queryFn: () => fetchSignatureStats(params),
  });
}

export function useSignatureRequests(filters: SignatureRequestFilters = {}) {
  return useQuery({
    queryKey: ['signature-requests', filters],
    queryFn: () => fetchSignatureRequests(filters),
  });
}

export function useSignatureRequest(id: string) {
  return useQuery({
    queryKey: ['signature-request', id],
    queryFn: () => fetchSignatureRequest(id),
    enabled: !!id,
  });
}

export function useSignatureAudit(requestId: string, limit?: number) {
  return useQuery({
    queryKey: ['signature-audit', requestId, limit],
    queryFn: () => fetchAuditTrail(requestId, limit),
    enabled: !!requestId,
  });
}

export function useSignatureTemplates(params?: { document_type?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['signature-templates', params],
    queryFn: () => fetchSignatureTemplates(params),
  });
}

export function useCreateSignatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSignatureRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useUpdateSignatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<SignatureRequest> }) =>
      updateSignatureRequest(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-request', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useDeleteSignatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteSignatureRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useSendSignatureRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: { message?: string; sent_by?: string } }) =>
      sendSignatureRequest(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-request', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useSignRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: SignParams }) =>
      signRequest(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-request', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-audit', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useDeclineRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: { signer_email: string; decline_reason?: string } }) =>
      declineRequest(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-request', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-audit', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useCancelRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: { reason?: string } }) =>
      cancelRequest(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-requests'] });
      queryClient.invalidateQueries({ queryKey: ['signature-request', id] });
      queryClient.invalidateQueries({ queryKey: ['signature-stats'] });
    },
  });
}

export function useResendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: { signer_email?: string } }) =>
      resendRequest(id, params),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['signature-audit', id] });
    },
  });
}

export function useRecordView() {
  return useMutation({
    mutationFn: ({ requestId, params }: { requestId: string; params: { viewer_email?: string; viewer_name?: string } }) =>
      recordView(requestId, params),
  });
}

export function useCreateSignatureTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createSignatureTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signature-templates'] });
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export function getSignerStatusColor(status: string): string {
  switch (status) {
    case 'signed':
      return 'text-green-600';
    case 'declined':
      return 'text-red-600';
    case 'pending':
    default:
      return 'text-amber-600';
  }
}

export function getRequestStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-700 border-green-200';
    case 'pending':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'declined':
    case 'expired':
    case 'cancelled':
      return 'bg-red-100 text-red-700 border-red-200';
    case 'draft':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export function formatSignatureDate(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString();
}

export function getSignedCount(signers: Signer[]): { signed: number; total: number } {
  const signed = signers.filter(s => s.signed_at).length;
  return { signed, total: signers.length };
}

export function isRequestComplete(request: SignatureRequest): boolean {
  return request.status === 'completed';
}

export function canSign(request: SignatureRequest, email: string): boolean {
  if (request.status !== 'pending') return false;

  const signer = request.signers.find(s => s.email.toLowerCase() === email.toLowerCase());
  if (!signer || signer.signed_at || signer.declined_at) return false;

  // Check if previous signers have signed (ordering)
  const previousSigners = request.signers.filter(s => s.order < signer.order);
  return previousSigners.every(s => s.signed_at);
}
