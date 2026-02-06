import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarDays,
  List,
  GanttChart,
  Plus,
  Building,
  Download,
  Loader2,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { 
  useScheduleTasks, 
  useCreateScheduleTask, 
  useUpdateScheduleTask,
  useDeleteScheduleTask,
  ScheduleTask 
} from '@/hooks/useScheduleTasks';
import { ScheduleCalendarView } from '@/components/schedule/ScheduleCalendarView';
import { ScheduleListView } from '@/components/schedule/ScheduleListView';
import { ScheduleGanttView } from '@/components/schedule/ScheduleGanttView';
import { ScheduleTaskDialog } from '@/components/schedule/ScheduleTaskDialog';
import { ScheduleColorLegend } from '@/components/schedule/ScheduleColorLegend';
import { 
  ScheduleFilters, 
  ScheduleFiltersState, 
  defaultFilters, 
  applyFilters, 
  groupTasks,
  TaskGroup,
} from '@/components/schedule/ScheduleFilters';
import { toast } from 'sonner';
import { apiGet } from '@/lib/api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const Schedule = () => {
  const { selectedJobId } = useJob();
  const { data: tasks = [], isLoading } = useScheduleTasks(selectedJobId);
  const createTask = useCreateScheduleTask();
  const updateTask = useUpdateScheduleTask();
  const [isExporting, setIsExporting] = useState(false);
  const deleteTask = useDeleteScheduleTask();

  const [activeView, setActiveView] = useState<'calendar' | 'list' | 'gantt'>('calendar');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduleTask | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<ScheduleTask | null>(null);
  const [filters, setFilters] = useState<ScheduleFiltersState>(defaultFilters);

  // Apply filters and grouping
  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);
  const groupedTasks = useMemo(() => groupTasks(filteredTasks, filters.groupBy), [filteredTasks, filters.groupBy]);

  const handleAddTask = () => {
    setEditingTask(null);
    setDialogOpen(true);
  };

  const handleEditTask = (task: ScheduleTask) => {
    setEditingTask(task);
    setDialogOpen(true);
  };

  const handleTaskClick = (task: ScheduleTask) => {
    handleEditTask(task);
  };

  const handleSaveTask = async (taskData: Omit<ScheduleTask, 'id' | 'job_name' | 'created_at' | 'updated_at'>) => {
    try {
      if (editingTask) {
        await updateTask.mutateAsync({ id: editingTask.id, ...taskData });
        toast.success('Task updated successfully');
      } else {
        await createTask.mutateAsync(taskData);
        toast.success('Task created successfully');
      }
    } catch (error) {
      toast.error('Failed to save task');
    }
  };

  const handleDeleteTask = async () => {
    if (!deleteConfirmTask) return;
    try {
      await deleteTask.mutateAsync(deleteConfirmTask.id);
      toast.success('Task deleted successfully');
      setDeleteConfirmTask(null);
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const handleExportPDF = async () => {
    if (!selectedJobId) return;
    setIsExporting(true);
    try {
      const response = await apiGet(`/api/schedules/jobs/${selectedJobId}/export-pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // Extract filename from Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'schedule.pdf';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Schedule PDF exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export schedule PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (!selectedJobId) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Job Selected</h2>
            <p className="text-muted-foreground">Select a job from the sidebar to view schedule</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Schedule</h1>
            <p className="text-sm text-muted-foreground">
              Manage project timelines and tasks • {filteredTasks.length} of {tasks.length} task{tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ScheduleColorLegend />
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={isExporting || tasks.length === 0}
              className="gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Export PDF
            </Button>
            <Button onClick={handleAddTask} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <ScheduleFilters
          filters={filters}
          onFiltersChange={setFilters}
          taskCount={tasks.length}
          filteredCount={filteredTasks.length}
        />

        {/* View Tabs */}
        <Tabs value={activeView} onValueChange={(v) => setActiveView(v as any)}>
          <TabsList>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List className="h-4 w-4" />
              List
            </TabsTrigger>
            <TabsTrigger value="gantt" className="gap-2">
              <GanttChart className="h-4 w-4" />
              Gantt
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <ScheduleCalendarView 
              tasks={filteredTasks} 
              onTaskClick={handleTaskClick}
              onEdit={handleEditTask}
              onDelete={(task) => setDeleteConfirmTask(task)}
            />
          </TabsContent>

          <TabsContent value="list" className="mt-4">
            <ScheduleListView 
              tasks={filteredTasks} 
              onTaskClick={handleTaskClick}
              onEdit={handleEditTask}
              onDelete={(task) => setDeleteConfirmTask(task)}
              groupedTasks={groupedTasks}
            />
          </TabsContent>

          <TabsContent value="gantt" className="mt-4">
            <ScheduleGanttView 
              tasks={filteredTasks} 
              onTaskClick={handleTaskClick}
              onEdit={handleEditTask}
              onDelete={(task) => setDeleteConfirmTask(task)}
            />
          </TabsContent>
        </Tabs>

        {/* Task Dialog */}
        <ScheduleTaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          task={editingTask}
          defaultJobId={selectedJobId}
          onSave={handleSaveTask}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteConfirmTask} onOpenChange={() => setDeleteConfirmTask(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Task</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirmTask?.name}"? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Schedule;
