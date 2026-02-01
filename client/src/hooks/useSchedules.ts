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

export type ScheduleStatus = 'draft' | 'active' | 'complete' | 'on_hold';

export interface Schedule {
  id: string;
  job_id: string;
  name: string;
  status: ScheduleStatus;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  work_days: string[];
  holidays: string[];
  template_id: string | null;
  critical_path_days: number | null;
  buffer_days: number;
  on_schedule: boolean;
  baseline_set_at: string | null;
  baseline_set_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  job?: { id: string; name: string; address: string };
  // Computed
  task_count?: number;
  completed_tasks?: number;
  overall_progress?: number;
}

export interface ScheduleTask {
  id: string;
  schedule_id: string;
  name: string;
  description: string | null;
  phase: string | null;
  trade_id: string | null;
  cost_code_id: string | null;
  estimated_days: number;
  actual_days: number | null;
  planned_start: string | null;
  planned_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  status: 'not_started' | 'in_progress' | 'complete' | 'blocked' | 'skipped';
  percent_complete: number;
  is_critical: boolean;
  earliest_start: string | null;
  earliest_finish: string | null;
  latest_start: string | null;
  latest_finish: string | null;
  total_float: number;
  free_float: number;
  constraint_type: string | null;
  constraint_date: string | null;
  assigned_vendor_id: string | null;
  crew_size: number;
  sort_order: number;
  wbs_code: string | null;
  notes: string | null;
  baseline_start: string | null;
  baseline_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleDependency {
  id: string;
  predecessor_id: string;
  successor_id: string;
  dependency_type: 'FS' | 'FF' | 'SS' | 'SF';
  lag_days: number;
  source: string | null;
  predecessor?: { id: string; name: string };
  successor?: { id: string; name: string };
}

export interface ScheduleMilestone {
  id: string;
  schedule_id: string;
  name: string;
  description: string | null;
  target_date: string;
  actual_date: string | null;
  status: 'upcoming' | 'reached' | 'missed';
  linked_task_id: string | null;
  linked_task?: { id: string; name: string };
  notify_days_before: number;
  sort_order: number;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  description: string | null;
  project_type: string;
  estimated_duration_days: number | null;
  phases: unknown[];
  is_default: boolean;
  source_schedule_id: string | null;
  created_by: string | null;
  created_at: string;
  task_count?: number;
}

export interface BaselineVariance {
  schedule_id: string;
  baseline_set_at: string;
  baseline_set_by: string;
  tasks: Array<ScheduleTask & { variance_days: number }>;
  summary: {
    total_tasks: number;
    tasks_with_baseline: number;
    on_schedule: number;
    behind_schedule: number;
    ahead_schedule: number;
    total_variance_days: number;
  };
}

export interface CriticalPath {
  critical_path_days: number;
  start_date: string | null;
  projected_end: string | null;
  target_end_date: string | null;
  critical_tasks: ScheduleTask[];
}

export interface GanttData {
  schedule: Omit<Schedule, 'job'>;
  tasks: Array<{
    id: string;
    name: string;
    phase: string | null;
    start: string | null;
    end: string | null;
    actual_start: string | null;
    actual_end: string | null;
    duration: number;
    progress: number;
    status: string;
    is_critical: boolean;
    total_float: number;
    earliest_start: string | null;
    earliest_finish: string | null;
    latest_start: string | null;
    latest_finish: string | null;
    dependencies: Array<{ predecessor_id: string; type: string; lag: number }>;
  }>;
  milestones: Array<{
    id: string;
    name: string;
    date: string;
    actual_date: string | null;
    status: string;
  }>;
  dependencies: ScheduleDependency[];
}

// ========================
// SCHEDULES
// ========================

export function useSchedules(jobId?: string) {
  return useQuery({
    queryKey: ['schedules', jobId],
    queryFn: async () => {
      const endpoint = jobId ? `/schedules?job_id=${jobId}` : '/schedules';
      return api<Schedule[]>(endpoint);
    },
  });
}

export function useSchedule(id: string | null) {
  return useQuery({
    queryKey: ['schedule', id],
    queryFn: async () => {
      if (!id) return null;
      return api<Schedule & { tasks: ScheduleTask[]; activity: unknown[] }>(`/schedules/${id}`);
    },
    enabled: !!id,
  });
}

export function useScheduleByJob(jobId: string | null) {
  return useQuery({
    queryKey: ['schedule-by-job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      return api<(Schedule & { tasks: ScheduleTask[] }) | null>(`/schedules/by-job/${jobId}`);
    },
    enabled: !!jobId,
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      job_id: string;
      name?: string;
      start_date?: string;
      target_end_date?: string;
      created_by?: string;
    }) => {
      return api<Schedule>('/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-by-job', data.job_id] });
      toast.success('Schedule created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create schedule: ${error.message}`);
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Schedule> & { id: string; updated_by?: string }) => {
      return api<Schedule>(`/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', data.id] });
      toast.success('Schedule updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update schedule: ${error.message}`);
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deleted_by }: { id: string; deleted_by?: string }) => {
      return api(`/schedules/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete schedule: ${error.message}`);
    },
  });
}

// ========================
// TASKS
// ========================

export function useScheduleTasksForSchedule(scheduleId: string | null) {
  return useQuery({
    queryKey: ['schedule-tasks-for-schedule', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      const schedule = await api<{ tasks: ScheduleTask[] }>(`/schedules/${scheduleId}`);
      return schedule.tasks || [];
    },
    enabled: !!scheduleId,
  });
}

export function useAddTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, ...task }: Partial<ScheduleTask> & { scheduleId: string; created_by?: string }) => {
      return api<ScheduleTask>(`/schedules/${scheduleId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(task),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks-for-schedule', variables.scheduleId] });
      toast.success('Task added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add task: ${error.message}`);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, ...updates }: Partial<ScheduleTask> & { taskId: string; updated_by?: string }) => {
      return api<ScheduleTask>(`/schedules/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
      toast.success('Task updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, deleted_by }: { taskId: string; deleted_by?: string }) => {
      return api(`/schedules/tasks/${taskId}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
      toast.success('Task deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, taskOrder, updated_by }: {
      scheduleId: string;
      taskOrder: Array<{ id: string; sort_order: number }>;
      updated_by?: string;
    }) => {
      return api(`/schedules/${scheduleId}/tasks/reorder`, {
        method: 'POST',
        body: JSON.stringify({ task_order: taskOrder, updated_by }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to reorder tasks: ${error.message}`);
    },
  });
}

// ========================
// GANTT & CRITICAL PATH
// ========================

export function useGanttData(scheduleId: string | null) {
  return useQuery({
    queryKey: ['gantt-data', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      return api<GanttData>(`/schedules/${scheduleId}/gantt-enhanced`);
    },
    enabled: !!scheduleId,
  });
}

export function useCriticalPath(scheduleId: string | null) {
  return useQuery({
    queryKey: ['critical-path', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      return api<CriticalPath>(`/schedules/${scheduleId}/critical-path`);
    },
    enabled: !!scheduleId,
  });
}

export function useRecalculateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, updated_by }: { scheduleId: string; updated_by?: string }) => {
      return api(`/schedules/${scheduleId}/recalculate`, {
        method: 'POST',
        body: JSON.stringify({ updated_by }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-data', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['critical-path', variables.scheduleId] });
      toast.success('Schedule recalculated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to recalculate: ${error.message}`);
    },
  });
}

// ========================
// DEPENDENCIES
// ========================

export function useDependencies(scheduleId: string | null) {
  return useQuery({
    queryKey: ['dependencies', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      return api<ScheduleDependency[]>(`/schedules/${scheduleId}/dependencies`);
    },
    enabled: !!scheduleId,
  });
}

export function useAddDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, ...dep }: {
      scheduleId: string;
      predecessor_id: string;
      successor_id: string;
      dependency_type?: 'FS' | 'FF' | 'SS' | 'SF';
      lag_days?: number;
      created_by?: string;
    }) => {
      return api<ScheduleDependency>(`/schedules/${scheduleId}/dependencies`, {
        method: 'POST',
        body: JSON.stringify(dep),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dependencies', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-data', variables.scheduleId] });
      toast.success('Dependency added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add dependency: ${error.message}`);
    },
  });
}

export function useDeleteDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, dependencyId, deleted_by }: {
      scheduleId: string;
      dependencyId: string;
      deleted_by?: string
    }) => {
      return api(`/schedules/${scheduleId}/dependencies/${dependencyId}`, {
        method: 'DELETE',
        body: JSON.stringify({ deleted_by }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['dependencies', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['gantt-data', variables.scheduleId] });
      toast.success('Dependency removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove dependency: ${error.message}`);
    },
  });
}

// ========================
// MILESTONES
// ========================

export function useMilestones(scheduleId: string | null) {
  return useQuery({
    queryKey: ['milestones', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return [];
      return api<ScheduleMilestone[]>(`/schedules/${scheduleId}/milestones`);
    },
    enabled: !!scheduleId,
  });
}

export function useAddMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, ...milestone }: {
      scheduleId: string;
      name: string;
      target_date: string;
      description?: string;
      linked_task_id?: string;
      notify_days_before?: number;
      created_by?: string;
    }) => {
      return api<ScheduleMilestone>(`/schedules/${scheduleId}/milestones`, {
        method: 'POST',
        body: JSON.stringify(milestone),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.scheduleId] });
      toast.success('Milestone added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add milestone: ${error.message}`);
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, milestoneId, ...updates }: Partial<ScheduleMilestone> & {
      scheduleId: string;
      milestoneId: string;
      updated_by?: string;
    }) => {
      return api<ScheduleMilestone>(`/schedules/${scheduleId}/milestones/${milestoneId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.scheduleId] });
      toast.success('Milestone updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update milestone: ${error.message}`);
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, milestoneId }: { scheduleId: string; milestoneId: string }) => {
      return api(`/schedules/${scheduleId}/milestones/${milestoneId}`, { method: 'DELETE' });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.scheduleId] });
      toast.success('Milestone deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete milestone: ${error.message}`);
    },
  });
}

// ========================
// BASELINE
// ========================

export function useBaseline(scheduleId: string | null) {
  return useQuery({
    queryKey: ['baseline', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      try {
        return await api<BaselineVariance>(`/schedules/${scheduleId}/baseline`);
      } catch {
        return null; // No baseline set
      }
    },
    enabled: !!scheduleId,
  });
}

export function useSetBaseline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ scheduleId, set_by, force }: { scheduleId: string; set_by?: string; force?: boolean }) => {
      return api(`/schedules/${scheduleId}/set-baseline`, {
        method: 'POST',
        body: JSON.stringify({ set_by, force }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['baseline', variables.scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', variables.scheduleId] });
      toast.success('Baseline set');
    },
    onError: (error: Error) => {
      toast.error(`Failed to set baseline: ${error.message}`);
    },
  });
}

// ========================
// TEMPLATES
// ========================

export function useTemplates() {
  return useQuery({
    queryKey: ['schedule-templates'],
    queryFn: () => api<ScheduleTemplate[]>('/schedules/templates'),
  });
}

export function useTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ['schedule-template', templateId],
    queryFn: async () => {
      if (!templateId) return null;
      return api<ScheduleTemplate & { tasks: unknown[]; dependencies: unknown[] }>(`/schedules/templates/${templateId}`);
    },
    enabled: !!templateId,
  });
}

export function useSaveAsTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      source_schedule_id: string;
      name: string;
      description?: string;
      project_type?: string;
      created_by?: string;
    }) => {
      return api<{ success: boolean; template_id: string; task_count: number }>('/schedules/templates/from-schedule', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
      toast.success('Template saved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });
}

export function useApplyTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ templateId, job_id, start_date, created_by }: {
      templateId: string;
      job_id: string;
      start_date: string;
      created_by?: string;
    }) => {
      return api<{ success: boolean; schedule_id: string; tasks_created: number; schedule: Schedule }>(`/schedules/templates/${templateId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ job_id, start_date, created_by }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-by-job'] });
      toast.success('Template applied');
    },
    onError: (error: Error) => {
      toast.error(`Failed to apply template: ${error.message}`);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      return api(`/schedules/templates/${templateId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates'] });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });
}

// ========================
// HELPERS
// ========================

export const scheduleStatusConfig: Record<ScheduleStatus, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  active: { label: 'Active', color: 'text-green-600', bgColor: 'bg-green-100' },
  complete: { label: 'Complete', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  on_hold: { label: 'On Hold', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
};

export const taskStatusConfig: Record<ScheduleTask['status'], { label: string; color: string; bgColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  complete: { label: 'Complete', color: 'text-green-600', bgColor: 'bg-green-100' },
  blocked: { label: 'Blocked', color: 'text-red-600', bgColor: 'bg-red-100' },
  skipped: { label: 'Skipped', color: 'text-gray-400', bgColor: 'bg-gray-50' },
};

export const dependencyTypeConfig: Record<ScheduleDependency['dependency_type'], { label: string; description: string }> = {
  FS: { label: 'Finish-to-Start', description: 'Successor starts when predecessor finishes' },
  FF: { label: 'Finish-to-Finish', description: 'Successor finishes when predecessor finishes' },
  SS: { label: 'Start-to-Start', description: 'Successor starts when predecessor starts' },
  SF: { label: 'Start-to-Finish', description: 'Successor finishes when predecessor starts' },
};

export const phaseOptions = [
  'Pre-Construction',
  'Site Work',
  'Foundation',
  'Framing',
  'Dry-In',
  'MEP Rough',
  'Insulation',
  'Drywall',
  'Interior Trim',
  'Finishes',
  'MEP Trim',
  'Final',
  'Punch List',
  'Closeout',
];
