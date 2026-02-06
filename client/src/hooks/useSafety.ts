import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

// API helper using centralized auth-aware fetch
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await apiFetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ============================================================
// TYPES
// ============================================================

export type IncidentType = 'injury' | 'near_miss' | 'property_damage' | 'environmental';
export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical';
export type IncidentStatus = 'open' | 'investigating' | 'closed';
export type MeetingType = 'daily_huddle' | 'weekly' | 'monthly' | 'toolbox_talk';

export interface SafetyIncident {
  id: string;
  builder_id: string | null;
  job_id: string | null;
  incident_date: string;
  incident_time: string | null;
  location: string | null;
  description: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  injured_person_name: string | null;
  injured_person_role: string | null;
  witness_names: string[];
  immediate_actions: string | null;
  root_cause: string | null;
  corrective_actions: string | null;
  reported_to_osha: boolean;
  osha_case_number: string | null;
  days_away: number;
  days_restricted: number;
  status: IncidentStatus;
  reported_by: string;
  closed_at: string | null;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string; address: string };
  attachments?: SafetyIncidentAttachment[];
  activity?: SafetyIncidentActivity[];
}

export interface SafetyIncidentAttachment {
  id: string;
  incident_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  description: string | null;
  category: string;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface SafetyIncidentActivity {
  id: string;
  incident_id: string;
  action: string;
  performed_by: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface SafetyMeeting {
  id: string;
  builder_id: string | null;
  job_id: string | null;
  meeting_date: string;
  meeting_type: MeetingType;
  topic: string | null;
  template_id: string | null;
  attendees: MeetingAttendee[];
  sign_in_sheet_url: string | null;
  notes: string | null;
  hazards_discussed: string[];
  action_items: string[];
  conducted_by: string;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
  job?: { id: string; name: string; address: string };
  template?: ToolboxTalkTemplate;
  attendee_count?: number;
}

export interface MeetingAttendee {
  name: string;
  role?: string;
  signed?: boolean;
}

export interface ToolboxTalkTemplate {
  id: string;
  builder_id: string | null;
  title: string;
  category: string | null;
  content: string | null;
  duration_minutes: number;
  required_ppe: string[];
  hazards_covered: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface SafetyStats {
  year: number;
  incidents: {
    total: number;
    by_type: Record<IncidentType, number>;
    by_severity: Record<IncidentSeverity, number>;
    by_status: Record<IncidentStatus, number>;
    osha_recordable: number;
    total_days_away: number;
    total_days_restricted: number;
  };
  meetings: {
    total: number;
    by_type: Record<MeetingType, number>;
    total_attendees: number;
    average_attendance: number;
  };
  osha: {
    recordable_incidents: number;
    days_away_restricted_transfer: number;
    dart_rate: number;
  };
}

export interface OshaLog300Entry {
  case_number: string;
  employee_name: string;
  job_title: string;
  date_of_injury: string;
  where_event_occurred: string;
  description: string;
  classify: {
    death: boolean;
    days_away: boolean;
    job_transfer_restriction: boolean;
    other_recordable: boolean;
  };
  days_away_from_work: number;
  days_on_restriction: number;
  injury_type: string;
}

export interface OshaLog300 {
  year: number;
  establishment_name: string;
  entries: OshaLog300Entry[];
  summary: {
    total_cases: number;
    deaths: number;
    days_away_cases: number;
    restriction_cases: number;
    other_recordable: number;
    total_days_away: number;
    total_days_restricted: number;
  };
}

// ============================================================
// INCIDENT QUERIES
// ============================================================

export function useSafetyIncidents(filters?: {
  job_id?: string;
  builder_id?: string;
  incident_type?: IncidentType;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  from_date?: string;
  to_date?: string;
  osha_only?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['safety-incidents', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.builder_id) params.set('builder_id', filters.builder_id);
      if (filters?.incident_type) params.set('incident_type', filters.incident_type);
      if (filters?.severity) params.set('severity', filters.severity);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.from_date) params.set('from_date', filters.from_date);
      if (filters?.to_date) params.set('to_date', filters.to_date);
      if (filters?.osha_only) params.set('osha_only', 'true');
      if (filters?.search) params.set('search', filters.search);
      const queryString = params.toString();
      const endpoint = queryString ? `/safety/incidents?${queryString}` : '/safety/incidents';
      return api<SafetyIncident[]>(endpoint);
    },
  });
}

export function useSafetyIncident(id: string | null) {
  return useQuery({
    queryKey: ['safety-incident', id],
    queryFn: async () => {
      if (!id) return null;
      return api<SafetyIncident>(`/safety/incidents/${id}`);
    },
    enabled: !!id,
  });
}

// ============================================================
// MEETING QUERIES
// ============================================================

export function useSafetyMeetings(filters?: {
  job_id?: string;
  builder_id?: string;
  meeting_type?: MeetingType;
  from_date?: string;
  to_date?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['safety-meetings', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.builder_id) params.set('builder_id', filters.builder_id);
      if (filters?.meeting_type) params.set('meeting_type', filters.meeting_type);
      if (filters?.from_date) params.set('from_date', filters.from_date);
      if (filters?.to_date) params.set('to_date', filters.to_date);
      if (filters?.search) params.set('search', filters.search);
      const queryString = params.toString();
      const endpoint = queryString ? `/safety/meetings?${queryString}` : '/safety/meetings';
      return api<SafetyMeeting[]>(endpoint);
    },
  });
}

export function useSafetyMeeting(id: string | null) {
  return useQuery({
    queryKey: ['safety-meeting', id],
    queryFn: async () => {
      if (!id) return null;
      return api<SafetyMeeting>(`/safety/meetings/${id}`);
    },
    enabled: !!id,
  });
}

// ============================================================
// TEMPLATE QUERIES
// ============================================================

export function useToolboxTemplates(filters?: {
  builder_id?: string;
  category?: string;
  is_default?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: ['toolbox-templates', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.builder_id) params.set('builder_id', filters.builder_id);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.is_default) params.set('is_default', 'true');
      if (filters?.search) params.set('search', filters.search);
      const queryString = params.toString();
      const endpoint = queryString ? `/safety/templates?${queryString}` : '/safety/templates';
      return api<ToolboxTalkTemplate[]>(endpoint);
    },
  });
}

export function useToolboxTemplate(id: string | null) {
  return useQuery({
    queryKey: ['toolbox-template', id],
    queryFn: async () => {
      if (!id) return null;
      return api<ToolboxTalkTemplate>(`/safety/templates/${id}`);
    },
    enabled: !!id,
  });
}

export function useTemplateCategories() {
  return useQuery({
    queryKey: ['template-categories'],
    queryFn: () => api<string[]>('/safety/template-categories'),
    staleTime: Infinity,
  });
}

// ============================================================
// STATS & OSHA LOG QUERIES
// ============================================================

export function useSafetyStats(filters?: {
  job_id?: string;
  builder_id?: string;
  year?: number;
}) {
  return useQuery({
    queryKey: ['safety-stats', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.builder_id) params.set('builder_id', filters.builder_id);
      if (filters?.year) params.set('year', String(filters.year));
      const queryString = params.toString();
      const endpoint = queryString ? `/safety/stats?${queryString}` : '/safety/stats';
      return api<SafetyStats>(endpoint);
    },
  });
}

export function useOshaLog300(filters?: {
  year?: number;
  job_id?: string;
  builder_id?: string;
}) {
  return useQuery({
    queryKey: ['osha-log-300', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.year) params.set('year', String(filters.year));
      if (filters?.job_id) params.set('job_id', filters.job_id);
      if (filters?.builder_id) params.set('builder_id', filters.builder_id);
      const queryString = params.toString();
      const endpoint = queryString ? `/safety/osha-log?${queryString}` : '/safety/osha-log';
      return api<OshaLog300>(endpoint);
    },
  });
}

// ============================================================
// REFERENCE DATA
// ============================================================

export function useIncidentTypes() {
  return useQuery({
    queryKey: ['incident-types'],
    queryFn: () => api<string[]>('/safety/incident-types'),
    staleTime: Infinity,
  });
}

export function useSeverityLevels() {
  return useQuery({
    queryKey: ['severity-levels'],
    queryFn: () => api<string[]>('/safety/severity-levels'),
    staleTime: Infinity,
  });
}

export function useMeetingTypes() {
  return useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => api<string[]>('/safety/meeting-types'),
    staleTime: Infinity,
  });
}

// ============================================================
// INCIDENT MUTATIONS
// ============================================================

export interface CreateIncidentData {
  builder_id?: string;
  job_id?: string;
  incident_date: string;
  incident_time?: string;
  location?: string;
  description: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  injured_person_name?: string;
  injured_person_role?: string;
  witness_names?: string[];
  immediate_actions?: string;
  reported_by: string;
}

export function useCreateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateIncidentData) =>
      api<SafetyIncident>('/safety/incidents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success('Incident reported');
    },
    onError: (error: Error) => {
      toast.error(`Failed to report incident: ${error.message}`);
    },
  });
}

export interface UpdateIncidentData {
  description?: string;
  incident_type?: IncidentType;
  severity?: IncidentSeverity;
  location?: string;
  injured_person_name?: string;
  injured_person_role?: string;
  witness_names?: string[];
  immediate_actions?: string;
  root_cause?: string;
  corrective_actions?: string;
  updated_by?: string;
}

export function useUpdateIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateIncidentData & { id: string }) =>
      api<SafetyIncident>(`/safety/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['safety-incident', data.id] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success('Incident updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update incident: ${error.message}`);
    },
  });
}

export function useDeleteIncident() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/safety/incidents/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success('Incident deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete incident: ${error.message}`);
    },
  });
}

export function useChangeIncidentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, performed_by, notes }: {
      id: string;
      status: IncidentStatus;
      performed_by?: string;
      notes?: string;
    }) =>
      api<SafetyIncident>(`/safety/incidents/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, performed_by, notes }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['safety-incident', data.id] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success(`Incident status changed to ${data.status}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to change status: ${error.message}`);
    },
  });
}

export function useReportToOsha() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, osha_case_number, days_away, days_restricted, performed_by }: {
      id: string;
      osha_case_number?: string;
      days_away?: number;
      days_restricted?: number;
      performed_by?: string;
    }) =>
      api<SafetyIncident>(`/safety/incidents/${id}/osha-report`, {
        method: 'POST',
        body: JSON.stringify({ osha_case_number, days_away, days_restricted, performed_by }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['safety-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['safety-incident', data.id] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      queryClient.invalidateQueries({ queryKey: ['osha-log-300'] });
      toast.success('Incident reported to OSHA');
    },
    onError: (error: Error) => {
      toast.error(`Failed to report to OSHA: ${error.message}`);
    },
  });
}

// ============================================================
// MEETING MUTATIONS
// ============================================================

export interface CreateMeetingData {
  builder_id?: string;
  job_id?: string;
  meeting_date: string;
  meeting_type: MeetingType;
  topic?: string;
  template_id?: string;
  attendees?: MeetingAttendee[];
  notes?: string;
  hazards_discussed?: string[];
  action_items?: string[];
  conducted_by: string;
  duration_minutes?: number;
}

export function useCreateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateMeetingData) =>
      api<SafetyMeeting>('/safety/meetings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success('Safety meeting recorded');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create meeting: ${error.message}`);
    },
  });
}

export interface UpdateMeetingData {
  meeting_type?: MeetingType;
  topic?: string;
  template_id?: string;
  attendees?: MeetingAttendee[];
  notes?: string;
  hazards_discussed?: string[];
  action_items?: string[];
  duration_minutes?: number;
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateMeetingData & { id: string }) =>
      api<SafetyMeeting>(`/safety/meetings/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['safety-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['safety-meeting', data.id] });
      toast.success('Meeting updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update meeting: ${error.message}`);
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/safety/meetings/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['safety-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['safety-stats'] });
      toast.success('Meeting deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete meeting: ${error.message}`);
    },
  });
}

// ============================================================
// TEMPLATE MUTATIONS
// ============================================================

export interface CreateTemplateData {
  builder_id?: string;
  title: string;
  category?: string;
  content?: string;
  duration_minutes?: number;
  required_ppe?: string[];
  hazards_covered?: string[];
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateData) =>
      api<ToolboxTalkTemplate>('/safety/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toolbox-templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      toast.success('Template created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });
}

export interface UpdateTemplateData {
  title?: string;
  category?: string;
  content?: string;
  duration_minutes?: number;
  required_ppe?: string[];
  hazards_covered?: string[];
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateTemplateData & { id: string }) =>
      api<ToolboxTalkTemplate>(`/safety/templates/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['toolbox-templates'] });
      queryClient.invalidateQueries({ queryKey: ['toolbox-template', data.id] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      toast.success('Template updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api(`/safety/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['toolbox-templates'] });
      queryClient.invalidateQueries({ queryKey: ['template-categories'] });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// ============================================================
// HELPERS
// ============================================================

export const incidentTypeConfig: Record<IncidentType, { label: string; color: string; bgColor: string }> = {
  injury: { label: 'Injury', color: 'text-red-600', bgColor: 'bg-red-100' },
  near_miss: { label: 'Near Miss', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  property_damage: { label: 'Property Damage', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  environmental: { label: 'Environmental', color: 'text-blue-600', bgColor: 'bg-blue-100' },
};

export const incidentSeverityConfig: Record<IncidentSeverity, { label: string; color: string; bgColor: string }> = {
  minor: { label: 'Minor', color: 'text-green-600', bgColor: 'bg-green-100' },
  moderate: { label: 'Moderate', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  serious: { label: 'Serious', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
};

export const incidentStatusConfig: Record<IncidentStatus, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: 'text-red-600', bgColor: 'bg-red-100' },
  investigating: { label: 'Investigating', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  closed: { label: 'Closed', color: 'text-green-600', bgColor: 'bg-green-100' },
};

export const meetingTypeConfig: Record<MeetingType, { label: string; color: string; bgColor: string }> = {
  daily_huddle: { label: 'Daily Huddle', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  weekly: { label: 'Weekly Meeting', color: 'text-purple-600', bgColor: 'bg-purple-100' },
  monthly: { label: 'Monthly Meeting', color: 'text-indigo-600', bgColor: 'bg-indigo-100' },
  toolbox_talk: { label: 'Toolbox Talk', color: 'text-green-600', bgColor: 'bg-green-100' },
};
