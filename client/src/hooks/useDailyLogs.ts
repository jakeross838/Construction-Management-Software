import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      let query = supabase
        .from('daily_logs')
        .select(`
          *,
          jobs!inner(name, address),
          crew:daily_log_crew(*, vendors(name)),
          deliveries:daily_log_deliveries(*, vendors(name)),
          inspections:daily_log_inspections(*),
          attachments:daily_log_attachments(*)
        `)
        .is('deleted_at', null)
        .order('log_date', { ascending: false });

      if (jobId) {
        query = query.eq('job_id', jobId);
      }
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(log => ({
        ...log,
        absent_crews: Array.isArray(log.absent_crews) ? log.absent_crews as unknown as AbsentCrew[] : [],
      })) as unknown as DailyLog[];
    },
  });
}

// Fetch single daily log
export function useDailyLog(id: string | null) {
  return useQuery({
    queryKey: ['daily-log', id],
    queryFn: async (): Promise<DailyLog | null> => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from('daily_logs')
        .select(`
          *,
          jobs!inner(name, address),
          crew:daily_log_crew(*, vendors(name)),
          deliveries:daily_log_deliveries(*, vendors(name)),
          inspections:daily_log_inspections(*),
          attachments:daily_log_attachments(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return {
        ...data,
        absent_crews: Array.isArray(data.absent_crews) ? data.absent_crews as unknown as AbsentCrew[] : [],
      } as unknown as DailyLog;
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
      const { crew, deliveries, inspections, ...logData } = data;

      // Create the main log - cast absent_crews properly
      const insertData = {
        ...logData,
        absent_crews: logData.absent_crews ? JSON.parse(JSON.stringify(logData.absent_crews)) : null,
      };

      const { data: log, error: logError } = await supabase
        .from('daily_logs')
        .insert(insertData)
        .select()
        .single();

      if (logError) throw logError;

      // Insert crew entries
      if (crew && crew.length > 0) {
        const crewInserts = crew.map(c => ({
          daily_log_id: log.id,
          vendor_id: c.vendor_id ?? null,
          worker_count: c.worker_count ?? 1,
          hours_worked: c.hours_worked ?? null,
          trade: c.trade ?? null,
          work_area: c.work_area ?? null,
          completion_percent: c.completion_percent ?? null,
          po_id: c.po_id ?? null,
          schedule_task_id: c.schedule_task_id ?? null,
          notes: c.notes ?? null,
        }));
        const { error: crewError } = await supabase
          .from('daily_log_crew')
          .insert(crewInserts);
        if (crewError) throw crewError;
      }

      // Insert deliveries
      if (deliveries && deliveries.length > 0) {
        const deliveryInserts = deliveries.map(d => ({
          daily_log_id: log.id,
          vendor_id: d.vendor_id ?? null,
          po_id: d.po_id ?? null,
          description: d.description,
          quantity: d.quantity ?? null,
          unit: d.unit ?? null,
          received_by: d.received_by ?? null,
          notes: d.notes ?? null,
        }));
        const { error: deliveriesError } = await supabase
          .from('daily_log_deliveries')
          .insert(deliveryInserts);
        if (deliveriesError) throw deliveriesError;
      }

      // Insert inspections
      if (inspections && inspections.length > 0) {
        const inspectionInserts = inspections.map(i => ({
          daily_log_id: log.id,
          inspection_type: i.inspection_type,
          result: i.result ?? 'scheduled',
          inspector: i.inspector ?? null,
          notes: i.notes ?? null,
        }));
        const { error: inspectionsError } = await supabase
          .from('daily_log_inspections')
          .insert(inspectionInserts);
        if (inspectionsError) throw inspectionsError;
      }

      return log;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      toast.success('Daily log created');
    },
    onError: (error: Error) => {
      console.error('Failed to create daily log:', error);
      if (error.message.includes('duplicate key')) {
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
      const { id, crew, deliveries, inspections, ...logData } = data;

      // Update the main log - cast absent_crews properly
      const updateData = {
        ...logData,
        absent_crews: logData.absent_crews ? JSON.parse(JSON.stringify(logData.absent_crews)) : null,
      };

      const { error: logError } = await supabase
        .from('daily_logs')
        .update(updateData)
        .eq('id', id);

      if (logError) throw logError;

      // Replace crew entries
      if (crew !== undefined) {
        await supabase.from('daily_log_crew').delete().eq('daily_log_id', id);
        if (crew.length > 0) {
          const crewInserts = crew.map(c => ({
            daily_log_id: id,
            vendor_id: c.vendor_id ?? null,
            worker_count: c.worker_count ?? 1,
            hours_worked: c.hours_worked ?? null,
            trade: c.trade ?? null,
            work_area: c.work_area ?? null,
            completion_percent: c.completion_percent ?? null,
            po_id: c.po_id ?? null,
            schedule_task_id: c.schedule_task_id ?? null,
            notes: c.notes ?? null,
          }));
          const { error: crewError } = await supabase
            .from('daily_log_crew')
            .insert(crewInserts);
          if (crewError) throw crewError;
        }
      }

      // Replace deliveries
      if (deliveries !== undefined) {
        await supabase.from('daily_log_deliveries').delete().eq('daily_log_id', id);
        if (deliveries.length > 0) {
          const deliveryInserts = deliveries.map(d => ({
            daily_log_id: id,
            vendor_id: d.vendor_id ?? null,
            po_id: d.po_id ?? null,
            description: d.description,
            quantity: d.quantity ?? null,
            unit: d.unit ?? null,
            received_by: d.received_by ?? null,
            notes: d.notes ?? null,
          }));
          const { error: deliveriesError } = await supabase
            .from('daily_log_deliveries')
            .insert(deliveryInserts);
          if (deliveriesError) throw deliveriesError;
        }
      }

      // Replace inspections
      if (inspections !== undefined) {
        await supabase.from('daily_log_inspections').delete().eq('daily_log_id', id);
        if (inspections.length > 0) {
          const inspectionInserts = inspections.map(i => ({
            daily_log_id: id,
            inspection_type: i.inspection_type,
            result: i.result ?? 'scheduled',
            inspector: i.inspector ?? null,
            notes: i.notes ?? null,
          }));
          const { error: inspectionsError } = await supabase
            .from('daily_log_inspections')
            .insert(inspectionInserts);
          if (inspectionsError) throw inspectionsError;
        }
      }

      return { id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', variables.id] });
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
      const { error } = await supabase
        .from('daily_logs')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', id] });
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
      const { error } = await supabase
        .from('daily_logs')
        .update({ 
          status: 'draft', 
          completed_at: null 
        })
        .eq('id', id);

      if (error) throw error;
      return { id };
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
      queryClient.invalidateQueries({ queryKey: ['daily-log', id] });
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
      const { error } = await supabase
        .from('daily_logs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-logs'] });
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
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${logId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('daily-log-photos')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: false 
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('daily-log-photos')
        .getPublicUrl(uploadData.path);

      // Save to attachments table
      const { data, error } = await supabase
        .from('daily_log_attachments')
        .insert({
          daily_log_id: logId,
          file_url: publicUrl,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          category,
          caption,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
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
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      // Delete from attachments table first
      const { error } = await supabase
        .from('daily_log_attachments')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Try to delete from storage (extract path from URL)
      const pathMatch = fileUrl.match(/daily-log-photos\/(.+)$/);
      if (pathMatch) {
        await supabase.storage
          .from('daily-log-photos')
          .remove([pathMatch[1]]);
      }
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
      let query = supabase
        .from('daily_logs')
        .select('id, status, log_date, created_at')
        .is('deleted_at', null);

      if (jobId) {
        query = query.eq('job_id', jobId);
      }

      const { data, error } = await query;
      if (error) throw error;

      const logs = data || [];
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      return {
        total: logs.length,
        draft: logs.filter(l => l.status === 'draft').length,
        completed: logs.filter(l => l.status === 'completed').length,
        last30Days: logs.filter(l => new Date(l.log_date) >= thirtyDaysAgo).length,
        thisWeek: logs.filter(l => new Date(l.log_date) >= startOfWeek).length,
      };
    },
  });
}
