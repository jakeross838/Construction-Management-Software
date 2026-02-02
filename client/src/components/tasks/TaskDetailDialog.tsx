import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  Building2,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Send,
} from 'lucide-react';
import {
  Task,
  useTask,
  useCompleteTask,
  useReopenTask,
  useDeleteTask,
  useAddChecklistItem,
  useToggleChecklistItem,
  useDeleteChecklistItem,
  useAddComment,
  useDeleteComment,
  taskPriorityConfig,
  taskStatusConfig,
} from '@/hooks/useTasks';
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

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  onEdit?: (task: Task) => void;
}

export function TaskDetailDialog({
  open,
  onOpenChange,
  taskId,
  onEdit,
}: TaskDetailDialogProps) {
  const { data: task, isLoading } = useTask(taskId || '');
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const deleteTask = useDeleteTask();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newComment, setNewComment] = useState('');

  const addChecklistItem = useAddChecklistItem();
  const toggleChecklistItem = useToggleChecklistItem();
  const deleteChecklistItem = useDeleteChecklistItem();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();

  if (!taskId) return null;

  const handleComplete = async () => {
    if (task) {
      await completeTask.mutateAsync(task.id);
    }
  };

  const handleReopen = async () => {
    if (task) {
      await reopenTask.mutateAsync(task.id);
    }
  };

  const handleDelete = async () => {
    if (task) {
      await deleteTask.mutateAsync(task.id);
      onOpenChange(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (task && newChecklistItem.trim()) {
      await addChecklistItem.mutateAsync({
        taskId: task.id,
        description: newChecklistItem.trim(),
      });
      setNewChecklistItem('');
    }
  };

  const handleToggleChecklistItem = async (checklistId: string, isCompleted: boolean) => {
    if (task) {
      await toggleChecklistItem.mutateAsync({
        taskId: task.id,
        checklistId,
        isCompleted: !isCompleted,
      });
    }
  };

  const handleDeleteChecklistItem = async (checklistId: string) => {
    if (task) {
      await deleteChecklistItem.mutateAsync({
        taskId: task.id,
        checklistId,
      });
    }
  };

  const handleAddComment = async () => {
    if (task && newComment.trim()) {
      await addComment.mutateAsync({
        taskId: task.id,
        content: newComment.trim(),
      });
      setNewComment('');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (task) {
      await deleteComment.mutateAsync({
        taskId: task.id,
        commentId,
      });
    }
  };

  const isOverdue = task?.status !== 'completed' &&
    task?.status !== 'cancelled' &&
    task?.due_date &&
    new Date(task.due_date) < new Date();

  const checklistProgress = task?.checklists?.length
    ? Math.round((task.checklists.filter(c => c.is_completed).length / task.checklists.length) * 100)
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <span>{task?.task_number}</span>
                  {task?.job && (
                    <>
                      <span>/</span>
                      <span>{task.job.name}</span>
                    </>
                  )}
                </div>
                <DialogTitle className="text-xl">
                  {isLoading ? 'Loading...' : task?.title}
                </DialogTitle>
              </div>
              <div className="flex items-center gap-2">
                {task && (
                  <>
                    <Badge
                      variant="outline"
                      className={taskStatusConfig[task.status]?.color}
                    >
                      {taskStatusConfig[task.status]?.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={taskPriorityConfig[task.priority]?.color}
                    >
                      {taskPriorityConfig[task.priority]?.label}
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : task ? (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Action Buttons */}
              <div className="flex items-center gap-2 py-2">
                {task.status === 'completed' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReopen}
                    disabled={reopenTask.isPending}
                  >
                    {reopenTask.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleComplete}
                    disabled={completeTask.isPending}
                  >
                    {completeTask.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Complete
                  </Button>
                )}
                {onEdit && (
                  <Button variant="outline" size="sm" onClick={() => onEdit(task)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>

              <Separator className="my-2" />

              {/* Task Details */}
              <ScrollArea className="flex-1">
                <div className="space-y-4 pr-4">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {task.assigned_to && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{task.assigned_to}</span>
                      </div>
                    )}
                    {task.job && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{task.job.name}</span>
                      </div>
                    )}
                    {task.due_date && (
                      <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-500' : ''}`}>
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {task.estimated_hours && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{task.estimated_hours}h estimated</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {task.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {task.description}
                      </p>
                    </div>
                  )}

                  {/* Tabs for Checklists, Comments, Attachments */}
                  <Tabs defaultValue="checklists" className="mt-4">
                    <TabsList>
                      <TabsTrigger value="checklists" className="gap-2">
                        <CheckSquare className="h-4 w-4" />
                        Checklist
                        {task.checklists && task.checklists.length > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {task.checklists.filter(c => c.is_completed).length}/{task.checklists.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="comments" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comments
                        {task.comments && task.comments.length > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {task.comments.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger value="attachments" className="gap-2">
                        <Paperclip className="h-4 w-4" />
                        Files
                        {task.attachments && task.attachments.length > 0 && (
                          <Badge variant="secondary" className="ml-1">
                            {task.attachments.length}
                          </Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    {/* Checklists Tab */}
                    <TabsContent value="checklists" className="mt-4">
                      {task.checklists && task.checklists.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 transition-all"
                                style={{ width: `${checklistProgress}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {checklistProgress}%
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {task.checklists?.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 group"
                          >
                            <Checkbox
                              checked={item.is_completed}
                              onCheckedChange={() =>
                                handleToggleChecklistItem(item.id, item.is_completed)
                              }
                            />
                            <span
                              className={`flex-1 text-sm ${
                                item.is_completed
                                  ? 'line-through text-muted-foreground'
                                  : ''
                              }`}
                            >
                              {item.description}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => handleDeleteChecklistItem(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}

                        {/* Add Checklist Item */}
                        <div className="flex items-center gap-2 mt-4">
                          <Input
                            placeholder="Add checklist item..."
                            value={newChecklistItem}
                            onChange={(e) => setNewChecklistItem(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddChecklistItem();
                              }
                            }}
                          />
                          <Button
                            size="icon"
                            onClick={handleAddChecklistItem}
                            disabled={!newChecklistItem.trim() || addChecklistItem.isPending}
                          >
                            {addChecklistItem.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Comments Tab */}
                    <TabsContent value="comments" className="mt-4">
                      <div className="space-y-4">
                        {task.comments?.map((comment) => (
                          <div
                            key={comment.id}
                            className="p-3 rounded-lg bg-muted group"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">
                                {comment.author || 'Unknown'}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {new Date(comment.created_at).toLocaleString()}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                  onClick={() => handleDeleteComment(comment.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        ))}

                        {(!task.comments || task.comments.length === 0) && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No comments yet
                          </p>
                        )}

                        {/* Add Comment */}
                        <div className="flex gap-2 mt-4">
                          <Textarea
                            placeholder="Add a comment..."
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            className="min-h-[60px]"
                          />
                          <Button
                            onClick={handleAddComment}
                            disabled={!newComment.trim() || addComment.isPending}
                          >
                            {addComment.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    {/* Attachments Tab */}
                    <TabsContent value="attachments" className="mt-4">
                      {task.attachments && task.attachments.length > 0 ? (
                        <div className="space-y-2">
                          {task.attachments.map((attachment) => (
                            <div
                              key={attachment.id}
                              className="flex items-center gap-3 p-3 rounded-lg border"
                            >
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <a
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium hover:underline truncate block"
                                >
                                  {attachment.name}
                                </a>
                                <p className="text-xs text-muted-foreground">
                                  {attachment.file_type} - Uploaded by {attachment.uploaded_by}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No attachments
                        </p>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Notes */}
                  {task.notes && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {task.notes}
                      </p>
                    </div>
                  )}

                  {/* Subtasks */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Subtasks</h4>
                      <div className="space-y-2">
                        {task.subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center gap-2 p-2 rounded-lg border"
                          >
                            <Checkbox checked={subtask.status === 'completed'} disabled />
                            <span
                              className={`text-sm ${
                                subtask.status === 'completed'
                                  ? 'line-through text-muted-foreground'
                                  : ''
                              }`}
                            >
                              {subtask.title}
                            </span>
                            <Badge variant="outline" className="ml-auto">
                              {taskStatusConfig[subtask.status]?.label}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Task not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
