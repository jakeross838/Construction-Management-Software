import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { ScheduleTask, useUpdateScheduleTask } from '@/hooks/useScheduleTasks';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';

interface ScheduleCalendarViewProps {
  tasks: ScheduleTask[];
  onTaskClick?: (task: ScheduleTask) => void;
  onEdit?: (task: ScheduleTask) => void;
  onDelete?: (task: ScheduleTask) => void;
}

export function ScheduleCalendarView({ tasks, onTaskClick, onEdit, onDelete }: ScheduleCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const updateTask = useUpdateScheduleTask();
  
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      const start = parseISO(task.start_date);
      const end = parseISO(task.end_date);
      return day >= start && day <= end;
    });
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

  const today = new Date();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {format(currentDate, 'MMMM yyyy')}
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day Headers */}
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Days */}
          {calendarDays.map((day, index) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isToday = isSameDay(day, today);

            return (
              <div
                key={index}
                className={`min-h-[100px] p-1 border rounded-lg ${
                  isCurrentMonth ? 'bg-background' : 'bg-muted/30'
                } ${isToday ? 'ring-2 ring-primary' : ''}`}
              >
                <div className={`text-right text-sm mb-1 ${
                  isToday 
                    ? 'font-bold text-primary' 
                    : isCurrentMonth 
                      ? 'text-foreground' 
                      : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map(task => (
                    <Popover key={task.id}>
                      <PopoverTrigger asChild>
                        <div
                          className="px-1.5 py-0.5 rounded text-xs truncate cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1"
                          style={{ backgroundColor: task.color + '20', borderLeft: `3px solid ${task.color}` }}
                        >
                          {task.confirmed_at && <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />}
                          <span className="truncate">{task.name}</span>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: task.color }} />
                            <span className="font-medium text-sm truncate">{task.name}</span>
                          </div>
                          {task.confirmed_at && (
                            <Badge variant="default" className="bg-green-600 text-white gap-1 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Confirmed
                            </Badge>
                          )}
                          <div className="flex flex-col gap-1 pt-2 border-t">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start h-8"
                              onClick={(e) => handleConfirmTask(task, e)}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              {task.confirmed_at ? 'Remove Confirmation' : 'Mark as Confirmed'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start h-8"
                              onClick={() => onEdit?.(task)}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Task
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="justify-start h-8 text-destructive hover:text-destructive"
                              onClick={() => onDelete?.(task)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Task
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
