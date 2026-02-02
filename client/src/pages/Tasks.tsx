import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  CheckSquare,
  Clock,
  AlertCircle,
  User,
  Calendar,
  Loader2,
  Filter,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { CompactStats } from '@/components/ui/compact-stats';
import {
  useTasks,
  useTaskStats,
  useUpdateTask,
  Task,
  TaskPriority,
  taskPriorityConfig,
} from '@/hooks/useTasks';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { useEmployees } from '@/hooks/useEmployees';

const Tasks = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Fetch tasks with filters
  const { data: tasks = [], isLoading, error } = useTasks({
    job_id: selectedJobId || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
    assigned_to: assigneeFilter !== 'all' ? assigneeFilter : undefined,
  });

  // Fetch stats
  const { data: stats } = useTaskStats(selectedJobId || undefined);

  // Fetch employees for filter
  const { data: employees } = useEmployees();

  // Mutation for updating tasks
  const updateTask = useUpdateTask();

  // Get unique assignees from tasks
  const assignees = useMemo(() => {
    const uniqueAssignees = new Set<string>();
    tasks.forEach(task => {
      if (task.assigned_to) {
        uniqueAssignees.add(task.assigned_to);
      }
    });
    return Array.from(uniqueAssignees).sort();
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(task =>
      task.title?.toLowerCase().includes(query) ||
      task.assigned_to?.toLowerCase().includes(query) ||
      task.task_number?.toLowerCase().includes(query) ||
      task.description?.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const displayStats = useMemo(() => ({
    todo: stats?.todo || 0,
    inProgress: stats?.in_progress || 0,
    overdue: stats?.overdue || 0,
    completed: stats?.completed || 0,
  }), [stats]);

  const groupedTasks = useMemo(() => ({
    todo: filteredTasks.filter(t => t.status === 'todo'),
    in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
    on_hold: filteredTasks.filter(t => t.status === 'on_hold'),
    completed: filteredTasks.filter(t => t.status === 'completed'),
  }), [filteredTasks]);

  const isOverdue = (task: Task) =>
    task.status !== 'completed' &&
    task.status !== 'cancelled' &&
    task.due_date &&
    new Date(task.due_date) < new Date();

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    updateTask.mutate({ id: task.id, updates: { status: newStatus } });
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
    setDetailDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setDetailDialogOpen(false);
    setFormDialogOpen(true);
  };

  const handleNewTask = () => {
    setSelectedTask(null);
    setFormDialogOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormDialogOpen(open);
    if (!open) {
      setSelectedTask(null);
    }
  };

  const handleDetailClose = (open: boolean) => {
    setDetailDialogOpen(open);
    if (!open) {
      setSelectedTaskId(null);
    }
  };

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load tasks</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage project tasks and to-dos</p>
          </div>
          <Button className="gap-2" onClick={handleNewTask}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">To Do</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="on_hold">On Hold</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                {(Object.keys(taskPriorityConfig) as TaskPriority[]).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${taskPriorityConfig[priority].bgColor}`} />
                      {taskPriorityConfig[priority].label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {assignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CompactStats
            stats={[
              { label: 'To Do', value: displayStats.todo, icon: CheckSquare, color: 'default' },
              { label: 'In Progress', value: displayStats.inProgress, icon: Clock, color: 'blue' },
              { label: 'Overdue', value: displayStats.overdue, icon: AlertCircle, color: 'red' },
              { label: 'Completed', value: displayStats.completed, icon: CheckSquare, color: 'green' },
            ]}
          />
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          /* Kanban Board */
          <div className="grid gap-4 lg:grid-cols-4">
            {/* To Do Column */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-gray-500" />
                  To Do
                  <Badge variant="secondary" className="ml-auto">{groupedTasks.todo.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {groupedTasks.todo.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
                ) : (
                  groupedTasks.todo.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdue(task)}
                      onToggleComplete={handleToggleComplete}
                      onClick={handleTaskClick}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* In Progress Column */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  In Progress
                  <Badge variant="secondary" className="ml-auto">{groupedTasks.in_progress.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {groupedTasks.in_progress.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
                ) : (
                  groupedTasks.in_progress.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdue(task)}
                      onToggleComplete={handleToggleComplete}
                      onClick={handleTaskClick}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* On Hold Column */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500" />
                  On Hold
                  <Badge variant="secondary" className="ml-auto">{groupedTasks.on_hold.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {groupedTasks.on_hold.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
                ) : (
                  groupedTasks.on_hold.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={isOverdue(task)}
                      onToggleComplete={handleToggleComplete}
                      onClick={handleTaskClick}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            {/* Completed Column */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  Completed
                  <Badge variant="secondary" className="ml-auto">{groupedTasks.completed.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
                {groupedTasks.completed.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No tasks</p>
                ) : (
                  groupedTasks.completed.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOverdue={false}
                      onToggleComplete={handleToggleComplete}
                      onClick={handleTaskClick}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Task Form Dialog */}
      <TaskFormDialog
        open={formDialogOpen}
        onOpenChange={handleFormClose}
        task={selectedTask}
        defaultJobId={selectedJobId || undefined}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        open={detailDialogOpen}
        onOpenChange={handleDetailClose}
        taskId={selectedTaskId}
        onEdit={handleEditTask}
      />
    </AppLayout>
  );
};

interface TaskCardProps {
  task: Task;
  isOverdue: boolean;
  onToggleComplete: (task: Task, e: React.MouseEvent) => void;
  onClick: (task: Task) => void;
}

function TaskCard({ task, isOverdue, onToggleComplete, onClick }: TaskCardProps) {
  return (
    <div
      className={`p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}`}
      onClick={() => onClick(task)}
    >
      <div className="flex items-start gap-2">
        <Checkbox
          className="mt-1"
          checked={task.status === 'completed'}
          onCheckedChange={() => {}}
          onClick={(e) => onToggleComplete(task, e)}
        />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {task.job && (
              <Badge variant="outline" className="text-xs">{task.job.name}</Badge>
            )}
            <div className={`h-1.5 w-1.5 rounded-full ${taskPriorityConfig[task.priority]?.bgColor || 'bg-blue-500'}`} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {task.assigned_to && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[100px]">{task.assigned_to}</span>
              </div>
            )}
            {task.due_date && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                <Calendar className="h-3 w-3" />
                <span>{new Date(task.due_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tasks;
