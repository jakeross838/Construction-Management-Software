import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  MessageSquare,
  Clock,
  Calendar,
  User,
  DollarSign,
  AlertTriangle,
  FileText,
  Send,
  Pencil,
  Trash2,
  XCircle,
  CheckCircle,
  Loader2,
  Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  RFI,
  useRFI,
  useRespondToRFI,
  useCloseRFI,
  useReopenRFI,
  useDeleteRFI,
  rfiStatusConfig,
  rfiPriorityConfig,
} from '@/hooks/useRFIs';

interface RFIDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rfiId: string | null;
  onEdit?: (rfi: RFI) => void;
}

export function RFIDetailDialog({
  open,
  onOpenChange,
  rfiId,
  onEdit,
}: RFIDetailDialogProps) {
  const { data: rfi, isLoading } = useRFI(rfiId);
  const [responseText, setResponseText] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const respondMutation = useRespondToRFI();
  const closeMutation = useCloseRFI();
  const reopenMutation = useReopenRFI();
  const deleteMutation = useDeleteRFI();

  const handleSendResponse = async () => {
    if (!rfiId || !responseText.trim()) return;
    await respondMutation.mutateAsync({
      id: rfiId,
      content: responseText.trim(),
      response_type: 'response',
    });
    setResponseText('');
  };

  const handleClose = async () => {
    if (!rfiId) return;
    await closeMutation.mutateAsync(rfiId);
  };

  const handleReopen = async () => {
    if (!rfiId) return;
    await reopenMutation.mutateAsync(rfiId);
  };

  const handleDelete = async () => {
    if (!rfiId) return;
    await deleteMutation.mutateAsync(rfiId);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (!rfiId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rfi ? (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">
                        {rfi.rfi_number}
                      </Badge>
                      <Badge
                        className={cn(
                          rfiStatusConfig[rfi.status].bgColor,
                          rfiStatusConfig[rfi.status].color,
                          'border-0'
                        )}
                      >
                        {rfiStatusConfig[rfi.status].label}
                      </Badge>
                      <Badge
                        className={cn(
                          rfiPriorityConfig[rfi.priority].bgColor,
                          rfiPriorityConfig[rfi.priority].color,
                          'border-0'
                        )}
                      >
                        {rfiPriorityConfig[rfi.priority].label}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">{rfi.subject}</DialogTitle>
                    {rfi.job && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {rfi.job.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {rfi.status !== 'closed' && onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(rfi)}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-6">
                  {/* Question */}
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Question</span>
                    </div>
                    <p className="whitespace-pre-wrap">{rfi.question}</p>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        Submitted By
                      </div>
                      <p className="text-sm font-medium">
                        {rfi.submitted_by || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        Assigned To
                      </div>
                      <p className="text-sm font-medium">
                        {rfi.assigned_to || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Due Date
                      </div>
                      <p className="text-sm font-medium">
                        {formatDate(rfi.due_date)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Date Required
                      </div>
                      <p className="text-sm font-medium">
                        {formatDate(rfi.date_required)}
                      </p>
                    </div>
                  </div>

                  {/* References */}
                  {(rfi.reference_drawings || rfi.reference_specs) && (
                    <div className="grid grid-cols-2 gap-4">
                      {rfi.reference_drawings && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            Reference Drawings
                          </div>
                          <p className="text-sm">{rfi.reference_drawings}</p>
                        </div>
                      )}
                      {rfi.reference_specs && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <FileText className="h-3 w-3" />
                            Reference Specs
                          </div>
                          <p className="text-sm">{rfi.reference_specs}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Impact */}
                  {(rfi.cost_impact || rfi.schedule_impact_days) && (
                    <div className="flex items-center gap-4 p-3 border rounded-lg bg-orange-50/50">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      <div className="flex gap-6">
                        {rfi.cost_impact && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              ${rfi.cost_impact.toLocaleString()}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              cost impact
                            </span>
                          </div>
                        )}
                        {rfi.schedule_impact_days && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {rfi.schedule_impact_days} days
                            </span>
                            <span className="text-sm text-muted-foreground">
                              schedule impact
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* Response */}
                  {rfi.response ? (
                    <div className="bg-green-50/50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span>Response from {rfi.responded_by}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(rfi.responded_at)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{rfi.response}</p>
                    </div>
                  ) : rfi.status !== 'closed' ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        <span>Add Response</span>
                      </div>
                      <Textarea
                        placeholder="Type your response..."
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        className="min-h-[100px]"
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSendResponse}
                          disabled={!responseText.trim() || respondMutation.isPending}
                        >
                          {respondMutation.isPending && (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          )}
                          <Send className="h-4 w-4 mr-2" />
                          Send Response
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {/* Response History */}
                  {rfi.responses && rfi.responses.length > 1 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Response History</h4>
                      <div className="space-y-3">
                        {rfi.responses.map((response) => (
                          <div
                            key={response.id}
                            className="bg-muted/30 rounded-lg p-3 text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{response.responded_by}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(response.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap">{response.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {rfi.attachments && rfi.attachments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Attachments
                      </h4>
                      <div className="space-y-2">
                        {rfi.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 border rounded hover:bg-muted/40"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{attachment.name}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {rfi.notes && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {rfi.notes}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Created {formatDateTime(rfi.created_at)}
                </div>
                <div className="flex gap-2">
                  {rfi.status === 'closed' ? (
                    <Button
                      variant="outline"
                      onClick={handleReopen}
                      disabled={reopenMutation.isPending}
                    >
                      {reopenMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Reopen RFI
                    </Button>
                  ) : rfi.status === 'answered' ? (
                    <Button
                      onClick={handleClose}
                      disabled={closeMutation.isPending}
                    >
                      {closeMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <XCircle className="h-4 w-4 mr-2" />
                      Close RFI
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              RFI not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete RFI</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this RFI? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
