import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScheduleTask, statusConfig, useUpdateScheduleTask } from '@/hooks/useScheduleTasks';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Calendar, Clock, User, MoreVertical, Pencil, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

import { TaskGroup } from '@/components/schedule/ScheduleFilters';

interface ScheduleListViewProps {
  tasks: ScheduleTask[];
  onTaskClick?: (task: ScheduleTask) => void;
  onEdit?: (task: ScheduleTask) => void;
  onDelete?: (task: ScheduleTask) => void;
  groupedTasks?: TaskGroup[];
}

export function ScheduleListView({ tasks, onTaskClick, onEdit, onDelete, groupedTasks }: ScheduleListViewProps) {
  const updateTask = useUpdateScheduleTask();

  const getDuration = (startDate: string, endDate: string) => {
    const days = differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const handleConfirmTask = async (task: ScheduleTask, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateTask.mutateAsync({
        id: task.id,
        confirmed_at: task.confirmed_at ? null : new Date().toISOString(),
        confirmed_by: task.confirmed_at ? null : 'Current User',
      });
      toast.success(task.confirmed_at ? 'Task confirmation removed' : 'Task confirmed by subcontractor');
    } catch {
      toast.error('Failed to update confirmation');
    }
  };

  // Use provided groups or fallback to status grouping
  const displayGroups: TaskGroup[] = groupedTasks && groupedTasks.length > 0 
    ? groupedTasks 
    : Object.entries(
        tasks.reduce((acc, task) => {
          const status = task.status;
          if (!acc[status]) acc[status] = [];
          acc[status].push(task);
          return acc;
        }, {} as Record<string, ScheduleTask[]>)
      )
      .sort((a, b) => {
        const statusOrder = ['in_progress', 'scheduled', 'delayed', 'completed', 'cancelled'];
        return statusOrder.indexOf(a[0]) - statusOrder.indexOf(b[0]);
      })
      .map(([key, taskList]) => ({
        key,
        label: statusConfig[key as keyof typeof statusConfig]?.label || key,
        tasks: taskList,
      }));

  return (
    <div className="space-y-6">
      {displayGroups.map(group => {
        if (!group.tasks.length) return null;

        return (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                {group.label}
                <Badge variant="secondary" className="ml-2">{group.tasks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.tasks.map(task => (
                <div 
                  key={task.id}
                  className="p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => onTaskClick?.(task)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div 
                          className="h-3 w-3 rounded-full shrink-0" 
                          style={{ backgroundColor: task.color }}
                        />
                        <h4 className="font-medium truncate">{task.name}</h4>
                        {task.critical_path && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Critical Path
                          </Badge>
                        )}
                        {task.confirmed_at && (
                          <Badge variant="default" className="bg-green-600 text-white gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Confirmed
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(task.start_date), 'MMM d')} - {format(parseISO(task.end_date), 'MMM d')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {getDuration(task.start_date, task.end_date)}
                        </span>
                        {task.assigned_to && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {task.assigned_to}
                          </span>
                        )}
                        {task.job_name && (
                          <Badge variant="secondary" className="text-xs">
                            {task.job_name}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 text-right">
                        <div className="text-sm font-medium mb-1">{task.percent_complete}%</div>
                        <Progress value={task.percent_complete} className="h-1.5" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleConfirmTask(task, e)}>
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {task.confirmed_at ? 'Remove Confirmation' : 'Mark as Confirmed'}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit?.(task); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit Task
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => { e.stopPropagation(); onDelete?.(task); }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No scheduled tasks found. Add a task to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}