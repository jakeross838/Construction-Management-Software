import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { Invoice, formatCurrency } from '@/types/financial';
import { useDraws, useBulkAddToDraw, useJobs, useCreateDraw } from '@/hooks/useFinancialData';

interface BulkAddToDrawDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  onSuccess: () => void;
}

export function BulkAddToDrawDialog({
  open,
  onOpenChange,
  invoices,
  onSuccess,
}: BulkAddToDrawDialogProps) {
  const [selectedDrawId, setSelectedDrawId] = useState<string>('');
  const [createNewDraw, setCreateNewDraw] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');

  const { data: draws = [] } = useDraws();
  const { data: jobs = [] } = useJobs();
  const bulkAddToDraw = useBulkAddToDraw();
  const createDraw = useCreateDraw();

  // Group invoices by job to show warnings
  const invoicesByJob = useMemo(() => {
    const grouped: Record<string, Invoice[]> = {};
    invoices.forEach(inv => {
      const jobId = inv.job_id || 'unknown';
      if (!grouped[jobId]) grouped[jobId] = [];
      grouped[jobId].push(inv);
    });
    return grouped;
  }, [invoices]);

  const jobIds = Object.keys(invoicesByJob).filter(id => id !== 'unknown');
  const hasMultipleJobs = jobIds.length > 1;

  // Filter draws by selected job (if single job) or show all draft draws
  const availableDraws = useMemo(() => {
    const draftDraws = draws.filter(d => d.status === 'draft');
    if (jobIds.length === 1) {
      return draftDraws.filter(d => d.job_id === jobIds[0]);
    }
    return draftDraws;
  }, [draws, jobIds]);

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

  const handleSubmit = async () => {
    if (createNewDraw) {
      // Create a new draw first
      if (!selectedJobId) return;
      const newDraw = await createDraw.mutateAsync({
        job_id: selectedJobId,
        invoiceIds: invoices.filter(inv => inv.job_id === selectedJobId).map(inv => inv.id),
      });
      onOpenChange(false);
      onSuccess();
    } else {
      // Add to existing draw
      if (!selectedDrawId) return;
      await bulkAddToDraw.mutateAsync({
        invoiceIds: invoices.map(inv => inv.id),
        drawId: selectedDrawId,
      });
      onOpenChange(false);
      onSuccess();
    }
  };

  const isLoading = bulkAddToDraw.isPending || createDraw.isPending;

  const getJobName = (jobId: string) => {
    return jobs.find(j => j.id === jobId)?.name || 'Unknown Job';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5" />
            Add to Draw
          </DialogTitle>
          <DialogDescription>
            Add {invoices.length} approved invoice(s) totaling {formatCurrency(totalAmount)} to a draw.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Multiple Jobs Warning */}
          {hasMultipleJobs && (
            <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-600">Multiple Jobs Selected</p>
                <p className="text-muted-foreground mt-1">
                  Selected invoices are from {jobIds.length} different jobs. Each draw can only contain invoices from one job.
                </p>
              </div>
            </div>
          )}

          {/* Invoice Summary by Job */}
          <div className="space-y-2">
            <Label className="text-muted-foreground">Invoice Summary</Label>
            <div className="space-y-2">
              {Object.entries(invoicesByJob).map(([jobId, jobInvoices]) => (
                <div key={jobId} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">{getJobName(jobId)}</span>
                  <Badge variant="secondary">
                    {jobInvoices.length} inv · {formatCurrency(jobInvoices.reduce((sum, i) => sum + i.amount, 0))}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Draw Selection or Creation */}
          {!hasMultipleJobs ? (
            <>
              {availableDraws.length > 0 && !createNewDraw ? (
                <div className="space-y-2">
                  <Label>Select Draw</Label>
                  <Select value={selectedDrawId} onValueChange={setSelectedDrawId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a draft draw" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDraws.map(draw => (
                        <SelectItem key={draw.id} value={draw.id}>
                          Draw #{draw.draw_number} - {getJobName(draw.job_id)}
                          {draw.total_amount ? ` (${formatCurrency(draw.total_amount)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm"
                    onClick={() => setCreateNewDraw(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Create new draw instead
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Create New Draw</Label>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm">
                      A new draw will be created for{' '}
                      <span className="font-medium">{getJobName(jobIds[0])}</span> with these{' '}
                      {invoices.length} invoice(s).
                    </p>
                  </div>
                  {availableDraws.length > 0 && (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm"
                      onClick={() => setCreateNewDraw(false)}
                    >
                      Use existing draw instead
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label>Select Job for New Draw</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobIds.map(jobId => {
                    const jobInvoices = invoicesByJob[jobId];
                    return (
                      <SelectItem key={jobId} value={jobId}>
                        {getJobName(jobId)} ({jobInvoices.length} invoices)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only invoices from the selected job will be added to the new draw.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || (!selectedDrawId && !createNewDraw && !hasMultipleJobs) || (hasMultipleJobs && !selectedJobId)}
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {createNewDraw || hasMultipleJobs ? 'Create Draw' : 'Add to Draw'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
