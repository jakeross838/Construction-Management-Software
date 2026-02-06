import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiGet, apiPost, apiPatch, apiDelete, apiFetch } from '@/lib/api';

// Authenticated API helper using @/lib/api
async function api<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const method = options?.method?.toUpperCase() || 'GET';
  let response: Response;

  if (method === 'GET') {
    response = await apiGet(`/api${endpoint}`);
  } else if (method === 'POST') {
    const body = options?.body ? JSON.parse(options.body as string) : undefined;
    response = await apiPost(`/api${endpoint}`, body);
  } else if (method === 'PATCH') {
    const body = options?.body ? JSON.parse(options.body as string) : undefined;
    response = await apiPatch(`/api${endpoint}`, body);
  } else if (method === 'DELETE') {
    const body = options?.body ? JSON.parse(options.body as string) : undefined;
    if (body) {
      // apiDelete doesn't support body, use apiFetch
      response = await apiFetch(`/api${endpoint}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      response = await apiDelete(`/api${endpoint}`);
    }
  } else {
    response = await apiFetch(`/api${endpoint}`, options);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

export type WeatherCondition = 'sunny' | 'partly_cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'windy' | 'snow';
export type LogStatus = 'draft' | 'completed';
export type InspectionResult = 'scheduled' | 'passed' | 'failed' | 'partial';
export type PhotoCategory = 'progress' | 'delivery' | 'safety' | 'inspection' | 'other';
export type PlanCompleted = 'yes' | 'partial' | 'no';

export const constructionPhases = [
  { value: 'pre-construction', label: 'Pre-Construction' },
  { value: 'site-work', label: 'Site Work' },
  { value: 'foundation', label: 'Foundation' },
  { value: 'framing', label: 'Framing' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'mep-rough', label: 'MEP Rough-In' },
  { value: 'insulation', label: 'Insulation' },
  { value: 'drywall', label: 'Drywall' },
  { value: 'interior-trim', label: 'Interior Trim' },
  { value: 'paint', label: 'Paint' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'cabinetry', label: 'Cabinetry' },
  { value: 'mep-finish', label: 'MEP Finish' },
  { value: 'exterior-finish', label: 'Exterior Finish' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'punch-list', label: 'Punch List' },
  { value: 'final-inspection', label: 'Final Inspection' },
];

export const weatherOptions: { value: WeatherCondition; label: string; icon: string }[] = [
  { value: 'sunny', label: 'Sunny', icon: '☀️' },
  { value: 'partly_cloudy', label: 'Partly Cloudy', icon: '⛅' },
  { value: 'cloudy', label: 'Cloudy', icon: '☁️' },
  { value: 'rainy', label: 'Rainy', icon: '🌧️' },
  { value: 'stormy', label: 'Stormy', icon: '⛈️' },
  { value: 'windy', label: 'Windy', icon: '💨' },
  { value: 'snow', label: 'Snow', icon: '❄️' },
];

export const inspectionTypes = [
  'Foundation',
  'Framing',
  'Electrical Rough',
  'Plumbing Rough',
  'HVAC Rough',
  'Insulation',
  'Drywall',
  'Electrical Final',
  'Plumbing Final',
  'HVAC Final',
  'Fire',
  'Final / CO',
];

export const tradeOptions = [
  'General Labor',
  'Framing',
  'Roofing',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Drywall',
  'Painting',
  'Flooring',
  'Tile',
  'Cabinetry',
  'Trim',
  'Concrete',
  'Masonry',
  'Landscaping',
  'Cleaning',
];

export interface DailyLog {
  id: string;
  job_id: string;
  log_date: string;
  status: LogStatus;
  weather_conditions: WeatherCondition | null;
  temperature_high: number | null;
  temperature_low: number | null;
  weather_notes: string | null;
  construction_phase: string | null;
  plan_completed: PlanCompleted | null;
  plan_variance_notes: string | null;
  work_completed: string | null;
  work_planned: string | null;
  delays_issues: string | null;
  site_visitors: string | null;
  safety_notes: string | null;
  dumpster_exchange: boolean;
  absent_crews: AbsentCrew[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  // Joined data
  jobs?: { name: string; address: string | null };
  crew?: DailyLogCrew[];
  deliveries?: DailyLogDelivery[];
  inspections?: DailyLogInspection[];
  attachments?: DailyLogAttachment[];
}

export type AbsentReason = 'called_ahead' | 'no_call_no_show' | 'weather' | 'scheduling_conflict' | 'equipment_issue' | 'personal' | 'other';

export const absentReasonOptions: { value: AbsentReason; label: string }[] = [
  { value: 'called_ahead', label: 'Called Ahead' },
  { value: 'no_call_no_show', label: 'No Call / No Show' },
  { value: 'weather', label: 'Weather Related' },
  { value: 'scheduling_conflict', label: 'Scheduling Conflict' },
  { value: 'equipment_issue', label: 'Equipment Issue' },
  { value: 'personal', label: 'Personal Reasons' },
  { value: 'other', label: 'Other' },
];

export interface AbsentCrew {
  vendor_id: string;
  reason: AbsentReason;
  notes?: string;
}

export interface DailyLogCrew {
  id: string;
  daily_log_id: string;
  vendor_id: string | null;
  worker_count: number;
  hours_worked: number | null;
  trade: string | null;
  work_area: string | null;
  completion_percent: number | null;
  po_id: string | null;
  schedule_task_id: string | null;
  notes: string | null;
  created_at: string;
  vendors?: { name: string } | null;
  // Scope tracking fields
  scope_category_id: string | null;
  quantity_completed: number | null;
  work_quality: 'poor' | 'acceptable' | 'good' | 'excellent' | null;
  ready_for_next_trade: boolean;
}

export interface DailyLogDelivery {
  id: string;
  daily_log_id: string;
  vendor_id: string | null;
  po_id: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  vendors?: { name: string } | null;
}

export interface DailyLogInspection {
  id: string;
  daily_log_id: string;
  inspection_type: string;
  result: InspectionResult;
  inspector: string | null;
  notes: string | null;
  created_at: string;
}

export interface DailyLogAttachment {
  id: string;
  daily_log_id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  caption: string | null;
  category: PhotoCategory;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface DailyLogInsert {
  job_id: string;
  log_date: string;
  status?: LogStatus;
  weather_conditions?: WeatherCondition | null;
  temperature_high?: number | null;
  temperature_low?: number | null;
  weather_notes?: string | null;
  construction_phase?: string | null;
  plan_completed?: PlanCompleted | null;
  plan_variance_notes?: string | null;
  work_completed?: string | null;
  work_planned?: string | null;
  delays_issues?: string | null;
  site_visitors?: string | null;
  safety_notes?: string | null;
  dumpster_exchange?: boolean;
  absent_crews?: AbsentCrew[];
  created_by?: string | null;
}

export interface DailyLogUpdate extends Partial<DailyLogInsert> {
  id: string;
  completed_at?: string | null;
}

// Fetch all daily logs with optional filters
export function useDailyLogs(jobId?: string | null, status?: LogStatus | null) {
  return useQuery({
    queryKey: ['daily-logs', jobId, status],
    queryFn: async (): Promise<DailyLog[]> => {
      let endpoint = '/daily-logs?';
      if (jobId) endpoint += `job_id=${jobId}&`;
      if (status) endpoint += `status=${status}&`;
      const data = await api<DailyLog[]>(endpoint);
      return (data || []).map(log => ({
        ...log,
        absent_crews: Array.isArray(log.absent_crews) ? log.absent_crews as unknown as AbsentCrew[] : [],
      }));
    },
  });
}

// Fetch single daily log
export function useDailyLog(id: string | null) {
  return useQuery({
    queryKey: ['daily-log', id],
    queryFn: async (): Promise<DailyLog | null> => {
      if (!id) return null;
      const data = await api<DailyLog>(`/daily-logs/${id}`);
      return {
        ...data,
        absent_crews: Array.isArray(data.absent_crews) ? data.absent_crews as unknown as AbsentCrew[] : [],
      };
    },
    enabled: !!id,
  });
}

// Create daily log
export function useCreateDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DailyLogInsert & {
      crew?: Array<{
        id?: string;
        vendor_id?: string | null;
        worker_count?: number;
        hours_worked?: number | null;
        trade?: string | null;
        work_area?: string | null;
        completion_percent?: number | null;
        po_id?: string | null;
        schedule_task_id?: string | null;
        notes?: string | null;
      }>;
      deliveries?: Array<{
        id?: string;
        vendor_id?: string | null;
        po_id?: string | null;
        description: string;
        quantity?: number | null;
        unit?: string | null;
        received_by?: string | null;
        notes?: string | null;
      }>;
      inspections?: Array<{
        id?: string;
        inspection_type: string;
        result?: InspectionResult;
        inspector?: string | null;
        notes?: string | null;
      }>;
    }) => {
      return api<DailyLog>('/daily-logs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log-stats'] });
      toast.success('Daily log created');
    },
    onError: (error: Error) => {
      console.error('Failed to create daily log:', error);
      if (error.message.includes('already exists')) {
        toast.error('A log already exists for this job on this date');
      } else {
        toast.error('Failed to create daily log');
      }
    },
  });
}

// Update daily log
export function useUpdateDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: DailyLogUpdate & {
      crew?: Array<{
        id?: string;
        vendor_id?: string | null;
        worker_count?: number;
        hours_worked?: number | null;
        trade?: string | null;
        work_area?: string | null;
        completion_percent?: number | null;
        po_id?: string | null;
        schedule_task_id?: string | null;
        notes?: string | null;
      }>;
      deliveries?: Array<{
        id?: string;
        vendor_id?: string | null;
        po_id?: string | null;
        description: string;
        quantity?: number | null;
        unit?: string | null;
        received_by?: string | null;
        notes?: string | null;
      }>;
      inspections?: Array<{
        id?: string;
        inspection_type: string;
        result?: InspectionResult;
        inspector?: string | null;
        notes?: string | null;
      }>;
    }) => {
      const { id, ...updateData } = data;
      return api<DailyLog>(`/daily-logs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['daily-log-stats'] });
      toast.success('Daily log updated');
    },
    onError: (error: Error) => {
      console.error('Failed to update daily log:', error);
      toast.error('Failed to update daily log');
    },
  });
}

// Complete daily log
export function useCompleteDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api<DailyLog>(`/daily-logs/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completed_by: 'User' }),
      });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', id] });
      queryClient.invalidateQueries({ queryKey: ['daily-log-stats'] });
      toast.success('Daily log marked as complete');
    },
    onError: (error: Error) => {
      console.error('Failed to complete daily log:', error);
      toast.error('Failed to complete daily log');
    },
  });
}

// Reopen daily log
export function useReopenDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api<DailyLog>(`/daily-logs/${id}/reopen`, {
        method: 'POST',
        body: JSON.stringify({ reopened_by: 'User' }),
      });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', id] });
      queryClient.invalidateQueries({ queryKey: ['daily-log-stats'] });
      toast.success('Daily log reopened for editing');
    },
    onError: (error: Error) => {
      console.error('Failed to reopen daily log:', error);
      toast.error('Failed to reopen daily log');
    },
  });
}

// Soft delete daily log
export function useDeleteDailyLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/daily-logs/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: 'User' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log-stats'] });
      toast.success('Daily log deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete daily log:', error);
      toast.error('Failed to delete daily log');
    },
  });
}

// Upload photo to daily log
export function useUploadDailyLogPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      logId,
      file,
      category,
      caption
    }: {
      logId: string;
      file: File;
      category: PhotoCategory;
      caption?: string;
    }) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('category', category);
      if (caption) formData.append('caption', caption);
      formData.append('uploaded_by', 'User');

      const response = await apiFetch(`/api/daily-logs/${logId}/photos`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || error.message || `HTTP ${response.status}`);
      }

      return response.json();
    },
    onSuccess: (_, { logId }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', logId] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error: Error) => {
      console.error('Failed to upload photo:', error);
      toast.error('Failed to upload photo');
    },
  });
}

// Delete photo from daily log
export function useDeleteDailyLogPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, logId }: { id: string; logId: string }) => {
      return api(`/daily-logs/${logId}/photos/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by: 'User' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      toast.success('Photo deleted');
    },
    onError: (error: Error) => {
      console.error('Failed to delete photo:', error);
      toast.error('Failed to delete photo');
    },
  });
}

// Get daily log stats
export function useDailyLogStats(jobId?: string | null) {
  return useQuery({
    queryKey: ['daily-log-stats', jobId],
    queryFn: async () => {
      let endpoint = '/daily-logs/stats/summary';
      if (jobId) {
        endpoint += `?job_id=${jobId}`;
      }
      const data = await api<{
        total: number;
        draft: number;
        completed: number;
        last_30_days: number;
        this_week: number;
      }>(endpoint);

      return {
        total: data.total,
        draft: data.draft,
        completed: data.completed,
        last30Days: data.last_30_days,
        thisWeek: data.this_week,
      };
    },
  });
}
