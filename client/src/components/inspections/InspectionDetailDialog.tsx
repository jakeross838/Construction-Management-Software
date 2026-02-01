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
import { Input } from '@/components/ui/input';
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
  Calendar,
  Clock,
  User,
  Phone,
  Building2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  RefreshCw,
  History,
  Image,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Inspection,
  useInspection,
  usePassInspection,
  useFailInspection,
  useCancelInspection,
  useRescheduleInspection,
  useCreateReinspection,
  useDeleteInspection,
  useResolveDeficiency,
  inspectionResultConfig,
  deficiencySeverityConfig,
  deficiencyStatusConfig,
} from '@/hooks/useInspections';

interface InspectionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspectionId: string | null;
  onEdit?: (inspection: Inspection) => void;
}

export function InspectionDetailDialog({
  open,
  onOpenChange,
  inspectionId,
  onEdit,
}: InspectionDetailDialogProps) {
  const { data: inspection, isLoading } = useInspection(inspectionId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [resultAction, setResultAction] = useState<'pass' | 'fail' | 'cancel'>('pass');
  const [resultNotes, setResultNotes] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [reinspectOpen, setReinspectOpen] = useState(false);
  const [reinspectDate, setReinspectDate] = useState('');

  const passMutation = usePassInspection();
  const failMutation = useFailInspection();
  const cancelMutation = useCancelInspection();
  const rescheduleMutation = useRescheduleInspection();
  const reinspectMutation = useCreateReinspection();
  const deleteMutation = useDeleteInspection();
  const resolveDeficiencyMutation = useResolveDeficiency();

  const handleOpenResultDialog = (action: 'pass' | 'fail' | 'cancel') => {
    setResultAction(action);
    setResultNotes('');
    setResultDialogOpen(true);
  };

  const handleSubmitResult = async () => {
    if (!inspectionId) return;

    if (resultAction === 'pass') {
      await passMutation.mutateAsync({ id: inspectionId, result_notes: resultNotes || undefined });
    } else if (resultAction === 'fail') {
      await failMutation.mutateAsync({ id: inspectionId, result_notes: resultNotes || undefined });
    } else if (resultAction === 'cancel') {
      await cancelMutation.mutateAsync({ id: inspectionId, result_notes: resultNotes || undefined });
    }
    setResultDialogOpen(false);
  };

  const handleReschedule = async () => {
    if (!inspectionId || !rescheduleDate) return;
    await rescheduleMutation.mutateAsync({ id: inspectionId, scheduled_date: rescheduleDate });
    setRescheduleOpen(false);
  };

  const handleReinspect = async () => {
    if (!inspectionId || !reinspectDate) return;
    await reinspectMutation.mutateAsync({
      id: inspectionId,
      scheduled_date: reinspectDate,
      created_by: 'Jake Ross',
    });
    setReinspectOpen(false);
  };

  const handleDelete = async () => {
    if (!inspectionId) return;
    await deleteMutation.mutateAsync(inspectionId);
    setDeleteOpen(false);
    onOpenChange(false);
  };

  const handleResolveDeficiency = async (deficiencyId: string) => {
    if (!inspectionId) return;
    await resolveDeficiencyMutation.mutateAsync({
      id: deficiencyId,
      inspectionId,
      resolved_by: 'Jake Ross',
    });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${minutes} ${ampm}`;
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

  if (!inspectionId) return null;

  const isPending = passMutation.isPending || failMutation.isPending || cancelMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : inspection ? (
            <>
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono">
                        #{inspection.inspection_number}
                      </Badge>
                      {inspection.reinspection_count > 0 && (
                        <Badge variant="outline" className="font-mono">
                          Re-inspection #{inspection.reinspection_count}
                        </Badge>
                      )}
                      <Badge
                        className={cn(
                          inspectionResultConfig[inspection.result].bgColor,
                          inspectionResultConfig[inspection.result].color,
                          'border-0'
                        )}
                      >
                        {inspectionResultConfig[inspection.result].label}
                      </Badge>
                    </div>
                    <DialogTitle className="text-xl">{inspection.inspection_type}</DialogTitle>
                    {inspection.job && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {inspection.job.name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {inspection.result === 'scheduled' && onEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(inspection)}
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
                  {/* Schedule Info */}
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <span className="font-medium">{formatDate(inspection.scheduled_date)}</span>
                      </div>
                      {inspection.scheduled_time && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-muted-foreground" />
                          <span>{formatTime(inspection.scheduled_time)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Inspector Info */}
                  {(inspection.inspector_name || inspection.inspector_agency) && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {inspection.inspector_name && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            Inspector
                          </div>
                          <p className="text-sm font-medium">{inspection.inspector_name}</p>
                        </div>
                      )}
                      {inspection.inspector_phone && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            Phone
                          </div>
                          <p className="text-sm font-medium">{inspection.inspector_phone}</p>
                        </div>
                      )}
                      {inspection.inspector_agency && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3" />
                            Agency
                          </div>
                          <p className="text-sm font-medium">{inspection.inspector_agency}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Result Info */}
                  {inspection.result !== 'scheduled' && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {inspection.result === 'passed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : inspection.result === 'failed' ? (
                            <XCircle className="h-5 w-5 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          )}
                          <span className="font-medium">
                            {inspectionResultConfig[inspection.result].label}
                          </span>
                          {inspection.result_date && (
                            <span className="text-sm text-muted-foreground">
                              on {formatDate(inspection.result_date)}
                            </span>
                          )}
                        </div>
                        {inspection.result_notes && (
                          <p className="text-sm text-muted-foreground pl-7">
                            {inspection.result_notes}
                          </p>
                        )}
                      </div>
                    </>
                  )}

                  {/* Deficiencies */}
                  {inspection.deficiencies && inspection.deficiencies.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Deficiencies ({inspection.deficiencies.length})
                      </h4>
                      <div className="space-y-2">
                        {inspection.deficiencies.map((deficiency) => (
                          <div
                            key={deficiency.id}
                            className={cn(
                              'p-3 border rounded-lg',
                              deficiency.status === 'resolved' && 'bg-green-50/50'
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    className={cn(
                                      deficiencySeverityConfig[deficiency.severity].bgColor,
                                      deficiencySeverityConfig[deficiency.severity].color,
                                      'border-0 text-xs'
                                    )}
                                  >
                                    {deficiencySeverityConfig[deficiency.severity].label}
                                  </Badge>
                                  <Badge
                                    className={cn(
                                      deficiencyStatusConfig[deficiency.status].bgColor,
                                      deficiencyStatusConfig[deficiency.status].color,
                                      'border-0 text-xs'
                                    )}
                                  >
                                    {deficiencyStatusConfig[deficiency.status].label}
                                  </Badge>
                                </div>
                                <p className="font-medium">{deficiency.description}</p>
                                {deficiency.location && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {deficiency.location}
                                  </p>
                                )}
                                {deficiency.resolution_notes && (
                                  <p className="text-sm text-green-600 mt-2">
                                    Resolution: {deficiency.resolution_notes}
                                  </p>
                                )}
                              </div>
                              {deficiency.status !== 'resolved' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResolveDeficiency(deficiency.id)}
                                  disabled={resolveDeficiencyMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Resolve
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attachments/Photos */}
                  {inspection.attachments && inspection.attachments.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Image className="h-4 w-4" />
                        Photos ({inspection.attachments.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        {inspection.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded-lg overflow-hidden border hover:border-primary"
                          >
                            <img
                              src={attachment.file_url}
                              alt={attachment.caption || 'Inspection photo'}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Log */}
                  {inspection.activity && inspection.activity.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Activity Log
                      </h4>
                      <div className="space-y-2">
                        {inspection.activity.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start gap-3 p-2 text-sm"
                          >
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDateTime(entry.created_at)}
                            </div>
                            <div>
                              <span className="font-medium capitalize">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                              {entry.performed_by && (
                                <span className="text-muted-foreground"> by {entry.performed_by}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t flex-shrink-0">
                <div className="text-xs text-muted-foreground">
                  Created by {inspection.created_by}
                </div>
                <div className="flex gap-2">
                  {inspection.result === 'scheduled' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRescheduleOpen(true)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Reschedule
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenResultDialog('cancel')}
                        disabled={isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleOpenResultDialog('fail')}
                        disabled={isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Failed
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleOpenResultDialog('pass')}
                        disabled={isPending}
                      >
                        {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Passed
                      </Button>
                    </>
                  )}
                  {inspection.result === 'failed' && (
                    <Button
                      size="sm"
                      onClick={() => setReinspectOpen(true)}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Schedule Re-inspection
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Inspection not found
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <AlertDialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {resultAction === 'pass' && 'Mark as Passed'}
              {resultAction === 'fail' && 'Mark as Failed'}
              {resultAction === 'cancel' && 'Cancel Inspection'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Add any notes about the inspection result.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Notes (optional)"
              value={resultNotes}
              onChange={(e) => setResultNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitResult}
              className={cn(
                resultAction === 'fail' && 'bg-destructive text-destructive-foreground',
                resultAction === 'pass' && 'bg-green-600 text-white hover:bg-green-700'
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <AlertDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule Inspection</AlertDialogTitle>
            <AlertDialogDescription>
              Select a new date for this inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReschedule}
              disabled={!rescheduleDate || rescheduleMutation.isPending}
            >
              {rescheduleMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reinspect Dialog */}
      <AlertDialog open={reinspectOpen} onOpenChange={setReinspectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Schedule Re-inspection</AlertDialogTitle>
            <AlertDialogDescription>
              Select a date for the re-inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="date"
              value={reinspectDate}
              onChange={(e) => setReinspectDate(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReinspect}
              disabled={!reinspectDate || reinspectMutation.isPending}
            >
              {reinspectMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inspection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inspection? This action cannot be undone.
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
