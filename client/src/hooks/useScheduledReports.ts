import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================
// TYPES
// ============================================================

export type ScheduleType = 'daily' | 'weekly' | 'monthly';
export type ReportFormat = 'excel' | 'pdf' | 'both';
export type ReportType = 'built_in' | 'custom';
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScheduledReport {
  id: string;
  builder_id?: string;
  report_template_id?: string;
  name: string;
  description?: string;
  report_type: ReportType;
  builtin_report_name?: string;
  parameters: Record<string, unknown>;
  schedule_type: ScheduleType;
  schedule_day?: number;
  schedule_time: string;
  timezone: string;
  recipients: string[];
  format: ReportFormat;
  enabled: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  report_template?: {
    id: string;
    name: string;
    entity_type: string;
    columns?: unknown[];
    filters?: unknown[];
  };
  recent_runs?: ScheduledReportRun[];
}

export interface ScheduledReportRun {
  id: string;
  scheduled_report_id: string;
  builder_id?: string;
  started_at: string;
  completed_at?: string;
  status: RunStatus;
  recipients_sent?: string[];
  files_generated?: string[];
  error_message?: string;
  error_details?: Record<string, unknown>;
  generation_time_ms?: number;
  file_size_bytes?: number;
}

export interface BuiltinReportInfo {
  name: string;
  display_name: string;
  description: string;
  required_params: string[];
  optional_params: string[];
}

export interface CreateScheduledReportInput {
  name: string;
  description?: string;
  report_type: ReportType;
  report_template_id?: string;
  builtin_report_name?: string;
  parameters?: Record<string, unknown>;
  schedule_type: ScheduleType;
  schedule_day?: number;
  schedule_time?: string;
  timezone?: string;
  recipients: string[];
  format?: ReportFormat;
  enabled?: boolean;
}

export interface UpdateScheduledReportInput {
  name?: string;
  description?: string;
  report_type?: ReportType;
  report_template_id?: string;
  builtin_report_name?: string;
  parameters?: Record<string, unknown>;
  schedule_type?: ScheduleType;
  schedule_day?: number;
  schedule_time?: string;
  timezone?: string;
  recipients?: string[];
  format?: ReportFormat;
  enabled?: boolean;
}

export interface RunHistoryResponse {
  schedule: {
    id: string;
    name: string;
  };
  runs: ScheduledReportRun[];
  total: number;
  summary: {
    total_runs: number;
    completed: number;
    failed: number;
    success_rate: number;
  };
}

// ============================================================
// API FUNCTIONS
// ============================================================

async function fetchScheduledReports(options?: {
  enabled?: boolean;
  report_type?: ReportType;
  include_runs?: boolean;
}): Promise<{ scheduled_reports: ScheduledReport[]; count: number }> {
  const params = new URLSearchParams();
  if (options?.enabled !== undefined) {
    params.append('enabled', String(options.enabled));
  }
  if (options?.report_type) {
    params.append('report_type', options.report_type);
  }
  if (options?.include_runs) {
    params.append('include_runs', 'true');
  }

  const url = `/api/scheduled-reports${params.toString() ? `?${params}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch scheduled reports' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function fetchScheduledReport(id: string): Promise<ScheduledReport> {
  const response = await fetch(`/api/scheduled-reports/${id}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch scheduled report' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function createScheduledReport(
  input: CreateScheduledReportInput
): Promise<{ message: string; scheduled_report: ScheduledReport }> {
  const response = await fetch('/api/scheduled-reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to create scheduled report' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function updateScheduledReport(
  id: string,
  input: UpdateScheduledReportInput
): Promise<{ message: string; scheduled_report: ScheduledReport }> {
  const response = await fetch(`/api/scheduled-reports/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to update scheduled report' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function deleteScheduledReport(id: string): Promise<{ message: string; deleted_id: string }> {
  const response = await fetch(`/api/scheduled-reports/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to delete scheduled report' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function runScheduledReportNow(
  id: string,
  triggeredBy?: string
): Promise<{ message: string; run: ScheduledReportRun; note: string }> {
  const response = await fetch(`/api/scheduled-reports/${id}/run-now`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ triggered_by: triggeredBy || 'Manual' }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to run scheduled report' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function fetchRunHistory(
  id: string,
  options?: { limit?: number; offset?: number; status?: RunStatus }
): Promise<RunHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));
  if (options?.status) params.append('status', options.status);

  const response = await fetch(`/api/scheduled-reports/${id}/history?${params}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch run history' }));
    throw new Error(error.message);
  }
  return response.json();
}

async function fetchBuiltinReports(): Promise<{ builtin_reports: BuiltinReportInfo[] }> {
  const response = await fetch('/api/scheduled-reports/builtin/list');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Failed to fetch builtin reports' }));
    throw new Error(error.message);
  }
  return response.json();
}

// ============================================================
// HOOKS
// ============================================================

/**
 * Fetch all scheduled reports
 */
export function useScheduledReports(options?: {
  enabled?: boolean;
  report_type?: ReportType;
  include_runs?: boolean;
}) {
  return useQuery({
    queryKey: ['scheduled-reports', options],
    queryFn: () => fetchScheduledReports(options),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Fetch a single scheduled report by ID
 */
export function useScheduledReport(id: string | undefined) {
  return useQuery({
    queryKey: ['scheduled-report', id],
    queryFn: () => fetchScheduledReport(id!),
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Create a new scheduled report
 */
export function useCreateScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });
}

/**
 * Update an existing scheduled report
 */
export function useUpdateScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateScheduledReportInput) =>
      updateScheduledReport(id, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-report', data.scheduled_report.id] });
    },
  });
}

/**
 * Delete a scheduled report
 */
export function useDeleteScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteScheduledReport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
    },
  });
}

/**
 * Trigger an immediate run of a scheduled report
 */
export function useRunScheduledReportNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, triggeredBy }: { id: string; triggeredBy?: string }) =>
      runScheduledReportNow(id, triggeredBy),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-report', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-report-history', variables.id] });
    },
  });
}

/**
 * Fetch run history for a scheduled report
 */
export function useScheduledReportHistory(
  id: string | undefined,
  options?: { limit?: number; offset?: number; status?: RunStatus }
) {
  return useQuery({
    queryKey: ['scheduled-report-history', id, options],
    queryFn: () => fetchRunHistory(id!, options),
    enabled: !!id,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Fetch list of available built-in reports
 */
export function useBuiltinReports() {
  return useQuery({
    queryKey: ['builtin-reports'],
    queryFn: fetchBuiltinReports,
    staleTime: 1000 * 60 * 30, // 30 minutes (static data)
  });
}

/**
 * Toggle enabled state for a scheduled report
 */
export function useToggleScheduledReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateScheduledReport(id, { enabled }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-reports'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-report', data.scheduled_report.id] });
    },
  });
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format schedule description for display
 */
export function formatScheduleDescription(schedule: ScheduledReport): string {
  const time = schedule.schedule_time?.slice(0, 5) || '08:00';
  const timezone = schedule.timezone || 'America/New_York';
  const tzAbbr = getTimezoneAbbr(timezone);

  switch (schedule.schedule_type) {
    case 'daily':
      return `Daily at ${time} ${tzAbbr}`;
    case 'weekly':
      const dayName = getDayName(schedule.schedule_day || 0);
      return `Every ${dayName} at ${time} ${tzAbbr}`;
    case 'monthly':
      const dayNum = schedule.schedule_day || 1;
      const suffix = getOrdinalSuffix(dayNum);
      return `Monthly on the ${dayNum}${suffix} at ${time} ${tzAbbr}`;
    default:
      return 'Unknown schedule';
  }
}

/**
 * Get day name from day number (0-6)
 */
function getDayName(day: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[day] || 'Unknown';
}

/**
 * Get ordinal suffix (1st, 2nd, 3rd, etc.)
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Get timezone abbreviation
 */
function getTimezoneAbbr(timezone: string): string {
  const abbrevs: Record<string, string> = {
    'America/New_York': 'ET',
    'America/Chicago': 'CT',
    'America/Denver': 'MT',
    'America/Los_Angeles': 'PT',
    'America/Phoenix': 'MST',
    'America/Anchorage': 'AKT',
    'Pacific/Honolulu': 'HST',
    'UTC': 'UTC',
  };
  return abbrevs[timezone] || timezone.split('/').pop()?.slice(0, 3) || 'UTC';
}

/**
 * Format run status for display with color
 */
export function getRunStatusDisplay(status: RunStatus): { label: string; color: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', color: 'text-yellow-500' };
    case 'running':
      return { label: 'Running', color: 'text-blue-500' };
    case 'completed':
      return { label: 'Completed', color: 'text-green-500' };
    case 'failed':
      return { label: 'Failed', color: 'text-red-500' };
    default:
      return { label: status, color: 'text-gray-500' };
  }
}

/**
 * Calculate next run time for preview (client-side approximation)
 */
export function calculateNextRunPreview(
  scheduleType: ScheduleType,
  scheduleDay: number | undefined,
  scheduleTime: string
): Date {
  const now = new Date();
  const [hours, minutes] = scheduleTime.split(':').map(Number);

  switch (scheduleType) {
    case 'daily': {
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      return next;
    }
    case 'weekly': {
      const targetDay = scheduleDay ?? 1;
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      const currentDay = now.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
      }
      next.setDate(next.getDate() + daysUntil);
      return next;
    }
    case 'monthly': {
      const targetDay = scheduleDay ?? 1;
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDay);
      }
      return next;
    }
    default:
      return now;
  }
}
