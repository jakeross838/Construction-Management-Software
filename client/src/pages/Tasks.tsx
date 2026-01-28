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
  Filter,
} from 'lucide-react';
import { jobs } from '@/data/mockData';
import { useJob } from '@/contexts/JobContext';

type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
type TaskStatus = 'todo' | 'in_progress' | 'completed';

interface Task {
  id: string;
  jobId: string;
  title: string;
  description?: string;
  assignee?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;
  createdAt: string;
}

const tasks: Task[] = [
  { id: '1', jobId: '1', title: 'Schedule framing inspection', assignee: 'Mike Johnson', priority: 'high', status: 'todo', dueDate: '2026-01-25', createdAt: '2026-01-20' },
  { id: '2', jobId: '1', title: 'Order roof trusses', assignee: 'Tom Smith', priority: 'urgent', status: 'in_progress', dueDate: '2026-01-23', createdAt: '2026-01-18' },
  { id: '3', jobId: '1', title: 'Submit electrical permit', assignee: 'Sarah Chen', priority: 'medium', status: 'completed', dueDate: '2026-01-20', createdAt: '2026-01-15' },
  { id: '4', jobId: '2', title: 'Coordinate cabinet delivery', assignee: 'Mike Johnson', priority: 'high', status: 'in_progress', dueDate: '2026-01-28', createdAt: '2026-01-19' },
  { id: '5', jobId: '2', title: 'Final paint touch-ups', assignee: 'Carlos Rodriguez', priority: 'medium', status: 'todo', dueDate: '2026-02-01', createdAt: '2026-01-22' },
  { id: '6', jobId: '1', title: 'Review change order CO-003', assignee: 'Jake Ross', priority: 'high', status: 'todo', dueDate: '2026-01-24', createdAt: '2026-01-21' },
  { id: '7', jobId: '3', title: 'Finalize permit drawings', assignee: 'Sarah Chen', priority: 'medium', status: 'in_progress', dueDate: '2026-01-30', createdAt: '2026-01-18' },
  { id: '8', jobId: '4', title: 'Complete punch list walkthrough', assignee: 'Carlos Rodriguez', priority: 'urgent', status: 'todo', dueDate: '2026-01-24', createdAt: '2026-01-20' },
];

const priorityConfig: Record<TaskPriority, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-500' },
  medium: { label: 'Medium', color: 'bg-blue-500' },
  high: { label: 'High', color: 'bg-amber-500' },
  urgent: { label: 'Urgent', color: 'bg-red-500' },
};

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  todo: { label: 'To Do', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'outline' },
  completed: { label: 'Completed', variant: 'default' },
};

const Tasks = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesJob = !selectedJobId || task.jobId === selectedJobId;
      const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
      const matchesSearch = !searchQuery.trim() || 
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.assignee?.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesJob && matchesStatus && matchesSearch;
    });
  }, [searchQuery, selectedJobId, statusFilter]);

  const stats = useMemo(() => {
    const overdue = tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date());
    return {
      total: tasks.length,
      todo: tasks.filter(t => t.status === 'todo').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: overdue.length,
    };
  }, []);

  const groupedTasks = useMemo(() => {
    return {
      todo: filteredTasks.filter(t => t.status === 'todo'),
      in_progress: filteredTasks.filter(t => t.status === 'in_progress'),
      completed: filteredTasks.filter(t => t.status === 'completed'),
    };
  }, [filteredTasks]);

  const getJobName = (jobId: string) => jobs.find(j => j.id === jobId)?.name || 'Unknown';

  const isOverdue = (task: Task) => task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage project tasks and to-dos</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-gray-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">To Do</p>
                  <p className="text-2xl font-semibold">{stats.todo}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-semibold">{stats.inProgress}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                  <p className="text-2xl font-semibold">{stats.overdue}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-semibold">{stats.completed}</p>
                </div>
                <CheckSquare className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
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
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Board */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* To Do Column */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-gray-500" />
                To Do
                <Badge variant="secondary" className="ml-auto">{groupedTasks.todo.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupedTasks.todo.map((task) => (
                <TaskCard key={task.id} task={task} getJobName={getJobName} isOverdue={isOverdue(task)} />
              ))}
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
            <CardContent className="space-y-2">
              {groupedTasks.in_progress.map((task) => (
                <TaskCard key={task.id} task={task} getJobName={getJobName} isOverdue={isOverdue(task)} />
              ))}
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
            <CardContent className="space-y-2">
              {groupedTasks.completed.map((task) => (
                <TaskCard key={task.id} task={task} getJobName={getJobName} isOverdue={false} />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

interface TaskCardProps {
  task: Task;
  getJobName: (jobId: string) => string;
  isOverdue: boolean;
}

function TaskCard({ task, getJobName, isOverdue }: TaskCardProps) {
  return (
    <div className={`p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer ${isOverdue ? 'border-red-300 bg-red-50 dark:bg-red-900/10' : ''}`}>
      <div className="flex items-start gap-2">
        <Checkbox className="mt-1" checked={task.status === 'completed'} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className="text-xs">{getJobName(task.jobId)}</Badge>
            <div className={`h-1.5 w-1.5 rounded-full ${priorityConfig[task.priority].color}`} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {task.assignee && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{task.assignee}</span>
              </div>
            )}
            {task.dueDate && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : ''}`}>
                <Calendar className="h-3 w-3" />
                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tasks;
