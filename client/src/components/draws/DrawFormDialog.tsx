import { useState, useEffect, useMemo } from 'react';
import { flushSync } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
// Using native checkbox instead of Radix Checkbox to avoid infinite loop issues
import { Badge } from '@/components/ui/badge';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs, useCreateDraw, useUnassignedApprovedInvoices } from '@/hooks/useFinancialData';
import { formatCurrency, formatDate } from '@/types/financial';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { FileText, DollarSign, CheckCircle2 } from 'lucide-react';

interface DrawFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DrawFormDialog({ open, onOpenChange }: DrawFormDialogProps) {
  const { selectedJobId } = useJob();
  const { data: jobs } = useDBJobs();
  const createDraw = useCreateDraw();

  const today = new Date();
  const [formData, setFormData] = useState({
    job_id: selectedJobId || '',
    period_start: format(startOfMonth(today), 'yyyy-MM-dd'),
    period_end: format(endOfMonth(today), 'yyyy-MM-dd'),
    application_date: format(today, 'yyyy-MM-dd'),
    notes: '',
  });
  
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);

  // Fetch unassigned approved invoices for the selected job
  const { data: availableInvoices = [], isLoading: loadingInvoices } = useUnassignedApprovedInvoices(formData.job_id);

  // Calculate total from selected invoices
  const selectedTotal = useMemo(() => {
    return availableInvoices
      .filter(inv => selectedInvoiceIds.includes(inv.id))
      .reduce((sum, inv) => sum + inv.amount, 0);
  }, [availableInvoices, selectedInvoiceIds]);

  // Update job_id when selectedJobId changes
  useEffect(() => {
    if (selectedJobId) {
      setFormData(prev => ({ ...prev, job_id: selectedJobId }));
    }
  }, [selectedJobId]);

  // Reset selected invoices when job changes
  useEffect(() => {
    setSelectedInvoiceIds([]);
  }, [formData.job_id]);

  const toggleInvoice = (invoiceId: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(invoiceId)
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const selectAll = () => {
    flushSync(() => {
      setSelectedInvoiceIds(availableInvoices.map(inv => inv.id));
    });
  };

  const deselectAll = () => {
    flushSync(() => {
      setSelectedInvoiceIds([]);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await createDraw.mutateAsync({
      job_id: formData.job_id,
      period_start: formData.period_start,
      period_end: formData.period_end,
      application_date: formData.application_date,
      current_payment_due: selectedTotal,
      total_completed: selectedTotal,
      notes: formData.notes || null,
      status: 'draft',
      invoiceIds: selectedInvoiceIds,
    });
    
    onOpenChange(false);
    // Reset form
    setFormData({
      job_id: selectedJobId || '',
      period_start: format(startOfMonth(today), 'yyyy-MM-dd'),
      period_end: format(endOfMonth(today), 'yyyy-MM-dd'),
      application_date: format(today, 'yyyy-MM-dd'),
      notes: '',
    });
    setSelectedInvoiceIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>New Draw Request</DialogTitle>
          <DialogDescription>
            Create a new G702/G703 draw request from approved invoices
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden gap-4">
          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            {/* Job Selection - only show if no job selected */}
            {!selectedJobId && (
              <div className="space-y-2">
                <Label htmlFor="job">Job *</Label>
                <select
                  id="job"
                  value={formData.job_id}
                  onChange={(e) => setFormData({ ...formData, job_id: e.target.value })}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Select a job</option>
                  {jobs?.map((job) => (
                    <option key={job.id} value={job.id}>{job.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period_start">Period Start *</Label>
                <Input
                  id="period_start"
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period_end">Period End *</Label>
                <Input
                  id="period_end"
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Application Date */}
            <div className="space-y-2">
              <Label htmlFor="application_date">Application Date</Label>
              <Input
                id="application_date"
                type="date"
                value={formData.application_date}
                onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
              />
            </div>

            {/* Approved Invoices Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Approved Invoices</Label>
                {availableInvoices.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectAll();
                      }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        deselectAll();
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              
              {!formData.job_id ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a job to see approved invoices</p>
                </div>
              ) : loadingInvoices ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg">
                  <p className="text-sm">Loading invoices...</p>
                </div>
              ) : availableInvoices.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg bg-muted/30">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No approved invoices available</p>
                  <p className="text-xs mt-1">Approve invoices to include them in a draw</p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border rounded-lg">
                  <div className="p-2 space-y-1">
                    {availableInvoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${
                          selectedInvoiceIds.includes(invoice.id) 
                            ? 'bg-primary/10 border border-primary/30' 
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => toggleInvoice(invoice.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedInvoiceIds.includes(invoice.id)}
                          onChange={() => {}}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleInvoice(invoice.id);
                          }}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{invoice.invoice_number}</span>
                            <Badge variant="outline" className="text-xs">
                              {invoice.vendor_name || (invoice as any).vendor?.name || 'Unknown Vendor'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {formatDate(invoice.invoice_date)}
                            {invoice.po_number && ` • ${invoice.po_number}`}
                          </p>
                        </div>
                        <span className="font-semibold text-sm tabular-nums">
                          {formatCurrency(invoice.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected Total */}
              {selectedInvoiceIds.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      {selectedInvoiceIds.length} invoice{selectedInvoiceIds.length !== 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(selectedTotal)}
                  </span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes for this draw..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createDraw.isPending || selectedInvoiceIds.length === 0}
            >
              {createDraw.isPending ? 'Creating...' : `Create Draw (${formatCurrency(selectedTotal)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
