import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type TaskType = 'task' | 'milestone' | 'checklist' | 'reminder';
export type TaskStatus = 'todo' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  job_id?: string;
  task_number: string;
  title: string;
  description?: string;
  type: TaskType;
  category?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to?: string;
  assignee_id?: string;
  created_by?: string;
  due_date?: string;
  start_date?: string;
  completed_at?: string;
  progress: number;
  parent_task_id?: string;
  estimated_hours?: number;
  actual_hours?: number;
  cost_code_id?: string;
  vendor_id?: string;
  related_rfi_id?: string;
  related_submittal_id?: string;
  related_po_id?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  job?: { id: string; name: string };
  checklists?: TaskChecklist[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  subtasks?: Task[];
}

export const taskPriorityConfig: Record<TaskPriority, { label: string; color: string; bgColor: string }> = {
  low: { label: 'Low', color: 'text-gray-500', bgColor: 'bg-gray-500' },
  normal: { label: 'Normal', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  high: { label: 'High', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'text-red-500', bgColor: 'bg-red-500' },
};

export const taskStatusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  todo: { label: 'To Do', color: 'text-gray-500', bgColor: 'bg-gray-500' },
  in_progress: { label: 'In Progress', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  on_hold: { label: 'On Hold', color: 'text-amber-500', bgColor: 'bg-amber-500' },
  completed: { label: 'Completed', color: 'text-green-500', bgColor: 'bg-green-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-500', bgColor: 'bg-red-500' },
};

export const taskTypeConfig: Record<TaskType, { label: string; icon: string }> = {
  task: { label: 'Task', icon: 'CheckSquare' },
  milestone: { label: 'Milestone', icon: 'Flag' },
  checklist: { label: 'Checklist', icon: 'ListChecks' },
  reminder: { label: 'Reminder', icon: 'Bell' },
};

export const taskCategoryOptions = [
  'coordination',
  'procurement',
  'inspection',
  'admin',
  'documentation',
  'quality',
  'safety',
  'scheduling',
  'communication',
  'other',
];

export interface TaskChecklist {
  id: string;
  task_id: string;
  item_order: number;
  description: string;
  is_completed: boolean;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  content: string;
  author?: string;
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  name: string;
  file_url: string;
  file_type?: string;
  file_size?: number;
  uploaded_by?: string;
  created_at: string;
}

export interface TaskStats {
  total: number;
  todo: number;
  in_progress: number;
  on_hold: number;
  completed: number;
  cancelled: number;
  overdue: number;
}

interface TaskFilters {
  job_id?: string;
  status?: string;
  assigned_to?: string;
  priority?: string;
  type?: string;
  due_before?: string;
  parent_task_id?: string | null;
}

async function fetchTasks(filters: TaskFilters = {}): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.job_id) params.append('job_id', filters.job_id);
  if (filters.status) params.append('status', filters.status);
  if (filters.assigned_to) params.append('assigned_to', filters.assigned_to);
  if (filters.priority) params.append('priority', filters.priority);
  if (filters.type) params.append('type', filters.type);
  if (filters.due_before) params.append('due_before', filters.due_before);
  if (filters.parent_task_id === null) {
    params.append('parent_task_id', 'null');
  } else if (filters.parent_task_id) {
    params.append('parent_task_id', filters.parent_task_id);
  }

  const response = await fetch(`/api/tasks?${params}`);
  if (!response.ok) throw new Error('Failed to fetch tasks');
  return response.json();
}

async function fetchTaskStats(jobId?: string): Promise<TaskStats> {
  const params = jobId ? `?job_id=${jobId}` : '';
  const response = await fetch(`/api/tasks/stats${params}`);
  if (!response.ok) throw new Error('Failed to fetch task stats');
  return response.json();
}

async function fetchTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`);
  if (!response.ok) throw new Error('Failed to fetch task');
  return response.json();
}

async function createTask(task: Partial<Task>): Promise<Task> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!response.ok) throw new Error('Failed to create task');
  return response.json();
}

async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error('Failed to update task');
  return response.json();
}

async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete task');
}

async function completeTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/complete`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to complete task');
  return response.json();
}

async function reopenTask(id: string): Promise<Task> {
  const response = await fetch(`/api/tasks/${id}/reopen`, { method: 'POST' });
  if (!response.ok) throw new Error('Failed to reopen task');
  return response.json();
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
  });
}

export function useTaskStats(jobId?: string) {
  return useQuery({
    queryKey: ['task-stats', jobId],
    queryFn: () => fetchTaskStats(jobId),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => fetchTask(id),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Task created');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Task> }) =>
      updateTask(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
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
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Task deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeTask,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Task completed');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete task: ${error.message}`);
    },
  });
}

export function useReopenTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reopenTask,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', id] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Task reopened');
    },
    onError: (error: Error) => {
      toast.error(`Failed to reopen task: ${error.message}`);
    },
  });
}

// ============================================================
// CHECKLIST MUTATIONS
// ============================================================

async function addChecklistItem(taskId: string, description: string): Promise<TaskChecklist> {
  const response = await fetch(`/api/tasks/${taskId}/checklists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description }),
  });
  if (!response.ok) throw new Error('Failed to add checklist item');
  return response.json();
}

async function toggleChecklistItem(taskId: string, checklistId: string, isCompleted: boolean): Promise<TaskChecklist> {
  const response = await fetch(`/api/tasks/${taskId}/checklists/${checklistId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_completed: isCompleted }),
  });
  if (!response.ok) throw new Error('Failed to toggle checklist item');
  return response.json();
}

async function deleteChecklistItem(taskId: string, checklistId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/checklists/${checklistId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete checklist item');
}

export function useAddChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, description }: { taskId: string; description: string }) =>
      addChecklistItem(taskId, description),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to add checklist item: ${error.message}`);
    },
  });
}

export function useToggleChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, checklistId, isCompleted }: { taskId: string; checklistId: string; isCompleted: boolean }) =>
      toggleChecklistItem(taskId, checklistId, isCompleted),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update checklist item: ${error.message}`);
    },
  });
}

export function useDeleteChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, checklistId }: { taskId: string; checklistId: string }) =>
      deleteChecklistItem(taskId, checklistId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete checklist item: ${error.message}`);
    },
  });
}

// ============================================================
// COMMENT MUTATIONS
// ============================================================

async function addComment(taskId: string, content: string): Promise<TaskComment> {
  const response = await fetch(`/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error('Failed to add comment');
  return response.json();
}

async function deleteComment(taskId: string, commentId: string): Promise<void> {
  const response = await fetch(`/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete comment');
}

export function useAddComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, content }: { taskId: string; content: string }) =>
      addComment(taskId, content),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Comment added');
    },
    onError: (error: Error) => {
      toast.error(`Failed to add comment: ${error.message}`);
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, commentId }: { taskId: string; commentId: string }) =>
      deleteComment(taskId, commentId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast.success('Comment deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete comment: ${error.message}`);
    },
  });
}
