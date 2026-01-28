import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LeadStage } from '@/types/job';

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
    queryFn: () => api<Lead[]>('/leads'),
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lead: Partial<LeadInsert>) => {
      return api<Lead>('/leads', {
        method: 'POST',
        body: JSON.stringify({
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
        }),
      });
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
      return api<Lead>(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
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
      return api(`/leads/${id}`, { method: 'DELETE' });
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
      return api<Lead>(`/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage, days_in_stage: 0 }),
      });
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
