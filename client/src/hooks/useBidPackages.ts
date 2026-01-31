import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// API helper
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ==================== TYPES ====================

export interface BidPackage {
  id: string;
  job_id: string | null;
  package_number?: string;
  title: string;
  description: string | null;
  trade_category?: string;
  trade_type?: string; // legacy field
  scope_of_work: string | null;
  issue_date: string | null;
  due_date: string | null;
  received_date?: string | null;
  site_visit_date?: string | null;
  site_visit_time?: string | null;
  status: 'draft' | 'issued' | 'receiving' | 'evaluating' | 'awarded' | 'cancelled' | 'received' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';
  square_footage?: number | null;
  specs_summary?: string | null;
  special_requirements?: string | null;
  notes?: string | null;
  // Award fields
  awarded_vendor_id: string | null;
  awarded_at: string | null;
  awarded_amount: number | null;
  // Legacy fields from v2_bids
  bid_amount?: number | null;
  vendor_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined/computed fields
  job_name?: string;
  job?: { id: string; name: string };
  awarded_vendor_name?: string;
  awarded_vendor?: { id: string; name: string };
  vendor?: { id: string; name: string };
  invite_count?: number;
  bid_count?: number;
  document_count?: number;
}

export interface BidPackageDocument {
  id: string;
  bid_package_id: string;
  document_type: 'plans' | 'specifications' | 'scope' | 'contract' | 'addendum' | 'other';
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  description: string | null;
  version: number;
  uploaded_at: string;
  uploaded_by: string | null;
}

export interface BidPackageInvite {
  id: string;
  bid_package_id: string;
  vendor_id: string;
  invited_at: string;
  invite_sent: boolean;
  invite_sent_at: string | null;
  viewed_at: string | null;
  declined: boolean;
  declined_reason: string | null;
  vendor_name?: string;
  vendor_email?: string;
  vendor_phone?: string;
}

export interface SubcontractorBidDocument {
  id: string;
  subcontractor_bid_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  document_type: 'proposal' | 'quote' | 'schedule' | 'insurance' | 'other';
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface SubcontractorBid {
  id: string;
  bid_package_id: string;
  vendor_id: string;
  bid_amount: number;
  unit_price_per_sf: number | null;
  alternate_amounts: Array<{ description: string; amount: number }>;
  inclusions: string[];
  exclusions: string[];
  clarifications: string[];
  proposed_start_date: string | null;
  proposed_duration_days: number | null;
  payment_terms: string | null;
  warranty_terms: string | null;
  bond_included: boolean;
  insurance_verified: boolean;
  status: 'submitted' | 'under_review' | 'shortlisted' | 'selected' | 'rejected' | 'withdrawn';
  is_lowest_bid: boolean;
  ranking: number | null;
  evaluation_score: number | null;
  evaluation_notes: string | null;
  proposal_url: string | null;
  submitted_at: string;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  vendor_name?: string;
  vendor_email?: string;
  package_title?: string;
  document_count?: number;
  documents?: SubcontractorBidDocument[];
}

export interface SubcontractorBidItem {
  id: string;
  subcontractor_bid_id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
  cost_code_id: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  cost_code_name?: string;
}

// ==================== TRADE CATEGORIES ====================

export const TRADE_CATEGORIES = [
  'Site Work', 'Concrete', 'Masonry', 'Metals', 'Wood & Plastics',
  'Thermal & Moisture', 'Doors & Windows', 'Finishes', 'Specialties',
  'Equipment', 'Furnishings', 'Special Construction', 'Conveying Systems',
  'Mechanical', 'Plumbing', 'HVAC', 'Electrical', 'Drywall', 'Painting',
  'Flooring', 'Roofing', 'Insulation', 'Cabinets & Millwork', 'Tile',
  'Landscaping', 'Pool', 'Other',
];

export const BID_PACKAGE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'issued', label: 'Issued', color: 'bg-blue-100 text-blue-700' },
  { value: 'receiving', label: 'Receiving Bids', color: 'bg-amber-100 text-amber-700' },
  { value: 'evaluating', label: 'Evaluating', color: 'bg-purple-100 text-purple-700' },
  { value: 'awarded', label: 'Awarded', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
  // v2_bids statuses for backward compatibility
  { value: 'received', label: 'Received', color: 'bg-blue-100 text-blue-700' },
  { value: 'in_review', label: 'In Review', color: 'bg-amber-100 text-amber-700' },
  { value: 'accepted', label: 'Accepted', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-700' },
];

export const SUBCONTRACTOR_BID_STATUS_OPTIONS = [
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { value: 'under_review', label: 'Under Review', color: 'bg-amber-100 text-amber-700' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-purple-100 text-purple-700' },
  { value: 'selected', label: 'Selected', color: 'bg-green-100 text-green-700' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-100 text-gray-700' },
];

// ==================== AI TRADE SUGGESTION ====================

interface TradeSuggestion {
  success: boolean;
  suggestion: string;
  confidence: number;
  reasoning: string;
  alternatives: string[];
}

export function useSuggestTradeCategory() {
  return useMutation({
    mutationFn: async ({ title, description, scope_of_work }: {
      title: string;
      description?: string;
      scope_of_work?: string;
    }) => {
      return api<TradeSuggestion>('/bids/suggest-trade', {
        method: 'POST',
        body: JSON.stringify({ title, description, scope_of_work }),
      });
    },
  });
}

// ==================== BID PACKAGES ====================

export function useBidPackages(jobId?: string) {
  return useQuery({
    queryKey: ['bid-packages', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/bids?job_id=${jobId}` : '/bids';
      return api<BidPackage[]>(endpoint);
    },
  });
}

export function useBidPackage(id: string) {
  return useQuery({
    queryKey: ['bid-package', id],
    queryFn: () => api<BidPackage>(`/bids/${id}`),
    enabled: !!id,
  });
}

export function useCreateBidPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BidPackage>) => api<BidPackage>('/bids', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Bid package created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBidPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<BidPackage> & { id: string }) =>
      api<BidPackage>(`/bids/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      queryClient.invalidateQueries({ queryKey: ['bid-package', variables.id] });
      toast.success('Bid package updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBidPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/bids/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Bid package deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAwardBidPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id: string;
      vendor_id: string;
      amount: number;
      submission_id?: string;
      notes?: string;
    }) =>
      api<BidPackage>(`/bids/${data.id}/award`, {
        method: 'POST',
        body: JSON.stringify({
          vendor_id: data.vendor_id,
          amount: data.amount,
          submission_id: data.submission_id,
          notes: data.notes,
        }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      queryClient.invalidateQueries({ queryKey: ['bid-package', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids', variables.id] });
      toast.success('Bid package awarded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID DOCUMENTS ====================

export interface BidDocument {
  id: string;
  bid_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export function useBidDocuments(bidId: string) {
  return useQuery({
    queryKey: ['bid-documents', bidId],
    queryFn: async () => {
      // Get documents from the bid's documents array in the main response
      const bid = await api<BidPackage & { documents: BidDocument[] }>(`/bids/${bidId}`);
      return bid.documents || [];
    },
    enabled: !!bidId,
  });
}

export function useUploadBidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bidId, file }: { bidId: string; file: File }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('uploaded_by', 'User');

      const response = await fetch(`/api/bids/${bidId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents', variables.bidId] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Document uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, bidId }: { docId: string; bidId: string }) => {
      const response = await fetch(`/api/bids/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: 'User' }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return bidId;
    },
    onSuccess: (bidId) => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents', bidId] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Document deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      docId,
      fromBidId,
      toBidId,
    }: {
      docId: string;
      fromBidId: string;
      toBidId: string;
    }) => {
      const response = await fetch(`/api/bids/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bid_id: toBidId, moved_by: 'User' }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return { fromBidId, toBidId };
    },
    onSuccess: ({ fromBidId, toBidId }) => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents', fromBidId] });
      queryClient.invalidateQueries({ queryKey: ['bid-documents', toBidId] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Document moved');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Legacy hooks for backward compatibility with bid packages
export function useBidPackageDocuments(bidPackageId: string) {
  return useBidDocuments(bidPackageId);
}

export function useAddBidPackageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BidPackageDocument>) =>
      api<BidPackageDocument>(`/bids/${data.bid_package_id}/documents`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents', variables.bid_package_id] });
      toast.success('Document added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBidPackageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bidPackageId }: { id: string; bidPackageId: string }) =>
      api(`/bids/documents/${id}`, { method: 'DELETE' }).then(() => bidPackageId),
    onSuccess: (bidPackageId) => {
      queryClient.invalidateQueries({ queryKey: ['bid-documents', bidPackageId] });
      toast.success('Document removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID PACKAGE INVITES ====================

export function useBidPackageInvites(bidPackageId: string) {
  return useQuery({
    queryKey: ['bid-package-invites', bidPackageId],
    queryFn: () => api<BidPackageInvite[]>(`/bids/${bidPackageId}/invites`),
    enabled: !!bidPackageId,
  });
}

export function useAddBidPackageInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { bid_package_id: string; vendor_id: string }) =>
      api(`/bids/${data.bid_package_id}/invites`, {
        method: 'POST',
        body: JSON.stringify({ vendor_id: data.vendor_id }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-invites', variables.bid_package_id] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Vendor invited');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveBidPackageInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bidPackageId }: { id: string; bidPackageId: string }) =>
      api(`/bids/${bidPackageId}/invites/${id}`, { method: 'DELETE' }).then(() => bidPackageId),
    onSuccess: (bidPackageId) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-invites', bidPackageId] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Invite removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

interface SendInviteResponse {
  success: boolean;
  mailtoLink: string;
  emailContent: {
    to: string;
    subject: string;
    body: string;
  };
  message: string;
}

export function useSendBidPackageInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId, bidPackageId }: { inviteId: string; bidPackageId: string }) => {
      const result = await api<SendInviteResponse>(`/bids/${bidPackageId}/invites/${inviteId}/send`, {
        method: 'POST',
        body: JSON.stringify({ sent_by: 'User' }),
      });
      return { ...result, bidPackageId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-invites', data.bidPackageId] });
      // Open the mailto link
      window.open(data.mailtoLink, '_blank');
      toast.success(data.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== SUBCONTRACTOR BIDS ====================

export function useSubcontractorBids(bidPackageId?: string) {
  return useQuery({
    queryKey: ['subcontractor-bids', bidPackageId],
    queryFn: async () => {
      return api<SubcontractorBid[]>(`/bids/${bidPackageId}/submissions`);
    },
    enabled: !!bidPackageId,
  });
}

export function useSubcontractorBid(id: string) {
  return useQuery({
    queryKey: ['subcontractor-bid', id],
    queryFn: () => api<SubcontractorBid>(`/bids/submissions/${id}`),
    enabled: !!id,
  });
}

export function useCreateSubcontractorBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      bid_package_id: string;
      vendor_id: string;
      bid_amount: number;
      unit_price_per_sf?: number | null;
      inclusions?: string[];
      exclusions?: string[];
      clarifications?: string[];
      alternate_amounts?: Array<{ description: string; amount: number }>;
      proposed_start_date?: string | null;
      proposed_duration_days?: number | null;
      payment_terms?: string | null;
      warranty_terms?: string | null;
      bond_included?: boolean;
      insurance_verified?: boolean;
      valid_until?: string | null;
      notes?: string | null;
    }) => api<SubcontractorBid>(`/bids/${data.bid_package_id}/submissions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids'] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Bid submitted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSubcontractorBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SubcontractorBid> & { id: string }) =>
      api<SubcontractorBid>(`/bids/submissions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid', variables.id] });
      toast.success('Bid updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubcontractorBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/bids/submissions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids'] });
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Bid deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID ITEMS ====================

export function useSubcontractorBidItems(bidId: string) {
  return useQuery({
    queryKey: ['subcontractor-bid-items', bidId],
    queryFn: () => api<SubcontractorBidItem[]>(`/bids/submissions/${bidId}/items`),
    enabled: !!bidId,
  });
}

export function useCreateSubcontractorBidItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<SubcontractorBidItem>) =>
      api(`/bids/submissions/${data.subcontractor_bid_id}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid-items', variables.subcontractor_bid_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== SUBCONTRACTOR BID DOCUMENTS ====================

export function useSubcontractorBidDocuments(submissionId: string) {
  return useQuery({
    queryKey: ['subcontractor-bid-documents', submissionId],
    queryFn: () => api<SubcontractorBidDocument[]>(`/bids/submissions/${submissionId}/documents`),
    enabled: !!submissionId,
  });
}

export function useUploadSubcontractorBidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      submissionId,
      file,
      documentType = 'proposal',
    }: {
      submissionId: string;
      file: File;
      documentType?: string;
    }) => {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('uploaded_by', 'User');
      formData.append('document_type', documentType);

      const response = await fetch(`/api/bids/submissions/${submissionId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid-documents', variables.submissionId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids'] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid', variables.submissionId] });
      toast.success('Document uploaded');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubcontractorBidDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, submissionId }: { docId: string; submissionId: string }) => {
      const response = await fetch(`/api/bids/submissions/${submissionId}/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleted_by: 'User' }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return submissionId;
    },
    onSuccess: (submissionId) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid-documents', submissionId] });
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bids'] });
      toast.success('Document deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== AI BID EXTRACTION ====================

export interface AIBidExtraction {
  bid_amount: number | null;
  unit_price_per_sf: number | null;
  inclusions: string[];
  exclusions: string[];
  clarifications: string[];
  proposed_start_date: string | null;
  proposed_duration_days: number | null;
  payment_terms: string | null;
  warranty_terms: string | null;
  bond_included: boolean;
  valid_until: string | null;
  vendor_name: string | null;
  confidence: number;
}

export function useExtractBidFromDocument() {
  return useMutation({
    mutationFn: async ({
      submissionId,
      docId,
    }: {
      submissionId: string;
      docId: string;
    }) => {
      const response = await fetch(`/api/bids/submissions/${submissionId}/documents/${docId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json() as Promise<{
        success: boolean;
        extraction: AIBidExtraction | null;
        error?: string;
        source_document?: string;
      }>;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useExtractBidFromFile() {
  return useMutation({
    mutationFn: async ({
      submissionId,
      file,
    }: {
      submissionId: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append('document', file);

      const response = await fetch(`/api/bids/submissions/${submissionId}/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return response.json() as Promise<{
        success: boolean;
        extraction: AIBidExtraction | null;
        error?: string;
        source_file?: string;
      }>;
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID PACKAGE TEMPLATES ====================

export interface BidPackageTemplate {
  id: string;
  name: string;
  description: string | null;
  trade_category: string;
  scope_of_work: string | null;
  specs_summary: string | null;
  special_requirements: string | null;
  default_duration_days: number | null;
  typical_square_footage: number | null;
  is_active: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  checklist?: Array<{
    id: string;
    item_text: string;
    is_required: boolean;
    sort_order: number;
  }>;
}

export function useBidPackageTemplates(tradeCategory?: string) {
  return useQuery({
    queryKey: ['bid-package-templates', tradeCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tradeCategory) params.append('trade_category', tradeCategory);
      return api<BidPackageTemplate[]>(`/bids/templates/list?${params}`);
    },
  });
}

export function useBidPackageTemplate(templateId: string) {
  return useQuery({
    queryKey: ['bid-package-template', templateId],
    queryFn: () => api<BidPackageTemplate>(`/bids/templates/${templateId}`),
    enabled: !!templateId,
  });
}

export function useCreateBidPackageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<BidPackageTemplate> & { checklist?: string[] }) =>
      api<BidPackageTemplate>('/bids/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-templates'] });
      toast.success('Template created');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateTemplateFromPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, name }: { packageId: string; name?: string }) =>
      api<BidPackageTemplate>(`/bids/templates/from-package/${packageId}`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-templates'] });
      toast.success('Template created from bid package');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateBidPackageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<BidPackageTemplate> & { id: string }) =>
      api<BidPackageTemplate>(`/bids/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-templates'] });
      queryClient.invalidateQueries({ queryKey: ['bid-package-template', variables.id] });
      toast.success('Template updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBidPackageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/bids/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-templates'] });
      toast.success('Template deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useApplyBidPackageTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) =>
      api<{
        trade_category: string;
        scope_of_work: string | null;
        description: string | null;
        specs_summary: string | null;
        special_requirements: string | null;
        square_footage: number | null;
      }>(`/bids/templates/${templateId}/apply`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-templates'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== UTILITY: Generate Package Number ====================

export async function generatePackageNumber(jobId?: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  // Generate a number based on timestamp since we can't query count via API easily
  const nextNum = Date.now().toString().slice(-4);
  return `BP-${year}-${nextNum}`;
}
