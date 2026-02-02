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

// ============================================================
// TYPES
// ============================================================

export type ResourceType = 'crew' | 'equipment' | 'subcontractor';
export type ConflictSeverity = 'warning' | 'critical';

export interface TaskResource {
  id: string;
  task_id: string;
  resource_type: ResourceType;
  resource_id: string;
  resource_name: string | null;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResourceConflict {
  conflict_id: string;
  resource_type: ResourceType;
  resource_id: string;
  resource_name: string | null;
  task_1_id: string;
  task_1_name: string;
  job_1_id?: string;
  job_1_name?: string;
  task_2_id: string;
  task_2_name: string;
  job_2_id?: string;
  job_2_name?: string;
  overlap_start: string;
  overlap_end: string;
  total_allocation: number;
  severity: ConflictSeverity;
  is_cross_job?: boolean;
}

export interface GroupedConflict {
  resource_type: ResourceType;
  resource_id: string;
  resource_name: string | null;
  conflicts: Array<{
    conflict_id: string;
    task_1: { id: string; name: string; job_id?: string; job_name?: string };
    task_2: { id: string; name: string; job_id?: string; job_name?: string };
    overlap_start: string;
    overlap_end: string;
    total_allocation: number;
    severity: ConflictSeverity;
    is_cross_job?: boolean;
  }>;
}

export interface JobConflictsResponse {
  job_id: string;
  total_conflicts: number;
  critical_count: number;
  warning_count: number;
  conflicts: ResourceConflict[];
  grouped_by_resource: GroupedConflict[];
}

export interface AllConflictsResponse {
  total_conflicts: number;
  critical_count: number;
  warning_count: number;
  cross_job_count: number;
  conflicts: ResourceConflict[];
  grouped_by_resource: GroupedConflict[];
}

export interface DailyAllocation {
  date: string;
  total_allocation: number;
  is_overallocated: boolean;
  task_count: number;
}

export interface ResourceAvailabilityResponse {
  resource_type: ResourceType;
  resource_id: string;
  start_date: string;
  end_date: string;
  summary: {
    total_days: number;
    overallocated_days: number;
    max_allocation: number;
    avg_allocation: number;
    is_available: boolean;
  };
  daily_allocation: DailyAllocation[];
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  role?: string;
  skills?: string[];
}

export interface ResourcesResponse {
  crews: Resource[];
  subcontractors: Resource[];
  equipment: Resource[];
}

export interface ResourceAssignment {
  assignment_id: string;
  task_id: string;
  task_name: string | null;
  task_status: string | null;
  job_id: string | null;
  job_name: string | null;
  allocation_percent: number;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

export interface ResourceAssignmentsResponse {
  resource_type: ResourceType;
  resource_id: string;
  total_assignments: number;
  assignments: ResourceAssignment[];
}

// ============================================================
// CONFLICT DETECTION HOOKS
// ============================================================

/**
 * Get resource conflicts for a specific job
 */
export function useJobResourceConflicts(jobId: string | null) {
  return useQuery({
    queryKey: ['resource-conflicts', 'job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      return api<JobConflictsResponse>(`/resource-conflicts?job_id=${jobId}`);
    },
    enabled: !!jobId,
  });
}

/**
 * Get all resource conflicts across all active jobs
 */
export function useAllResourceConflicts(options?: {
  severity?: ConflictSeverity;
  crossJobOnly?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.severity) params.append('severity', options.severity);
  if (options?.crossJobOnly) params.append('cross_job_only', 'true');
  const queryString = params.toString();

  return useQuery({
    queryKey: ['resource-conflicts', 'all', options],
    queryFn: () => api<AllConflictsResponse>(`/resource-conflicts/all${queryString ? `?${queryString}` : ''}`),
  });
}

/**
 * Check resource availability for a date range
 */
export function useResourceAvailability(params: {
  resourceType: ResourceType | null;
  resourceId: string | null;
  startDate: string | null;
  endDate: string | null;
  excludeTaskId?: string;
}) {
  const { resourceType, resourceId, startDate, endDate, excludeTaskId } = params;

  return useQuery({
    queryKey: ['resource-availability', resourceType, resourceId, startDate, endDate, excludeTaskId],
    queryFn: async () => {
      if (!resourceType || !resourceId || !startDate || !endDate) return null;

      const searchParams = new URLSearchParams({
        resource_type: resourceType,
        resource_id: resourceId,
        start_date: startDate,
        end_date: endDate,
      });
      if (excludeTaskId) {
        searchParams.append('exclude_task_id', excludeTaskId);
      }

      return api<ResourceAvailabilityResponse>(`/resource-conflicts/check-availability?${searchParams}`);
    },
    enabled: !!(resourceType && resourceId && startDate && endDate),
  });
}

// ============================================================
// TASK RESOURCE MANAGEMENT HOOKS
// ============================================================

/**
 * Get resources assigned to a task
 */
export function useTaskResources(taskId: string | null) {
  return useQuery({
    queryKey: ['task-resources', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      return api<TaskResource[]>(`/resource-conflicts/task/${taskId}/resources`);
    },
    enabled: !!taskId,
  });
}

/**
 * Assign a resource to a task
 */
export function useAssignTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      resourceType,
      resourceId,
      resourceName,
      allocationPercent,
      startDate,
      endDate,
      notes,
    }: {
      taskId: string;
      resourceType: ResourceType;
      resourceId: string;
      resourceName?: string;
      allocationPercent?: number;
      startDate?: string;
      endDate?: string;
      notes?: string;
    }) => {
      return api<TaskResource & { warning?: string; conflicts_detected?: boolean }>(
        `/resource-conflicts/task/${taskId}/resources`,
        {
          method: 'POST',
          body: JSON.stringify({
            resource_type: resourceType,
            resource_id: resourceId,
            resource_name: resourceName,
            allocation_percent: allocationPercent,
            start_date: startDate,
            end_date: endDate,
            notes,
          }),
        }
      );
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-resources', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['resource-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['resource-availability'] });

      if (data.conflicts_detected) {
        toast.warning('Resource assigned with scheduling conflicts');
      } else {
        toast.success('Resource assigned to task');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to assign resource: ${error.message}`);
    },
  });
}

/**
 * Update a resource assignment
 */
export function useUpdateTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      taskId,
      resourceId,
      allocationPercent,
      startDate,
      endDate,
      notes,
    }: {
      taskId: string;
      resourceId: string;
      allocationPercent?: number;
      startDate?: string | null;
      endDate?: string | null;
      notes?: string;
    }) => {
      return api<TaskResource>(`/resource-conflicts/task/${taskId}/resources/${resourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          allocation_percent: allocationPercent,
          start_date: startDate,
          end_date: endDate,
          notes,
        }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-resources', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['resource-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['resource-availability'] });
      toast.success('Resource assignment updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update resource: ${error.message}`);
    },
  });
}

/**
 * Remove a resource from a task
 */
export function useRemoveTaskResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, resourceId }: { taskId: string; resourceId: string }) => {
      return api(`/resource-conflicts/task/${taskId}/resources/${resourceId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['task-resources', variables.taskId] });
      queryClient.invalidateQueries({ queryKey: ['resource-conflicts'] });
      queryClient.invalidateQueries({ queryKey: ['resource-availability'] });
      toast.success('Resource removed from task');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove resource: ${error.message}`);
    },
  });
}

// ============================================================
// RESOURCE LISTING HOOKS
// ============================================================

/**
 * List available resources (crews, subcontractors, equipment)
 */
export function useAvailableResources(type?: ResourceType) {
  return useQuery({
    queryKey: ['available-resources', type],
    queryFn: async () => {
      const endpoint = type
        ? `/resource-conflicts/resources?type=${type}`
        : '/resource-conflicts/resources';

      if (type) {
        return api<Resource[]>(endpoint);
      }
      return api<ResourcesResponse>(endpoint);
    },
  });
}

/**
 * Get all task assignments for a specific resource
 */
export function useResourceAssignments(
  resourceType: ResourceType | null,
  resourceId: string | null,
  includeCompleted = false
) {
  return useQuery({
    queryKey: ['resource-assignments', resourceType, resourceId, includeCompleted],
    queryFn: async () => {
      if (!resourceType || !resourceId) return null;

      const params = includeCompleted ? '?include_completed=true' : '';
      return api<ResourceAssignmentsResponse>(
        `/resource-conflicts/resources/${resourceType}/${resourceId}/assignments${params}`
      );
    },
    enabled: !!(resourceType && resourceId),
  });
}

// ============================================================
// HELPERS
// ============================================================

export const resourceTypeConfig: Record<ResourceType, { label: string; icon: string; color: string }> = {
  crew: { label: 'Crew Member', icon: 'Users', color: 'text-blue-600' },
  equipment: { label: 'Equipment', icon: 'Wrench', color: 'text-orange-600' },
  subcontractor: { label: 'Subcontractor', icon: 'Building2', color: 'text-purple-600' },
};

export const severityConfig: Record<ConflictSeverity, { label: string; color: string; bgColor: string }> = {
  warning: { label: 'Warning', color: 'text-yellow-600', bgColor: 'bg-yellow-100' },
  critical: { label: 'Critical', color: 'text-red-600', bgColor: 'bg-red-100' },
};

/**
 * Calculate the overlap duration in days
 */
export function calculateOverlapDays(overlapStart: string, overlapEnd: string): number {
  const start = new Date(overlapStart);
  const end = new Date(overlapEnd);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
}

/**
 * Format allocation percentage with over-allocation indicator
 */
export function formatAllocation(allocation: number): string {
  if (allocation > 100) {
    return `${allocation}% (${allocation - 100}% over)`;
  }
  return `${allocation}%`;
}
