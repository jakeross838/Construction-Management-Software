import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ==================== TYPES ====================

export interface BidPackage {
  id: string;
  job_id: string | null;
  package_number: string;
  title: string;
  description: string | null;
  trade_category: string;
  scope_of_work: string | null;
  issue_date: string | null;
  due_date: string;
  site_visit_date: string | null;
  site_visit_time: string | null;
  status: 'draft' | 'issued' | 'receiving' | 'evaluating' | 'awarded' | 'cancelled';
  square_footage: number | null;
  specs_summary: string | null;
  special_requirements: string | null;
  awarded_vendor_id: string | null;
  awarded_at: string | null;
  awarded_amount: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  job_name?: string;
  awarded_vendor_name?: string;
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
  'Site Work',
  'Concrete',
  'Masonry',
  'Metals',
  'Wood & Plastics',
  'Thermal & Moisture',
  'Doors & Windows',
  'Finishes',
  'Specialties',
  'Equipment',
  'Furnishings',
  'Special Construction',
  'Conveying Systems',
  'Mechanical',
  'Plumbing',
  'HVAC',
  'Electrical',
  'Drywall',
  'Painting',
  'Flooring',
  'Roofing',
  'Insulation',
  'Cabinets & Millwork',
  'Tile',
  'Landscaping',
  'Pool',
  'Other',
];

export const BID_PACKAGE_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-700' },
  { value: 'issued', label: 'Issued', color: 'bg-blue-100 text-blue-700' },
  { value: 'receiving', label: 'Receiving Bids', color: 'bg-amber-100 text-amber-700' },
  { value: 'evaluating', label: 'Evaluating', color: 'bg-purple-100 text-purple-700' },
  { value: 'awarded', label: 'Awarded', color: 'bg-green-100 text-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-700' },
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
      let query = supabase
        .from('bid_packages')
        .select(`
          *,
          jobs(name),
          vendors(name)
        `)
        .order('due_date', { ascending: true });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get counts for invites and bids
      const packageIds = (data || []).map((p: any) => p.id);
      
      const [inviteCounts, bidCounts] = await Promise.all([
        supabase
          .from('bid_package_invites')
          .select('bid_package_id')
          .in('bid_package_id', packageIds),
        supabase
          .from('subcontractor_bids')
          .select('bid_package_id')
          .in('bid_package_id', packageIds),
      ]);

      const inviteMap = new Map<string, number>();
      const bidMap = new Map<string, number>();

      (inviteCounts.data || []).forEach((i: any) => {
        inviteMap.set(i.bid_package_id, (inviteMap.get(i.bid_package_id) || 0) + 1);
      });
      (bidCounts.data || []).forEach((b: any) => {
        bidMap.set(b.bid_package_id, (bidMap.get(b.bid_package_id) || 0) + 1);
      });

      return (data || []).map((p: any) => ({
        ...p,
        job_name: p.jobs?.name,
        awarded_vendor_name: p.vendors?.name,
        invite_count: inviteMap.get(p.id) || 0,
        bid_count: bidMap.get(p.id) || 0,
      })) as BidPackage[];
    },
  });
}

export function useBidPackage(id: string) {
  return useQuery({
    queryKey: ['bid-package', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_packages')
        .select(`
          *,
          jobs(name),
          vendors(name)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        job_name: (data as any).jobs?.name,
        awarded_vendor_name: (data as any).vendors?.name,
      } as BidPackage;
    },
    enabled: !!id,
  });
}

export function useCreateBidPackage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<BidPackage>) => {
      const { data: result, error } = await supabase
        .from('bid_packages')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
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
    mutationFn: async ({ id, ...data }: Partial<BidPackage> & { id: string }) => {
      const { data: result, error } = await supabase
        .from('bid_packages')
        .update(data as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bid_packages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bid-packages'] });
      toast.success('Bid package deleted');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID PACKAGE DOCUMENTS ====================

export function useBidPackageDocuments(bidPackageId: string) {
  return useQuery({
    queryKey: ['bid-package-documents', bidPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_package_documents')
        .select('*')
        .eq('bid_package_id', bidPackageId)
        .order('document_type')
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      return data as BidPackageDocument[];
    },
    enabled: !!bidPackageId,
  });
}

export function useAddBidPackageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<BidPackageDocument>) => {
      const { data: result, error } = await supabase
        .from('bid_package_documents')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-documents', variables.bid_package_id] });
      toast.success('Document added');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteBidPackageDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bidPackageId }: { id: string; bidPackageId: string }) => {
      const { error } = await supabase.from('bid_package_documents').delete().eq('id', id);
      if (error) throw error;
      return bidPackageId;
    },
    onSuccess: (bidPackageId) => {
      queryClient.invalidateQueries({ queryKey: ['bid-package-documents', bidPackageId] });
      toast.success('Document removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== BID PACKAGE INVITES ====================

export function useBidPackageInvites(bidPackageId: string) {
  return useQuery({
    queryKey: ['bid-package-invites', bidPackageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_package_invites')
        .select(`
          *,
          vendors(name, email, phone)
        `)
        .eq('bid_package_id', bidPackageId)
        .order('invited_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((i: any) => ({
        ...i,
        vendor_name: i.vendors?.name,
        vendor_email: i.vendors?.email,
        vendor_phone: i.vendors?.phone,
      })) as BidPackageInvite[];
    },
    enabled: !!bidPackageId,
  });
}

export function useAddBidPackageInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { bid_package_id: string; vendor_id: string }) => {
      const { data: result, error } = await supabase
        .from('bid_package_invites')
        .insert([data])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
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
    mutationFn: async ({ id, bidPackageId }: { id: string; bidPackageId: string }) => {
      const { error } = await supabase.from('bid_package_invites').delete().eq('id', id);
      if (error) throw error;
      return bidPackageId;
    },
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
      let query = supabase
        .from('subcontractor_bids')
        .select(`
          *,
          vendors(name, email),
          bid_packages(title)
        `)
        .order('bid_amount', { ascending: true });

      if (bidPackageId) {
        query = query.eq('bid_package_id', bidPackageId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((b: any) => ({
        ...b,
        inclusions: b.inclusions || [],
        exclusions: b.exclusions || [],
        clarifications: b.clarifications || [],
        alternate_amounts: b.alternate_amounts || [],
        vendor_name: b.vendors?.name,
        vendor_email: b.vendors?.email,
        package_title: b.bid_packages?.title,
      })) as SubcontractorBid[];
    },
  });
}

export function useSubcontractorBid(id: string) {
  return useQuery({
    queryKey: ['subcontractor-bid', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_bids')
        .select(`
          *,
          vendors(name, email),
          bid_packages(title, trade_category, scope_of_work, square_footage)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        inclusions: (data as any).inclusions || [],
        exclusions: (data as any).exclusions || [],
        clarifications: (data as any).clarifications || [],
        alternate_amounts: (data as any).alternate_amounts || [],
        vendor_name: (data as any).vendors?.name,
        vendor_email: (data as any).vendors?.email,
        package_title: (data as any).bid_packages?.title,
      } as SubcontractorBid;
    },
    enabled: !!id,
  });
}

export function useCreateSubcontractorBid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
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
    }) => {
      const insertData = {
        bid_package_id: data.bid_package_id,
        vendor_id: data.vendor_id,
        bid_amount: data.bid_amount,
        unit_price_per_sf: data.unit_price_per_sf,
        inclusions: (data.inclusions || []) as any,
        exclusions: (data.exclusions || []) as any,
        clarifications: (data.clarifications || []) as any,
        alternate_amounts: (data.alternate_amounts || []) as any,
        proposed_start_date: data.proposed_start_date,
        proposed_duration_days: data.proposed_duration_days,
        payment_terms: data.payment_terms,
        warranty_terms: data.warranty_terms,
        bond_included: data.bond_included,
        insurance_verified: data.insurance_verified,
        valid_until: data.valid_until,
        notes: data.notes,
      };
      const { data: result, error } = await supabase
        .from('subcontractor_bids')
        .insert([insertData])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
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
    mutationFn: async ({ id, ...data }: Partial<SubcontractorBid> & { id: string }) => {
      const updateData = {
        ...data,
        inclusions: data.inclusions as any,
        exclusions: data.exclusions as any,
        clarifications: data.clarifications as any,
        alternate_amounts: data.alternate_amounts as any,
      };
      const { data: result, error } = await supabase
        .from('subcontractor_bids')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('subcontractor_bids').delete().eq('id', id);
      if (error) throw error;
    },
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subcontractor_bid_items')
        .select(`
          *,
          cost_codes(name)
        `)
        .eq('subcontractor_bid_id', bidId)
        .order('sort_order');

      if (error) throw error;
      return (data || []).map((i: any) => ({
        ...i,
        cost_code_name: i.cost_codes?.name,
      })) as SubcontractorBidItem[];
    },
    enabled: !!bidId,
  });
}

export function useCreateSubcontractorBidItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SubcontractorBidItem>) => {
      const { data: result, error } = await supabase
        .from('subcontractor_bid_items')
        .insert([data as any])
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subcontractor-bid-items', variables.subcontractor_bid_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ==================== UTILITY: Generate Package Number ====================

export async function generatePackageNumber(jobId?: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(-2);
  
  const { count, error } = await supabase
    .from('bid_packages')
    .select('*', { count: 'exact', head: true });

  if (error) throw error;
  
  const nextNum = ((count || 0) + 1).toString().padStart(4, '0');
  return `BP-${year}-${nextNum}`;
}
