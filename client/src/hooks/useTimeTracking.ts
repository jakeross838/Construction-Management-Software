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

export interface GPSLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: string;
}

export interface TimeEntry {
  id: string;
  builder_id: string | null;
  job_id: string;
  user_id: string | null;
  employee_id: string;
  date: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  overtime_hours: number | null;
  cost_code_id: string | null;
  task_id: string | null;
  gps_clock_in: GPSLocation | null;
  gps_clock_out: GPSLocation | null;
  clock_in_geofence_valid: boolean | null;
  clock_out_geofence_valid: boolean | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  pay_rate: number | null;
  regular_pay: number | null;
  overtime_pay: number | null;
  total_pay: number | null;
  created_at: string;
  updated_at: string;
  // Expanded relations
  job?: { id: string; name: string; address?: string };
  employee?: { id: string; first_name: string; last_name: string; hourly_rate?: number };
  cost_code?: { id: string; code: string; name: string };
  task?: { id: string; name: string };
}

export interface JobGeofence {
  id: string;
  job_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  radius_meters: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeEntrySummary {
  period: { start: string; end: string };
  entries: number;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_pay: number;
  regular_pay: number;
  overtime_pay: number;
  by_job: Array<{
    job_id: string;
    job_name: string;
    total_hours: number;
    overtime_hours: number;
    total_pay: number;
  }>;
  by_employee: Array<{
    employee_id: string;
    employee_name: string;
    total_hours: number;
    overtime_hours: number;
    total_pay: number;
  }>;
  by_date: Array<{
    date: string;
    total_hours: number;
    overtime_hours: number;
  }>;
}

export interface CertifiedPayrollReport {
  job_id: string;
  period: { start: string; end: string };
  employees: Array<{
    employee_id: string;
    employee: { id: string; first_name: string; last_name: string };
    entries: TimeEntry[];
    total_regular_hours: number;
    total_overtime_hours: number;
    total_hours: number;
    total_regular_pay: number;
    total_overtime_pay: number;
    total_gross_pay: number;
  }>;
  totals: {
    entries: number;
    employees: number;
    total_hours: number;
    total_regular_hours: number;
    total_overtime_hours: number;
    total_gross_pay: number;
  };
}

export interface ClockInStatus {
  clocked_in: boolean;
  active_entry: TimeEntry | null;
}

// ============================================================
// QUERY HOOKS
// ============================================================

interface TimeEntriesFilter {
  job_id?: string;
  user_id?: string;
  employee_id?: string;
  date_from?: string;
  date_to?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export function useTimeEntries(filters: TimeEntriesFilter = {}) {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.user_id) params.append('user_id', filters.user_id);
  if (filters.employee_id) params.append('employee_id', filters.employee_id);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);
  if (filters.status) params.append('status', filters.status);

  const queryString = params.toString();

  return useQuery({
    queryKey: ['time-entries', filters],
    queryFn: () => api<TimeEntry[]>(`/time-tracking${queryString ? `?${queryString}` : ''}`),
  });
}

export function useTimeEntry(id: string | undefined) {
  return useQuery({
    queryKey: ['time-entry', id],
    queryFn: () => api<TimeEntry>(`/time-tracking/${id}`),
    enabled: !!id,
  });
}

export function useClockInStatus(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['clock-in-status', employeeId],
    queryFn: () => api<ClockInStatus>(`/time-tracking/status/${employeeId}`),
    enabled: !!employeeId,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useTimeEntrySummary(options: {
  job_id?: string;
  employee_id?: string;
  period?: 'week' | 'month' | 'year';
  date_from?: string;
  date_to?: string;
} = {}) {
  const params = new URLSearchParams();
  if (options.job_id) params.append('job_id', options.job_id);
  if (options.employee_id) params.append('employee_id', options.employee_id);
  if (options.period) params.append('period', options.period);
  if (options.date_from) params.append('date_from', options.date_from);
  if (options.date_to) params.append('date_to', options.date_to);

  const queryString = params.toString();

  return useQuery({
    queryKey: ['time-entry-summary', options],
    queryFn: () => api<TimeEntrySummary>(`/time-tracking/summary${queryString ? `?${queryString}` : ''}`),
  });
}

export function useCertifiedPayrollReport(jobId: string, dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['certified-payroll', jobId, dateFrom, dateTo],
    queryFn: () => api<CertifiedPayrollReport>(
      `/time-tracking/certified-payroll?job_id=${jobId}&date_from=${dateFrom}&date_to=${dateTo}`
    ),
    enabled: !!jobId && !!dateFrom && !!dateTo,
  });
}

export function useJobGeofence(jobId: string | undefined) {
  return useQuery({
    queryKey: ['job-geofence', jobId],
    queryFn: () => api<JobGeofence[]>(`/time-tracking/geofence/${jobId}`),
    enabled: !!jobId,
  });
}

// ============================================================
// MUTATION HOOKS
// ============================================================

export function useClockIn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      job_id: string;
      employee_id: string;
      user_id?: string;
      builder_id?: string;
      gps?: GPSLocation;
      cost_code_id?: string;
      task_id?: string;
      notes?: string;
    }) => {
      return api<TimeEntry>('/time-tracking/clock-in', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['clock-in-status', data.employee_id] });
      const geofenceStatus = data.clock_in_geofence_valid;
      if (geofenceStatus === false) {
        toast.warning('Clocked in, but outside job site geofence');
      } else {
        toast.success('Clocked in successfully');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to clock in: ${error.message}`);
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      employee_id: string;
      gps?: GPSLocation;
      break_minutes?: number;
    }) => {
      return api<TimeEntry>('/time-tracking/clock-out', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['clock-in-status', data.employee_id] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-summary'] });
      const geofenceStatus = data.clock_out_geofence_valid;
      if (geofenceStatus === false) {
        toast.warning(`Clocked out (${data.total_hours}h), but outside job site geofence`);
      } else {
        toast.success(`Clocked out: ${data.total_hours} hours${data.overtime_hours ? ` (${data.overtime_hours}h OT)` : ''}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to clock out: ${error.message}`);
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      job_id: string;
      employee_id: string;
      date: string;
      clock_in: string;
      clock_out?: string;
      break_minutes?: number;
      user_id?: string;
      builder_id?: string;
      cost_code_id?: string;
      task_id?: string;
      notes?: string;
    }) => {
      return api<TimeEntry>('/time-tracking', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-summary'] });
      toast.success('Time entry created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create time entry: ${error.message}`);
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      clock_in?: string;
      clock_out?: string;
      break_minutes?: number;
      cost_code_id?: string;
      task_id?: string;
      notes?: string;
      pay_rate?: number;
    }) => {
      return api<TimeEntry>(`/time-tracking/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry', data.id] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-summary'] });
      toast.success('Time entry updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update time entry: ${error.message}`);
    },
  });
}

export function useApproveTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, approved_by }: { id: string; approved_by?: string }) => {
      return api<TimeEntry>(`/time-tracking/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ approved_by }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry', data.id] });
      toast.success('Time entry approved');
    },
    onError: (error: Error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

export function useRejectTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, rejected_by, reason }: { id: string; rejected_by?: string; reason?: string }) => {
      return api<TimeEntry>(`/time-tracking/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejected_by, reason }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry', data.id] });
      toast.success('Time entry rejected');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return api(`/time-tracking/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-summary'] });
      toast.success('Time entry deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
}

export function useBulkApproveTimeEntries() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entry_ids, approved_by }: { entry_ids: string[]; approved_by?: string }) => {
      return api<{ approved: number }>('/time-tracking/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ entry_ids, approved_by }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
      queryClient.invalidateQueries({ queryKey: ['time-entry-summary'] });
      toast.success(`${data.approved} time entries approved`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to bulk approve: ${error.message}`);
    },
  });
}

// ============================================================
// GEOFENCE HOOKS
// ============================================================

export function useSetJobGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, ...data }: {
      jobId: string;
      center_lat: number;
      center_lng: number;
      radius_meters?: number;
      name?: string;
    }) => {
      return api<JobGeofence>(`/time-tracking/geofence/${jobId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['job-geofence', data.job_id] });
      toast.success('Geofence updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to set geofence: ${error.message}`);
    },
  });
}

export function useDeleteJobGeofence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (jobId: string) => {
      return api(`/time-tracking/geofence/${jobId}`, { method: 'DELETE' });
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ['job-geofence', jobId] });
      toast.success('Geofence removed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete geofence: ${error.message}`);
    },
  });
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Get current GPS location using browser Geolocation API
 */
export async function getCurrentGPSLocation(): Promise<GPSLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        });
      },
      (error) => {
        let message = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Location unavailable';
            break;
          case error.TIMEOUT:
            message = 'Location request timed out';
            break;
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Accept cached position up to 1 minute old
      }
    );
  });
}

/**
 * Format duration in hours to display string
 */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format time entry for display
 */
export function formatTimeRange(clockIn: string, clockOut: string | null): string {
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  if (!clockOut) {
    return `${formatTime(clockIn)} - (active)`;
  }
  return `${formatTime(clockIn)} - ${formatTime(clockOut)}`;
}
