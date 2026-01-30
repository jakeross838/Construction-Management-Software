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
  trade_type?: string; // from v2_bids
  scope_of_work: string | null;
  issue_date: string | null;
  due_date: string | null;
  received_date?: string | null; // from v2_bids
  site_visit_date: string | null;
  site_visit_time: string | null;
  status: 'draft' | 'issued' | 'receiving' | 'evaluating' | 'awarded' | 'cancelled' | 'received' | 'in_review' | 'accepted' | 'rejected' | 'withdrawn';
  square_footage: number | null;
  specs_summary: string | null;
  special_requirements: string | null;
  awarded_vendor_id: string | null;
  awarded_at: string | null;
  awarded_amount: number | null;
  bid_amount?: number | null; // from v2_bids
  created_at: string;
  updated_at: string;
  // Joined fields
  job_name?: string;
  job?: { id: string; name: string }; // from v2_bids
  awarded_vendor_name?: string;
  vendor?: { id: string; name: string }; // from v2_bids
  vendor_id?: string; // from v2_bids
  invite_count?: number;
  bid_count?: number;
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

// ==================== SUBCONTRACTOR BIDS ====================

export function useSubcontractorBids(bidPackageId?: string) {
  return useQuery({
    queryKey: ['subcontractor-bids', bidPackageId],
    queryFn: async () => {
      const endpoint = bidPackageId ? `/bids/${bidPackageId}/submissions` : '/bids/submissions';
      return api<SubcontractorBid[]>(endpoint);
    },
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

// ==================== UTILITY: Generate Package Number ====================

export async function generatePackageNumber(jobId?: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  // Generate a number based on timestamp since we can't query count via API easily
  const nextNum = Date.now().toString().slice(-4);
  return `BP-${year}-${nextNum}`;
}
