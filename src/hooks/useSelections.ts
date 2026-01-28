import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type SelectionCategory = 
  | 'flooring' 
  | 'cabinets' 
  | 'countertops' 
  | 'fixtures' 
  | 'appliances' 
  | 'hardware' 
  | 'paint' 
  | 'tile' 
  | 'lighting' 
  | 'plumbing' 
  | 'other';

export type OrderStatus = 'not_ordered' | 'ordered' | 'shipped' | 'received' | 'installed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface SelectionOption {
  name: string;
  description?: string;
  cost?: number;
  url?: string;
  image_url?: string;
}

export interface Selection {
  id: string;
  job_id: string;
  name: string;
  description: string | null;
  category: SelectionCategory;
  room_area: string | null;
  options: SelectionOption[];
  selected_option: string | null;
  allowance_amount: number;
  actual_cost: number;
  variance: number;
  cost_code_id: string | null;
  vendor_id: string | null;
  lead_time_days: number | null;
  order_status: OrderStatus;
  ordered_at: string | null;
  expected_delivery: string | null;
  po_id: string | null;
  approval_status: ApprovalStatus;
  approved_at: string | null;
  approved_by: string | null;
  client_notes: string | null;
  image_url: string | null;
  reference_url: string | null;
  sort_order: number;
  is_required: boolean;
  due_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  job_name?: string;
  vendor_name?: string;
  cost_code_name?: string;
  po_number?: string;
}

export interface SelectionInsert {
  job_id: string;
  name: string;
  description?: string;
  category: SelectionCategory;
  room_area?: string;
  options?: SelectionOption[];
  selected_option?: string;
  allowance_amount?: number;
  actual_cost?: number;
  cost_code_id?: string;
  vendor_id?: string;
  lead_time_days?: number;
  order_status?: OrderStatus;
  expected_delivery?: string;
  po_id?: string;
  approval_status?: ApprovalStatus;
  client_notes?: string;
  image_url?: string;
  reference_url?: string;
  is_required?: boolean;
  due_date?: string;
  notes?: string;
}

export const CATEGORY_OPTIONS: { value: SelectionCategory; label: string; icon: string }[] = [
  { value: 'flooring', label: 'Flooring', icon: '🪵' },
  { value: 'cabinets', label: 'Cabinets', icon: '🗄️' },
  { value: 'countertops', label: 'Countertops', icon: '🔲' },
  { value: 'fixtures', label: 'Fixtures', icon: '🚿' },
  { value: 'appliances', label: 'Appliances', icon: '🍳' },
  { value: 'hardware', label: 'Hardware', icon: '🔩' },
  { value: 'paint', label: 'Paint', icon: '🎨' },
  { value: 'tile', label: 'Tile', icon: '🧱' },
  { value: 'lighting', label: 'Lighting', icon: '💡' },
  { value: 'plumbing', label: 'Plumbing', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '📦' },
];

export const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'not_ordered', label: 'Not Ordered', color: 'text-muted-foreground' },
  { value: 'ordered', label: 'Ordered', color: 'text-blue-600' },
  { value: 'shipped', label: 'Shipped', color: 'text-purple-600' },
  { value: 'received', label: 'Received', color: 'text-amber-600' },
  { value: 'installed', label: 'Installed', color: 'text-green-600' },
];

export const APPROVAL_STATUS_OPTIONS: { value: ApprovalStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'pending', label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  { value: 'approved', label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'rejected', label: 'Rejected', color: 'text-red-700', bgColor: 'bg-red-100' },
];

export const ROOM_AREA_OPTIONS = [
  'Kitchen',
  'Master Bath',
  'Guest Bath',
  'Powder Room',
  'Living Room',
  'Dining Room',
  'Master Bedroom',
  'Bedroom 2',
  'Bedroom 3',
  'Bedroom 4',
  'Office',
  'Laundry',
  'Garage',
  'Exterior',
  'Mudroom',
  'Foyer',
  'Hallway',
  'Basement',
  'Attic',
  'Outdoor Living',
  'Pool Area',
  'Whole House',
  'Other',
];

export function useSelections(jobId?: string | null) {
  return useQuery({
    queryKey: ['selections', jobId],
    queryFn: async () => {
      let query = supabase
        .from('selections')
        .select(`
          *,
          jobs:job_id(name),
          vendors:vendor_id(name),
          cost_codes:cost_code_id(name, code),
          purchase_orders:po_id(po_number)
        `)
        .order('category')
        .order('sort_order');

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data || []).map((s: any) => ({
        ...s,
        options: s.options || [],
        job_name: s.jobs?.name,
        vendor_name: s.vendors?.name,
        cost_code_name: s.cost_codes ? `${s.cost_codes.code} - ${s.cost_codes.name}` : null,
        po_number: s.purchase_orders?.po_number,
      })) as Selection[];
    },
  });
}

export function useSelectionStats(jobId?: string | null) {
  return useQuery({
    queryKey: ['selection-stats', jobId],
    queryFn: async () => {
      let query = supabase.from('selections').select('*');

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const selections = data || [];
      const pending = selections.filter(s => s.approval_status === 'pending');
      const approved = selections.filter(s => s.approval_status === 'approved');
      const needsOrder = approved.filter(s => s.order_status === 'not_ordered');

      const totalAllowance = selections.reduce((sum, s) => sum + (s.allowance_amount || 0), 0);
      const totalActual = selections.reduce((sum, s) => sum + (s.actual_cost || 0), 0);

      return {
        total: selections.length,
        pending: pending.length,
        approved: approved.length,
        needsOrder: needsOrder.length,
        totalAllowance,
        totalActual,
        variance: totalAllowance - totalActual,
      };
    },
  });
}

export function useCreateSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SelectionInsert) => {
      const insertData = {
        ...data,
        options: data.options as unknown as any,
      };
      const { data: result, error } = await supabase
        .from('selections')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      queryClient.invalidateQueries({ queryKey: ['selection-stats'] });
      toast.success('Selection created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create selection: ' + error.message);
    },
  });
}

export function useUpdateSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, options, ...data }: Partial<Selection> & { id: string }) => {
      const updateData = {
        ...data,
        ...(options !== undefined && { options: options as unknown as any }),
      };
      const { data: result, error } = await supabase
        .from('selections')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      queryClient.invalidateQueries({ queryKey: ['selection-stats'] });
      toast.success('Selection updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update selection: ' + error.message);
    },
  });
}

export function useDeleteSelection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('selections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['selections'] });
      queryClient.invalidateQueries({ queryKey: ['selection-stats'] });
      toast.success('Selection deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete selection: ' + error.message);
    },
  });
}
