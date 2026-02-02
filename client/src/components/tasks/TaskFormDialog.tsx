import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useJobs } from '@/hooks/useJobs';
import { useEmployees } from '@/hooks/useEmployees';
import {
  Task,
  TaskPriority,
  TaskType,
  TaskStatus,
  useCreateTask,
  useUpdateTask,
  taskPriorityConfig,
  taskStatusConfig,
  taskTypeConfig,
  taskCategoryOptions,
} from '@/hooks/useTasks';

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  job_id: z.string().optional(),
  type: z.enum(['task', 'milestone', 'checklist', 'reminder']).default('task'),
  category: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  status: z.enum(['todo', 'in_progress', 'on_hold', 'completed', 'cancelled']).default('todo'),
  assigned_to: z.string().optional(),
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  estimated_hours: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
  defaultJobId?: string;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultJobId,
}: TaskFormDialogProps) {
  const isEditing = !!task;
  const { data: jobs } = useJobs();
  const { data: employees } = useEmployees();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      job_id: defaultJobId || '',
      type: 'task',
      category: '',
      priority: 'normal',
      status: 'todo',
      assigned_to: '',
      due_date: '',
      start_date: '',
      estimated_hours: undefined,
      notes: '',
    },
  });

  // Reset form when dialog opens or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        form.reset({
          title: task.title,
          description: task.description || '',
          job_id: task.job_id || '',
          type: task.type,
          category: task.category || '',
          priority: task.priority,
          status: task.status,
          assigned_to: task.assigned_to || '',
          due_date: task.due_date || '',
          start_date: task.start_date || '',
          estimated_hours: task.estimated_hours ?? undefined,
          notes: task.notes || '',
        });
      } else {
        form.reset({
          title: '',
          description: '',
          job_id: defaultJobId || '',
          type: 'task',
          category: '',
          priority: 'normal',
          status: 'todo',
          assigned_to: '',
          due_date: '',
          start_date: '',
          estimated_hours: undefined,
          notes: '',
        });
      }
    }
  }, [open, task, defaultJobId, form]);

  const onSubmit = async (data: TaskFormData) => {
    try {
      // Clean up empty strings to undefined
      const cleanData = {
        ...data,
        job_id: data.job_id || undefined,
        category: data.category || undefined,
        assigned_to: data.assigned_to || undefined,
        due_date: data.due_date || undefined,
        start_date: data.start_date || undefined,
        notes: data.notes || undefined,
      };

      if (isEditing && task) {
        await updateTask.mutateAsync({ id: task.id, updates: cleanData });
      } else {
        await createTask.mutateAsync(cleanData);
      }
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  const isSubmitting = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {isEditing ? `Edit Task ${task.task_number}` : 'Create Task'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="py-4 space-y-6">
                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Task title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Task description..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Job and Type */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="job_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Job</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select job (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No Job</SelectItem>
                            {jobs?.map((job) => (
                              <SelectItem key={job.id} value={job.id}>
                                {job.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(Object.keys(taskTypeConfig) as TaskType[]).map((type) => (
                              <SelectItem key={type} value={type}>
                                {taskTypeConfig[type].label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Priority and Status */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isEditing && (
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {(Object.keys(taskStatusConfig) as TaskStatus[]).map((status) => (
                                <SelectItem key={status} value={status}>
                                  <div className="flex items-center gap-2">
                                    <div className={`h-2 w-2 rounded-full ${taskStatusConfig[status].bgColor}`} />
                                    {taskStatusConfig[status].label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                {/* Category and Assignment */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">No Category</SelectItem>
                            {taskCategoryOptions.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category.charAt(0).toUpperCase() + category.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assigned To</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ''}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select assignee" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {employees?.map((employee) => (
                              <SelectItem key={employee.id} value={`${employee.first_name} ${employee.last_name}`}>
                                {employee.first_name} {employee.last_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="start_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Estimated Hours */}
                <FormField
                  control={form.control}
                  name="estimated_hours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Hours</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes */}
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Additional notes..."
                          className="resize-none"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>

            <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Update Task' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
