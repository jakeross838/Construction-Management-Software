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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Clock,
  Calendar,
  User,
  Building2,
  Factory,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Pencil,
  Trash2,
  Loader2,
  Paperclip,
  RefreshCw,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Submittal,
  useSubmittal,
  useSubmitForReview,
  useReviewSubmittal,
  useReviseSubmittal,
  useDeleteSubmittal,
  submittalStatusConfig,
  submittalTypeConfig,
} from '@/hooks/useSubmittals';

interface SubmittalDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submittalId: string | null;
  onEdit?: (submittal: Submittal) => void;
}

export function SubmittalDetailDialog({
  open,
  onOpenChange,
  submittalId,
  onEdit,
}: SubmittalDetailDialogProps) {
  const { data: submittal, isLoading } = useSubmittal(submittalId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<string>('approved');
  const [reviewComments, setReviewComments] = useState('');

  const submitMutation = useSubmitForReview();
  const reviewMutation = useReviewSubmittal();
  const reviseMutation = useReviseSubmittal();
  const deleteMutation = useDeleteSubmittal();

  const handleSubmitForReview = async () => {
    if (!submittalId) return;
    await submitMutation.mutateAsync({ id: submittalId });
  };

  const handleReview = async () => {
    if (!submittalId) return;
    await reviewMutation.mutateAsync({
      id: submittalId,
      status: reviewStatus as 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected',
      review_comments: reviewComments || undefined,
    });
    setReviewOpen(false);
    setReviewComments('');
  };

  const handleRevise = async () => {
    if (!submittalId) return;
    await reviseMutation.mutateAsync(submittalId);
  };

  const handleDelete = async () => {
    if (!submittalId) return;
    await deleteMutation.mutateAsync(submittalId);
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

  if (!submittalId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : submittal ? (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">
                        {submittal.submittal_number}
                      </Badge>
                      {submittal.revision !== 'A' && (
                        <Badge variant="outline" className="font-mono">
                          Rev {submittal.revision}
                        </Badge>
                      )}
                      <Badge
                        className={cn(
                          submittalStatusConfig[submittal.status].bgColor,
                          submittalStatusConfig[submittal.status].color,
                          'border-0'
                        )}
                      >
                        {submittalStatusConfig[submittal.status].label}
                      </Badge>
                      <Badge variant="secondary">
                        {submittalTypeConfig[submittal.type].label}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">{submittal.title}</DialogTitle>
                    {submittal.job && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {submittal.job.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {submittal.status === 'draft' && onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(submittal)}
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
                  {/* Description */}
                  {submittal.description && (
                    <div className="bg-muted/40 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>Description</span>
                      </div>
                      <p className="whitespace-pre-wrap">{submittal.description}</p>
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {submittal.spec_section && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          Spec Section
                        </div>
                        <p className="text-sm font-medium">{submittal.spec_section}</p>
                      </div>
                    )}
                    {submittal.subcontractor && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3" />
                          Subcontractor
                        </div>
                        <p className="text-sm font-medium">{submittal.subcontractor}</p>
                      </div>
                    )}
                    {submittal.manufacturer && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Factory className="h-3 w-3" />
                          Manufacturer
                        </div>
                        <p className="text-sm font-medium">{submittal.manufacturer}</p>
                      </div>
                    )}
                    {submittal.cost_code && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="h-3 w-3" />
                          Cost Code
                        </div>
                        <p className="text-sm font-medium">
                          {submittal.cost_code.code} - {submittal.cost_code.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* People */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        Submitted By
                      </div>
                      <p className="text-sm font-medium">
                        {submittal.submitted_by || '-'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        Submitted To
                      </div>
                      <p className="text-sm font-medium">
                        {submittal.submitted_to || '-'}
                      </p>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Date Submitted
                      </div>
                      <p className="text-sm font-medium">
                        {formatDate(submittal.date_submitted)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Date Required
                      </div>
                      <p className="text-sm font-medium">
                        {formatDate(submittal.date_required)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Date Returned
                      </div>
                      <p className="text-sm font-medium">
                        {formatDate(submittal.date_returned)}
                      </p>
                    </div>
                    {submittal.lead_time_days && (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Lead Time
                        </div>
                        <p className="text-sm font-medium">
                          {submittal.lead_time_days} days
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Review Info */}
                  {submittal.reviewed_by && (
                    <>
                      <Separator />
                      <div className="bg-muted/40 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {submittal.status === 'approved' || submittal.status === 'approved_as_noted' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : submittal.status === 'rejected' ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 text-orange-500" />
                            )}
                            <span>Reviewed by {submittal.reviewed_by}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(submittal.reviewed_at)}
                          </span>
                        </div>
                        {submittal.review_comments && (
                          <p className="whitespace-pre-wrap text-sm">
                            {submittal.review_comments}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Items */}
                  {submittal.items && submittal.items.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Items</h4>
                      <div className="space-y-2">
                        {submittal.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between p-3 border rounded-lg"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">#{item.item_number}</span>
                                <span className="font-medium">{item.description}</span>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                {item.quantity && <span>Qty: {item.quantity} {item.unit || ''}</span>}
                                {item.manufacturer && <span>{item.manufacturer}</span>}
                                {item.model_number && <span>Model: {item.model_number}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments */}
                  {submittal.attachments && submittal.attachments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Paperclip className="h-4 w-4" />
                        Attachments
                      </h4>
                      <div className="space-y-2">
                        {submittal.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 border rounded hover:bg-muted/40"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{attachment.name}</span>
                            <Badge variant="secondary" className="ml-auto text-xs">
                              {attachment.attachment_type}
                            </Badge>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Log */}
                  {submittal.log && submittal.log.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Activity Log
                      </h4>
                      <div className="space-y-2">
                        {submittal.log.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 p-2 text-sm"
                          >
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(entry.created_at)}
                            </div>
                            <div>
                              <span className="font-medium capitalize">{entry.action}</span>
                              {entry.performed_by && (
                                <span className="text-muted-foreground"> by {entry.performed_by}</span>
                              )}
                              {entry.new_status && (
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {entry.new_status.replace('_', ' ')}
                                </Badge>
                              )}
                              {entry.comments && (
                                <p className="text-muted-foreground mt-1">{entry.comments}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {submittal.notes && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {submittal.notes}
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Created {formatDateTime(submittal.created_at)}
                </div>
                <div className="flex gap-2">
                  {submittal.status === 'draft' && (
                    <Button
                      onClick={handleSubmitForReview}
                      disabled={submitMutation.isPending}
                    >
                      {submitMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <Send className="h-4 w-4 mr-2" />
                      Submit for Review
                    </Button>
                  )}
                  {submittal.status === 'pending_review' && (
                    <Button onClick={() => setReviewOpen(true)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Review
                    </Button>
                  )}
                  {submittal.status === 'revise_resubmit' && (
                    <Button
                      onClick={handleRevise}
                      disabled={reviseMutation.isPending}
                    >
                      {reviseMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Create Revision
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Submittal not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <AlertDialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Review Submittal</AlertDialogTitle>
            <AlertDialogDescription>
              Select a review status and add any comments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={reviewStatus} onValueChange={setReviewStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="approved_as_noted">Approved as Noted</SelectItem>
                  <SelectItem value="revise_resubmit">Revise & Resubmit</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Comments</label>
              <Textarea
                placeholder="Review comments..."
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReview}
              disabled={reviewMutation.isPending}
            >
              {reviewMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submittal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this submittal? This action cannot be undone.
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
