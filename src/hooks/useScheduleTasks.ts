import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TaskStatus = 'scheduled' | 'in_progress' | 'completed' | 'delayed' | 'cancelled';
export type TaskType = 'work' | 'inspection' | 'delivery' | 'milestone' | 'meeting' | 'walkthrough' | 'punch_list';
export type PredecessorType = 'FS' | 'SS'; // Finish-to-Start or Start-to-Start

export interface Predecessor {
  task_id: string;
  type: PredecessorType;
}

export interface ScheduleTask {
  id: string;
  job_id: string;
  job_name?: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: TaskStatus;
  critical_path: boolean;
  assigned_to: string | null;
  color: string;
  parent_task_id: string | null;
  sort_order: number;
  percent_complete: number;
  created_at: string;
  updated_at: string;
  // Extended fields
  phase: string | null;
  trades: string[] | null;
  tags: string[] | null;
  duration_days: number | null;
  po_id: string | null;
  predecessors: Predecessor[];
  // Confirmation tracking
  confirmed_at: string | null;
  confirmed_by: string | null;
  // Task type for color coding
  task_type: TaskType;
}

// Universal color coding system
// Colors are determined by: Task Type > Status > Confirmation
export function getTaskColor(task: ScheduleTask): string {
  // Task type takes priority for special types
  switch (task.task_type) {
    case 'inspection':
      return '#dc2626'; // Red - Inspections
    case 'delivery':
      return '#7c3aed'; // Purple - Deliveries
    case 'milestone':
      return '#0891b2'; // Cyan - Milestones
    case 'meeting':
      return '#0284c7'; // Sky blue - Meetings
    case 'walkthrough':
      return '#d946ef'; // Fuchsia - Walkthroughs
    case 'punch_list':
      return '#f97316'; // Orange - Punch list items
  }

  // For 'work' type tasks, color based on status
  switch (task.status) {
    case 'in_progress':
      return '#3b82f6'; // Blue - In Progress
    case 'completed':
      return '#6b7280'; // Gray - Completed
    case 'delayed':
      return '#ea580c'; // Orange-red - Delayed
    case 'cancelled':
      return '#9ca3af'; // Light gray - Cancelled
    case 'scheduled':
      // Check if confirmed
      if (task.confirmed_at) {
        return '#16a34a'; // Green - Confirmed
      }
      return '#eab308'; // Yellow - Scheduled but not confirmed
  }

  return '#3b82f6'; // Default blue
}

// Color legend for UI display
export const taskColorLegend: { type: string; color: string; label: string; description: string }[] = [
  { type: 'scheduled-unconfirmed', color: '#eab308', label: 'Scheduled', description: 'Awaiting confirmation' },
  { type: 'scheduled-confirmed', color: '#16a34a', label: 'Confirmed', description: 'Subcontractor confirmed' },
  { type: 'in_progress', color: '#3b82f6', label: 'In Progress', description: 'Work underway' },
  { type: 'inspection', color: '#dc2626', label: 'Inspection', description: 'Inspector required' },
  { type: 'delivery', color: '#7c3aed', label: 'Delivery', description: 'Material delivery' },
  { type: 'milestone', color: '#0891b2', label: 'Milestone', description: 'Project milestone' },
  { type: 'meeting', color: '#0284c7', label: 'Meeting', description: 'Scheduled meeting' },
  { type: 'walkthrough', color: '#d946ef', label: 'Walkthrough', description: 'Client walkthrough' },
  { type: 'punch_list', color: '#f97316', label: 'Punch List', description: 'Punch list item' },
  { type: 'delayed', color: '#ea580c', label: 'Delayed', description: 'Behind schedule' },
  { type: 'completed', color: '#6b7280', label: 'Completed', description: 'Work finished' },
  { type: 'cancelled', color: '#9ca3af', label: 'Cancelled', description: 'Task cancelled' },
];

export const taskTypeConfig: Record<TaskType, { label: string; icon: string }> = {
  work: { label: 'Work', icon: 'Hammer' },
  inspection: { label: 'Inspection', icon: 'ClipboardCheck' },
  delivery: { label: 'Delivery', icon: 'Truck' },
  milestone: { label: 'Milestone', icon: 'Flag' },
  meeting: { label: 'Meeting', icon: 'Users' },
  walkthrough: { label: 'Walkthrough', icon: 'Footprints' },
  punch_list: { label: 'Punch List', icon: 'ListChecks' },
};

export const predecessorTypeConfig: Record<PredecessorType, { label: string; description: string }> = {
  FS: { label: 'Finish-to-Start', description: 'Task starts after predecessor finishes' },
  SS: { label: 'Start-to-Start', description: 'Task starts when predecessor starts' },
};

export function useScheduleTasks(jobId?: string | null) {
  return useQuery({
    queryKey: ['schedule-tasks', jobId],
    queryFn: async () => {
      let query = supabase
        .from('schedule_tasks')
        .select(`
          *,
          jobs!inner(name)
        `)
        .order('start_date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((task: any) => {
        // Parse predecessors from JSONB
        let predecessors: Predecessor[] = [];
        if (task.predecessors) {
          if (Array.isArray(task.predecessors)) {
            predecessors = task.predecessors;
          }
        }
        
        const mappedTask = {
          ...task,
          job_name: task.jobs?.name,
          task_type: task.task_type || 'work',
          critical_path: task.critical_path || false,
          predecessors,
        };
        // Apply universal color based on type/status
        mappedTask.color = getTaskColor(mappedTask);
        return mappedTask;
      }) as ScheduleTask[];
    },
  });
}

export function useCreateScheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (task: Omit<ScheduleTask, 'id' | 'job_name' | 'created_at' | 'updated_at'>) => {
      // Convert predecessors to JSON-compatible format
      const { predecessors, ...rest } = task;
      const insertData = {
        ...rest,
        predecessors: predecessors ? JSON.parse(JSON.stringify(predecessors)) : [],
      };
      
      const { data, error } = await supabase
        .from('schedule_tasks')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
    },
  });
}

export function useUpdateScheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ScheduleTask> & { id: string }) => {
      // Convert predecessors to JSON-compatible format if present
      const { predecessors, ...rest } = updates;
      const updateData: Record<string, unknown> = { ...rest };
      
      if (predecessors !== undefined) {
        updateData.predecessors = JSON.parse(JSON.stringify(predecessors));
      }
      
      const { data, error } = await supabase
        .from('schedule_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
    },
  });
}

export function useDeleteScheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('schedule_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-tasks'] });
    },
  });
}

export const statusConfig: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Scheduled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-100' },
  delayed: { label: 'Delayed', color: 'text-red-600', bgColor: 'bg-red-100' },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', bgColor: 'bg-gray-50' },
};

export const phaseOptions = [
  'Pre-Construction',
  'Site Work',
  'Foundation',
  'Framing',
  'Rough-In',
  'Exterior',
  'Insulation',
  'Drywall',
  'Interior Finishes',
  'Final',
  'Punch List',
  'Closeout',
];

export const tradeOptions = [
  'General',
  'Excavation',
  'Concrete',
  'Framing',
  'Roofing',
  'Siding',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Insulation',
  'Drywall',
  'Painting',
  'Flooring',
  'Cabinets',
  'Countertops',
  'Tile',
  'Trim',
  'Landscaping',
];