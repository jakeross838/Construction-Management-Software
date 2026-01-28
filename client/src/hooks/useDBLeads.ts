import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LeadStage } from '@/types/job';

export interface Lead {
  id: string;
  name: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  address: string | null;
  description: string | null;
  estimated_value: number;
  square_footage: number | null;
  source: string | null;
  stage: LeadStage;
  priority: string | null;
  assigned_to: string | null;
  notes: string | null;
  next_follow_up: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'days_in_stage'>;
export type LeadUpdate = Partial<LeadInsert> & { id: string };

export function useDBLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Lead[];
    },
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Partial<LeadInsert>) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: lead.name || 'Untitled Lead',
          client_name: lead.client_name,
          client_email: lead.client_email,
          client_phone: lead.client_phone,
          address: lead.address,
          description: lead.description,
          estimated_value: lead.estimated_value || 0,
          square_footage: lead.square_footage,
          source: lead.source,
          stage: lead.stage || 'new_inquiry',
          priority: lead.priority || 'medium',
          assigned_to: lead.assigned_to,
          notes: lead.notes,
          next_follow_up: lead.next_follow_up,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created');
    },
    onError: (error: Error) => {
      console.error('Failed to create lead:', error);
      toast.error('Failed to create lead');
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: LeadUpdate) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update lead:', error);
      toast.error('Failed to update lead');
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete lead:', error);
      toast.error('Failed to delete lead');
    },
  });
}

export function useMoveLeadToStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: LeadStage }) => {
      const { data, error } = await supabase
        .from('leads')
        .update({ stage, days_in_stage: 0 })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { stage }) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success(`Lead moved to ${stage.replace('_', ' ')}`);
    },
    onError: (error: Error) => {
      console.error('Failed to move lead:', error);
      toast.error('Failed to move lead');
    },
  });
}

export const stageOrder: LeadStage[] = [
  'new_inquiry',
  'qualifying',
  'site_visit',
  'estimating',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
];

export function getNextStage(current: LeadStage): LeadStage | null {
  const idx = stageOrder.indexOf(current);
  if (idx === -1 || idx >= stageOrder.length - 2) return null;
  return stageOrder[idx + 1];
}

export const sourceOptions = [
  'Referral',
  'Website',
  'Social Media',
  'Home Show',
  'Repeat Client',
  'Cold Call',
  'Other',
];

export const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
