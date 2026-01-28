import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, CheckCircle2, Pencil, Trash2, Link2 } from 'lucide-react';
import { ScheduleTask, Predecessor, PredecessorType, statusConfig, predecessorTypeConfig, useUpdateScheduleTask } from '@/hooks/useScheduleTasks';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  differenceInDays,
  isSameDay,
  addDays,
} from 'date-fns';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ScheduleGanttViewProps {
  tasks: ScheduleTask[];
  onTaskClick?: (task: ScheduleTask) => void;
  onEdit?: (task: ScheduleTask) => void;
  onDelete?: (task: ScheduleTask) => void;
}

interface DragState {
  taskId: string;
  type: 'move' | 'resize-start' | 'resize-end';
  initialX: number;
  initialStartDate: string;
  initialEndDate: string;
}

interface LinkDragState {
  sourceTaskId: string;
  sourceType: 'start' | 'end'; // Which end of the source task the link originates from
  currentX: number;
  currentY: number;
}

export function ScheduleGanttView({ tasks, onTaskClick, onEdit, onDelete }: ScheduleGanttViewProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragDelta, setDragDelta] = useState(0);
  const [linkDragState, setLinkDragState] = useState<LinkDragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateTask = useUpdateScheduleTask();
  const hasDragged = useRef(false);
  
  const weeksToShow = 4;
  const today = new Date();
  const baseDate = addWeeks(startOfWeek(today), weekOffset);
  const endDate = endOfWeek(addWeeks(baseDate, weeksToShow - 1));
  
  const days = useMemo(() => {
    return eachDayOfInterval({ start: baseDate, end: endDate });
  }, [baseDate, endDate]);

  const dayWidth = 40;
  const taskHeight = 32;
  const headerHeight = 60;
  const rowHeight = 44;
  const labelColumnWidth = 200;

  const getTaskPosition = useCallback((task: ScheduleTask, applyDrag = false) => {
    const taskStart = parseISO(task.start_date);
    const taskEnd = parseISO(task.end_date);
    
    let startOffset = differenceInDays(taskStart, baseDate);
    let duration = differenceInDays(taskEnd, taskStart) + 1;

    // Apply drag delta for the dragged task
    if (applyDrag && dragState?.taskId === task.id) {
      const daysDelta = Math.round(dragDelta / dayWidth);
      
      if (dragState.type === 'move') {
        startOffset += daysDelta;
      } else if (dragState.type === 'resize-start') {
        startOffset += daysDelta;
        duration -= daysDelta;
      } else if (dragState.type === 'resize-end') {
        duration += daysDelta;
      }
    }
    
    return {
      left: Math.max(0, startOffset * dayWidth),
      width: Math.max(dayWidth, duration * dayWidth),
      isVisible: taskEnd >= baseDate && taskStart <= endDate,
      startOffset,
      duration,
    };
  }, [baseDate, endDate, dragState, dragDelta, dayWidth]);

  // Build task position map for dependency lines
  const taskPositionMap = useMemo(() => {
    const map = new Map<string, { task: ScheduleTask; rowIndex: number; position: ReturnType<typeof getTaskPosition> }>();
    let rowIndex = 0;
    
    const tasksByJob: Record<string, { jobName: string; tasks: ScheduleTask[] }> = {};
    tasks.forEach(task => {
      if (!tasksByJob[task.job_id]) {
        tasksByJob[task.job_id] = { jobName: task.job_name || 'Unknown', tasks: [] };
      }
      tasksByJob[task.job_id].tasks.push(task);
    });
    
    Object.values(tasksByJob).forEach(group => {
      rowIndex++; // Job header row
      group.tasks.forEach(task => {
        map.set(task.id, { task, rowIndex, position: getTaskPosition(task, true) });
        rowIndex++;
      });
    });
    
    return map;
  }, [tasks, getTaskPosition]);

  // Group tasks by job
  const tasksByJob = useMemo(() => {
    const groups: Record<string, { jobName: string; tasks: ScheduleTask[] }> = {};
    
    tasks.forEach(task => {
      if (!groups[task.job_id]) {
        groups[task.job_id] = { jobName: task.job_name || 'Unknown', tasks: [] };
      }
      groups[task.job_id].tasks.push(task);
    });
    
    return Object.values(groups);
  }, [tasks]);

  const totalRows = tasksByJob.reduce((acc, group) => acc + group.tasks.length + 1, 0);

  // Drag handlers for task bars
  const handleMouseDown = (e: React.MouseEvent, task: ScheduleTask, type: DragState['type']) => {
    e.stopPropagation();
    e.preventDefault();
    hasDragged.current = false;
    
    setDragState({
      taskId: task.id,
      type,
      initialX: e.clientX,
      initialStartDate: task.start_date,
      initialEndDate: task.end_date,
    });
    setDragDelta(0);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState) {
      const delta = e.clientX - dragState.initialX;
      if (Math.abs(delta) > 5) {
        hasDragged.current = true;
      }
      setDragDelta(delta);
    }
    
    if (linkDragState && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setLinkDragState(prev => prev ? {
        ...prev,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      } : null);
    }
  }, [dragState, linkDragState]);

  const handleMouseUp = useCallback(async () => {
    if (dragState && hasDragged.current) {
      const daysDelta = Math.round(dragDelta / dayWidth);
      
      if (daysDelta !== 0) {
        const task = tasks.find(t => t.id === dragState.taskId);
        if (task) {
          let newStartDate = task.start_date;
          let newEndDate = task.end_date;
          
          if (dragState.type === 'move') {
            newStartDate = format(addDays(parseISO(dragState.initialStartDate), daysDelta), 'yyyy-MM-dd');
            newEndDate = format(addDays(parseISO(dragState.initialEndDate), daysDelta), 'yyyy-MM-dd');
          } else if (dragState.type === 'resize-start') {
            newStartDate = format(addDays(parseISO(dragState.initialStartDate), daysDelta), 'yyyy-MM-dd');
          } else if (dragState.type === 'resize-end') {
            newEndDate = format(addDays(parseISO(dragState.initialEndDate), daysDelta), 'yyyy-MM-dd');
          }
          
          // Validate dates
          if (parseISO(newStartDate) <= parseISO(newEndDate)) {
            try {
              await updateTask.mutateAsync({
                id: task.id,
                start_date: newStartDate,
                end_date: newEndDate,
              });
              toast.success('Task rescheduled');
            } catch {
              toast.error('Failed to update task');
            }
          }
        }
      }
    }
    
    setDragState(null);
    setDragDelta(0);
    setLinkDragState(null);
  }, [dragState, dragDelta, dayWidth, tasks, updateTask]);

  // Link drag handlers
  const handleLinkDragStart = (e: React.MouseEvent, task: ScheduleTask, sourceType: 'start' | 'end') => {
    e.stopPropagation();
    e.preventDefault();
    
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setLinkDragState({
        sourceTaskId: task.id,
        sourceType,
        currentX: e.clientX - rect.left,
        currentY: e.clientY - rect.top,
      });
    }
  };

  const handleLinkDrop = async (targetTask: ScheduleTask) => {
    if (!linkDragState || linkDragState.sourceTaskId === targetTask.id) {
      setLinkDragState(null);
      return;
    }

    const predecessorType: PredecessorType = linkDragState.sourceType === 'end' ? 'FS' : 'SS';
    
    // Check if this predecessor already exists
    const existingPreds = targetTask.predecessors || [];
    const alreadyExists = existingPreds.some(p => p.task_id === linkDragState.sourceTaskId);
    
    if (alreadyExists) {
      toast.error('Predecessor link already exists');
      setLinkDragState(null);
      return;
    }

    const newPredecessor: Predecessor = {
      task_id: linkDragState.sourceTaskId,
      type: predecessorType,
    };

    try {
      await updateTask.mutateAsync({
        id: targetTask.id,
        predecessors: [...existingPreds, newPredecessor],
      });
      toast.success(`Added ${predecessorType} predecessor link`);
    } catch {
      toast.error('Failed to add predecessor');
    }

    setLinkDragState(null);
  };

  const handleConfirmTask = async (task: ScheduleTask) => {
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

  const handleRemovePredecessor = async (task: ScheduleTask, predTaskId: string) => {
    const newPreds = (task.predecessors || []).filter(p => p.task_id !== predTaskId);
    try {
      await updateTask.mutateAsync({
        id: task.id,
        predecessors: newPreds,
      });
      toast.success('Predecessor removed');
    } catch {
      toast.error('Failed to remove predecessor');
    }
  };

  // Add/remove global mouse event listeners
  useEffect(() => {
    if (dragState || linkDragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, linkDragState, handleMouseMove, handleMouseUp]);

  // Generate dependency lines
  const dependencyLines = useMemo(() => {
    const lines: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      type: PredecessorType;
    }> = [];

    tasks.forEach(task => {
      if (task.predecessors && task.predecessors.length > 0) {
        const targetInfo = taskPositionMap.get(task.id);
        if (!targetInfo) return;

        task.predecessors.forEach(pred => {
          const sourceInfo = taskPositionMap.get(pred.task_id);
          if (!sourceInfo) return;

          let x1: number, y1: number;
          
          if (pred.type === 'SS') {
            // Start-to-Start: line from start of predecessor to start of target
            x1 = labelColumnWidth + sourceInfo.position.left;
          } else {
            // Finish-to-Start (default): line from end of predecessor to start of target
            x1 = labelColumnWidth + sourceInfo.position.left + sourceInfo.position.width;
          }
          y1 = headerHeight + sourceInfo.rowIndex * rowHeight + rowHeight / 2;

          // Target: start of dependent task
          const x2 = labelColumnWidth + targetInfo.position.left;
          const y2 = headerHeight + targetInfo.rowIndex * rowHeight + rowHeight / 2;

          lines.push({
            id: `${pred.task_id}-${task.id}`,
            x1,
            y1,
            x2,
            y2,
            type: pred.type,
          });
        });
      }
    });

    return lines;
  }, [tasks, taskPositionMap, headerHeight, rowHeight, labelColumnWidth]);

  // Dragging link line
  const linkDragLine = useMemo(() => {
    if (!linkDragState) return null;
    
    const sourceInfo = taskPositionMap.get(linkDragState.sourceTaskId);
    if (!sourceInfo) return null;

    const x1 = linkDragState.sourceType === 'end'
      ? labelColumnWidth + sourceInfo.position.left + sourceInfo.position.width
      : labelColumnWidth + sourceInfo.position.left;
    const y1 = headerHeight + sourceInfo.rowIndex * rowHeight + rowHeight / 2;

    return { x1, y1, x2: linkDragState.currentX, y2: linkDragState.currentY };
  }, [linkDragState, taskPositionMap, labelColumnWidth, headerHeight, rowHeight]);

  const handleTaskClick = (e: React.MouseEvent, task: ScheduleTask) => {
    // Only trigger click if we didn't drag
    if (!hasDragged.current && !dragState) {
      onTaskClick?.(task);
    }
  };

  return (
    <Card>
      <CardContent className="p-4">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">
              {format(baseDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              <Link2 className="inline h-3 w-3 mr-1" />
              Drag from circle handles to create predecessor links
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="w-full">
          <div 
            ref={containerRef}
            className="flex relative" 
            style={{ 
              minWidth: days.length * dayWidth + labelColumnWidth,
              cursor: dragState ? (dragState.type === 'move' ? 'grabbing' : 'ew-resize') : linkDragState ? 'crosshair' : 'default',
            }}
          >
            {/* Task Labels Column */}
            <div className="w-[200px] shrink-0 border-r bg-muted/30 z-10">
              {/* Header spacer */}
              <div className="h-[60px] border-b flex items-end pb-2 px-3">
                <span className="text-sm font-medium text-muted-foreground">Tasks</span>
              </div>
              
              {/* Task Names */}
              {tasksByJob.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Job Header */}
                  <div 
                    className="h-[44px] border-b bg-muted/50 flex items-center px-3"
                    style={{ height: rowHeight }}
                  >
                    <Badge variant="secondary" className="text-xs">
                      {group.jobName}
                    </Badge>
                  </div>
                  
                  {/* Tasks in job */}
                  {group.tasks.map(task => (
                    <div 
                      key={task.id}
                      className="border-b flex items-center px-3 hover:bg-muted/50 cursor-pointer gap-2"
                      style={{ height: rowHeight }}
                      onClick={(e) => handleTaskClick(e, task)}
                    >
                      {task.critical_path && (
                        <Badge variant="destructive" className="h-4 text-[10px] px-1">CP</Badge>
                      )}
                      <span className="text-sm truncate flex-1">{task.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Gantt Chart Area */}
            <div className="flex-1 overflow-x-auto relative">
              {/* SVG layer for dependency lines */}
              <svg 
                className="absolute inset-0 pointer-events-none z-20"
                style={{ 
                  width: days.length * dayWidth + labelColumnWidth, 
                  height: headerHeight + totalRows * rowHeight 
                }}
              >
                <defs>
                  <marker
                    id="arrowhead-fs"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--muted-foreground))" />
                  </marker>
                  <marker
                    id="arrowhead-ss"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
                  </marker>
                </defs>
                {dependencyLines.map(line => {
                  const isFS = line.type === 'FS';
                  return (
                    <g key={line.id}>
                      <path
                        d={`M ${line.x1} ${line.y1} 
                            C ${line.x1 + 20} ${line.y1}, 
                              ${line.x2 - 20} ${line.y2}, 
                              ${line.x2 - 6} ${line.y2}`}
                        fill="none"
                        stroke={isFS ? "hsl(var(--muted-foreground))" : "#3b82f6"}
                        strokeWidth="1.5"
                        strokeDasharray={isFS ? "4 2" : "none"}
                        markerEnd={isFS ? "url(#arrowhead-fs)" : "url(#arrowhead-ss)"}
                        opacity="0.6"
                      />
                    </g>
                  );
                })}
                {/* Dragging link line */}
                {linkDragLine && (
                  <path
                    d={`M ${linkDragLine.x1} ${linkDragLine.y1} L ${linkDragLine.x2} ${linkDragLine.y2}`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    opacity="0.8"
                  />
                )}
              </svg>

              {/* Date Headers */}
              <div className="flex border-b" style={{ height: headerHeight }}>
                {days.map((day, index) => {
                  const isWeekStart = day.getDay() === 0;
                  const isToday = isSameDay(day, today);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  
                  return (
                    <div 
                      key={index}
                      className={`shrink-0 text-center border-r ${isWeekend ? 'bg-muted/30' : ''} ${isToday ? 'bg-primary/10' : ''}`}
                      style={{ width: dayWidth }}
                    >
                      {isWeekStart && (
                        <div className="text-xs text-muted-foreground pt-1">
                          {format(day, 'MMM')}
                        </div>
                      )}
                      <div className={`text-xs ${isToday ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-sm ${isToday ? 'font-bold text-primary' : ''}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Task Bars */}
              {tasksByJob.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {/* Job spacer row */}
                  <div 
                    className="flex border-b bg-muted/50"
                    style={{ height: rowHeight }}
                  >
                    {days.map((day, dayIndex) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = isSameDay(day, today);
                      return (
                        <div 
                          key={dayIndex}
                          className={`shrink-0 border-r ${isWeekend ? 'bg-muted/30' : ''} ${isToday ? 'bg-primary/5' : ''}`}
                          style={{ width: dayWidth }}
                        />
                      );
                    })}
                  </div>
                  
                  {/* Task rows */}
                  {group.tasks.map(task => {
                    const position = getTaskPosition(task, true);
                    const isDragging = dragState?.taskId === task.id;
                    const isLinkTarget = linkDragState && linkDragState.sourceTaskId !== task.id;
                    
                    return (
                      <div 
                        key={task.id}
                        className={`relative flex border-b ${isLinkTarget ? 'bg-blue-50/50' : ''}`}
                        style={{ height: rowHeight }}
                        onMouseUp={() => isLinkTarget && handleLinkDrop(task)}
                      >
                        {/* Grid background */}
                        {days.map((day, dayIndex) => {
                          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                          const isToday = isSameDay(day, today);
                          return (
                            <div 
                              key={dayIndex}
                              className={`shrink-0 border-r ${isWeekend ? 'bg-muted/30' : ''} ${isToday ? 'bg-primary/5' : ''}`}
                              style={{ width: dayWidth }}
                            />
                          );
                        })}
                        
                        {/* Task Bar */}
                        {position.isVisible && (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <div
                                className={`absolute top-1.5 rounded-md transition-shadow flex items-center text-xs text-white font-medium overflow-hidden group ${
                                  isDragging ? 'shadow-lg z-30 opacity-90' : 'hover:shadow-md'
                                } ${task.critical_path ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                                style={{
                                  left: position.left,
                                  width: position.width - 4,
                                  height: taskHeight,
                                  backgroundColor: task.color,
                                  cursor: dragState ? 'inherit' : 'grab',
                                }}
                                onMouseDown={(e) => handleMouseDown(e, task, 'move')}
                                onClick={(e) => handleTaskClick(e, task)}
                              >
                                {/* Link handle - start (for SS) */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair z-10"
                                        onMouseDown={(e) => handleLinkDragStart(e, task, 'start')}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      Drag for Start-to-Start link
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                
                                {/* Resize handle - start */}
                                <div
                                  className="absolute left-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20"
                                  onMouseDown={(e) => handleMouseDown(e, task, 'resize-start')}
                                />
                                
                                {/* Task content */}
                                <div className="flex-1 px-2 truncate">
                                  {position.width > 60 && (
                                    <span className="truncate">{task.name}</span>
                                  )}
                                </div>
                                
                                {/* Progress indicator */}
                                {task.percent_complete > 0 && (
                                  <div 
                                    className="absolute bottom-0 left-0 h-1 bg-white/40"
                                    style={{ width: `${task.percent_complete}%` }}
                                  />
                                )}
                                
                                {/* Resize handle - end */}
                                <div
                                  className="absolute right-0 top-0 w-2 h-full cursor-ew-resize opacity-0 group-hover:opacity-100 bg-black/20"
                                  onMouseDown={(e) => handleMouseDown(e, task, 'resize-end')}
                                />
                                
                                {/* Link handle - end (for FS) */}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-gray-500 border-2 border-white opacity-0 group-hover:opacity-100 cursor-crosshair z-10"
                                        onMouseDown={(e) => handleLinkDragStart(e, task, 'end')}
                                      />
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="text-xs">
                                      Drag for Finish-to-Start link
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {/* Confirmed indicator */}
                                {task.confirmed_at && (
                                  <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
                                )}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleConfirmTask(task)}>
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {task.confirmed_at ? 'Remove Confirmation' : 'Mark as Confirmed'}
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              {task.predecessors && task.predecessors.length > 0 && (
                                <>
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">Predecessors:</div>
                                  {task.predecessors.map(pred => {
                                    const predTask = tasks.find(t => t.id === pred.task_id);
                                    return predTask ? (
                                      <ContextMenuItem 
                                        key={pred.task_id}
                                        onClick={() => handleRemovePredecessor(task, pred.task_id)}
                                      >
                                        <Badge variant="outline" className="text-xs mr-2">{pred.type}</Badge>
                                        {predTask.name}
                                        <span className="ml-auto text-destructive text-xs">Remove</span>
                                      </ContextMenuItem>
                                    ) : null;
                                  })}
                                  <ContextMenuSeparator />
                                </>
                              )}
                              <ContextMenuItem onClick={() => onEdit?.(task)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Task
                              </ContextMenuItem>
                              <ContextMenuItem 
                                onClick={() => onDelete?.(task)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Task
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Today line */}
              {days.some(day => isSameDay(day, today)) && (
                <div
                  className="absolute top-0 w-0.5 bg-primary z-10"
                  style={{
                    left: differenceInDays(today, baseDate) * dayWidth + dayWidth / 2,
                    height: headerHeight + totalRows * rowHeight,
                  }}
                />
              )}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-muted-foreground" style={{ borderStyle: 'dashed', borderWidth: '1px 0 0 0' }} />
            <span>FS (Finish-to-Start)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-0.5 bg-blue-500" />
            <span>SS (Start-to-Start)</span>
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="destructive" className="h-4 text-[10px] px-1">CP</Badge>
            <span>Critical Path</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}