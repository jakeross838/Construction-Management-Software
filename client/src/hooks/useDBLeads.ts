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
  lead_number: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  project_type: string | null;
  project_address: string | null;
  project_description: string | null;
  budget_range: string | null;
  estimated_value: number | null;
  square_footage: number | null;
  has_lot: boolean | null;
  timeline: string | null;
  stage: LeadStage;
  stage_entered_at: string | null;
  outcome: string | null;
  assigned_to: string | null;
  notes: string | null;
  next_follow_up: string | null;
  qualification_score: number | null;
  score_breakdown: Record<string, number> | null;
  source: { id: string; name: string; category: string } | null;
  job: { id: string; name: string } | null;
  task_counts: { pending: number; completed: number } | null;
  // Location
  lot_lat: number | null;
  lot_lng: number | null;
  lot_city: string | null;
  lot_state: string | null;
  lot_zip: string | null;
  // Preconstruction Agreement
  precon_agreement_signed: boolean;
  precon_agreement_date: string | null;
  precon_agreement_amount: number | null;
  precon_agreement_document_id: string | null;
  precon_agreement_notes: string | null;
  // Lost tracking
  lost_reason: string | null;
  lost_competitor: string | null;
  lost_at: string | null;
  revived_at: string | null;
  revival_notes: string | null;
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
      // Parse name into first and last name
      const fullName = lead.name || lead.client_name || 'Untitled Lead';
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'Lead';

      return api<Lead>('/leads', {
        method: 'POST',
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          email: lead.client_email || null,
          phone: lead.client_phone || null,
          project_address: lead.address || null,
          project_description: lead.description || null,
          estimated_value: lead.estimated_value || 0,
          square_footage: lead.square_footage || null,
          lead_source_id: null, // TODO: Map source string to source ID
          stage: lead.stage || 'new_inquiry',
          assigned_to: lead.assigned_to || null,
          notes: lead.notes || null,
          next_follow_up: lead.next_follow_up || null,
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

// ============================================================
// PIPELINE STAGES
// ============================================================

export interface PipelineStage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  stage_order: number;
  is_active: boolean;
  is_won_stage: boolean;
  is_lost_stage: boolean;
  required_fields: string[];
  auto_actions: Record<string, any>;
  created_at: string;
}

export function usePipelineStages() {
  return useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: () => api<PipelineStage[]>('/leads/stages'),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes - stages don't change often
  });
}

// ============================================================
// LEAD CONTACTS (Multiple people per lead)
// ============================================================

export interface LeadContact {
  id: string;
  lead_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role: 'owner' | 'spouse' | 'representative' | 'other';
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

export type LeadContactInsert = Omit<LeadContact, 'id' | 'lead_id' | 'created_at'>;

export function useLeadContacts(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-contacts', leadId],
    queryFn: () => api<LeadContact[]>(`/leads/${leadId}/contacts`),
    enabled: !!leadId,
  });
}

export function useAddLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, contact }: { leadId: string; contact: LeadContactInsert }) => {
      return api<LeadContact>(`/leads/${leadId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(contact),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Contact added');
    },
    onError: (error: Error) => {
      console.error('Failed to add contact:', error);
      toast.error('Failed to add contact');
    },
  });
}

export function useUpdateLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, contactId, updates }: { leadId: string; contactId: string; updates: Partial<LeadContactInsert> }) => {
      return api<LeadContact>(`/leads/${leadId}/contacts/${contactId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Contact updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update contact:', error);
      toast.error('Failed to update contact');
    },
  });
}

export function useDeleteLeadContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, contactId }: { leadId: string; contactId: string }) => {
      return api(`/leads/${leadId}/contacts/${contactId}`, { method: 'DELETE' });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-contacts', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Contact removed');
    },
    onError: (error: Error) => {
      console.error('Failed to remove contact:', error);
      toast.error('Failed to remove contact');
    },
  });
}

// ============================================================
// LEAD SCORING
// ============================================================

export interface LeadScoreBreakdown {
  budget: number;
  land: number;
  source: number;
  timeline: number;
  readiness: number;
}

export interface LeadScoreResult {
  id: string;
  score: number;
  score_breakdown: LeadScoreBreakdown;
}

export function useScoreLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (leadId: string) => {
      return api<LeadScoreResult>(`/leads/${leadId}/score`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead scored');
    },
    onError: (error: Error) => {
      console.error('Failed to score lead:', error);
      toast.error('Failed to score lead');
    },
  });
}

// ============================================================
// LOST LEAD REASONS
// ============================================================

export interface LostLeadReason {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export function useLostLeadReasons() {
  return useQuery({
    queryKey: ['lost-lead-reasons'],
    queryFn: () => api<LostLeadReason[]>('/leads/lost-reasons'),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// MARK LEAD AS LOST
// ============================================================

export interface MarkAsLostParams {
  leadId: string;
  lost_reason?: string;
  lost_competitor?: string;
  notes?: string;
}

export function useMarkLeadAsLost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, lost_reason, lost_competitor, notes }: MarkAsLostParams) => {
      return api<Lead>(`/leads/${leadId}/lost`, {
        method: 'POST',
        body: JSON.stringify({ lost_reason, lost_competitor, notes }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lost-lead-analytics'] });
      toast.success('Lead marked as lost');
    },
    onError: (error: Error) => {
      console.error('Failed to mark lead as lost:', error);
      toast.error('Failed to mark lead as lost');
    },
  });
}

// ============================================================
// REVIVE LOST LEAD
// ============================================================

export interface ReviveLeadParams {
  leadId: string;
  notes?: string;
  target_stage?: string;
}

export function useReviveLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, notes, target_stage }: ReviveLeadParams) => {
      return api<Lead>(`/leads/${leadId}/revive`, {
        method: 'POST',
        body: JSON.stringify({ notes, target_stage }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lost-lead-analytics'] });
      toast.success('Lead revived and returned to pipeline');
    },
    onError: (error: Error) => {
      console.error('Failed to revive lead:', error);
      toast.error('Failed to revive lead');
    },
  });
}

// ============================================================
// LOST LEAD ANALYTICS
// ============================================================

export interface LostLeadAnalytics {
  total_lost: number;
  total_lost_value: number;
  by_reason: Array<{
    reason: string;
    count: number;
    value: number;
    percentage: number;
  }>;
  by_competitor: Array<{
    competitor: string;
    count: number;
    value: number;
  }>;
}

export function useLostLeadAnalytics() {
  return useQuery({
    queryKey: ['lost-lead-analytics'],
    queryFn: () => api<LostLeadAnalytics>('/leads/lost-analytics'),
    staleTime: 60 * 1000, // 1 minute
  });
}

// ============================================================
// LEAD SOURCES
// ============================================================

export interface LeadSource {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export function useLeadSources() {
  return useQuery({
    queryKey: ['lead-sources'],
    queryFn: () => api<LeadSource[]>('/leads/sources'),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// LEAD ACTIVITIES
// ============================================================

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: 'call' | 'email' | 'meeting' | 'site_visit' | 'note' | 'status_change';
  direction?: 'inbound' | 'outbound';
  subject?: string;
  description?: string;
  outcome?: string;
  duration_minutes?: number;
  performed_by?: string;
  performed_at: string;
  created_at: string;
}

export type LeadActivityInsert = Omit<LeadActivity, 'id' | 'lead_id' | 'created_at'>;

export function useLeadActivities(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-activities', leadId],
    queryFn: () => api<LeadActivity[]>(`/leads/${leadId}/activities`),
    enabled: !!leadId,
  });
}

export function useAddLeadActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, activity }: { leadId: string; activity: LeadActivityInsert }) => {
      return api<LeadActivity>(`/leads/${leadId}/activities`, {
        method: 'POST',
        body: JSON.stringify(activity),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Activity logged');
    },
    onError: (error: Error) => {
      console.error('Failed to log activity:', error);
      toast.error('Failed to log activity');
    },
  });
}

// ============================================================
// LEAD TASKS (Follow-ups)
// ============================================================

export interface LeadTask {
  id: string;
  lead_id: string;
  task_type: 'follow_up' | 'site_visit' | 'send_info' | 'meeting' | 'other';
  title: string;
  description?: string;
  due_date: string;
  due_time?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'completed' | 'cancelled';
  assigned_to?: string;
  completed_at?: string;
  created_at: string;
}

export type LeadTaskInsert = Omit<LeadTask, 'id' | 'lead_id' | 'created_at' | 'completed_at'>;

export function useLeadTasks(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-tasks', leadId],
    queryFn: () => api<LeadTask[]>(`/leads/${leadId}/tasks`),
    enabled: !!leadId,
  });
}

export function useAddLeadTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, task }: { leadId: string; task: LeadTaskInsert }) => {
      return api<LeadTask>(`/leads/${leadId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] });
      toast.success('Task created');
    },
    onError: (error: Error) => {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    },
  });
}

export function useCompleteLeadTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, taskId }: { leadId: string; taskId: string }) => {
      return api<LeadTask>(`/leads/${leadId}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-tasks', leadId] });
      toast.success('Task completed');
    },
    onError: (error: Error) => {
      console.error('Failed to complete task:', error);
      toast.error('Failed to complete task');
    },
  });
}

// ============================================================
// LEAD DOCUMENTS
// ============================================================

export interface LeadDocument {
  id: string;
  lead_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  category?: string;
  uploaded_by?: string;
  created_at: string;
}

export function useLeadDocuments(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-documents', leadId],
    queryFn: () => api<LeadDocument[]>(`/leads/${leadId}/documents`),
    enabled: !!leadId,
  });
}

export function useUploadLeadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, file, category }: { leadId: string; file: File; category?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (category) formData.append('category', category);
      formData.append('uploaded_by', 'Jake Ross'); // TODO: Get from auth context

      const response = await fetch(`/api/leads/${leadId}/documents`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return response.json() as Promise<LeadDocument>;
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-documents', leadId] });
      toast.success('Document uploaded');
    },
    onError: (error: Error) => {
      console.error('Failed to upload document:', error);
      toast.error('Failed to upload document');
    },
  });
}

export function useDeleteLeadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, documentId }: { leadId: string; documentId: string }) => {
      return api(`/leads/${leadId}/documents/${documentId}`, { method: 'DELETE' });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-documents', leadId] });
      toast.success('Document deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete document:', error);
      toast.error('Failed to delete document');
    },
  });
}

// ============================================================
// LEAD ESTIMATES
// ============================================================

export interface LeadEstimate {
  id: string;
  lead_id: string;
  estimate_number: string | null;
  title: string | null;
  total_amount: number | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'converted';
  version: number;
  created_at: string;
  updated_at: string;
}

export function useLeadEstimates(leadId: string | null) {
  return useQuery({
    queryKey: ['lead-estimates', leadId],
    queryFn: () => api<LeadEstimate[]>(`/leads/${leadId}/estimates`),
    enabled: !!leadId,
  });
}

export function useCreateEstimateFromLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, title }: { leadId: string; title?: string }) => {
      return api<LeadEstimate>(`/leads/${leadId}/estimates`, {
        method: 'POST',
        body: JSON.stringify({ title }),
      });
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead-estimates', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Estimate created from lead');
    },
    onError: (error: Error) => {
      console.error('Failed to create estimate:', error);
      toast.error('Failed to create estimate');
    },
  });
}

// ============================================================
// LEAD TO JOB CONVERSION
// ============================================================

export interface ConvertedJob {
  id: string;
  name: string;
  address: string | null;
  client_name: string | null;
  contract_amount: number | null;
  status: string;
}

export function useConvertLeadToJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, contractAmount }: { leadId: string; contractAmount?: number }) => {
      return api<{ success: boolean; job: ConvertedJob; message: string }>(`/leads/${leadId}/convert-to-job`, {
        method: 'POST',
        body: JSON.stringify({ contract_amount: contractAmount }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success(data.message || 'Lead converted to job');
    },
    onError: (error: Error) => {
      console.error('Failed to convert lead to job:', error);
      toast.error(error.message || 'Failed to convert lead to job');
    },
  });
}
