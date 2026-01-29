import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  FileText,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Save,
  Download,
  ExternalLink,
  Stamp,
  Sparkles,
  Pencil,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useInvoice, useUpdateInvoice, useDeleteInvoice, useChangeInvoiceStatus, useCostCodes, usePurchaseOrders, useVendors, useDBJobs } from '@/hooks/useFinancialData';
import { useApproveAndStampInvoice, useStampInvoice } from '@/hooks/useInvoiceStamping';
import { useRecordCorrection } from '@/hooks/useAILearning';
import { 
  invoiceStatusConfig, 
  formatCurrency, 
  formatDate,
} from '@/types/financial';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';
import { useUserName } from '@/contexts/UserContext';
import { useQueryClient } from '@tanstack/react-query';
import { ReviewFlagsList, ReviewStatusSummary } from './ReviewFlagsBadges';
import { AIConfidenceBadge, AIConfidenceBar } from './AIConfidenceBadge';
import { CostCodeSuggestions, CostCodeSuggestion } from './CostCodeSuggestions';

interface InvoiceDetailDialogProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceDetailDialog({
  invoiceId,
  open,
  onOpenChange,
}: InvoiceDetailDialogProps) {
  const queryClient = useQueryClient();
  const userName = useUserName();
  const { data: invoice, isLoading } = useInvoice(invoiceId || '');
  const { data: costCodes = [] } = useCostCodes();
  const { data: purchaseOrders = [] } = usePurchaseOrders(invoice?.job_id || undefined);
  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useDBJobs();
  
  const approveAndStamp = useApproveAndStampInvoice();
  const stampInvoice = useStampInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const changeStatus = useChangeInvoiceStatus();
  const recordCorrection = useRecordCorrection();

  const [showCostSuggestions, setShowCostSuggestions] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [allocations, setAllocations] = useState<Array<{ id?: string; cost_code_id: string; amount: string; description: string }>>([]);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Editable fields
  const [editVendorId, setEditVendorId] = useState<string>('');
  const [editJobId, setEditJobId] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editInvoiceNumber, setEditInvoiceNumber] = useState<string>('');
  const [editInvoiceDate, setEditInvoiceDate] = useState<string>('');
  const [editDueDate, setEditDueDate] = useState<string>('');

  // Load existing allocations and edit fields when invoice loads
  useEffect(() => {
    if (invoice?.allocations && invoice.allocations.length > 0) {
      setAllocations(invoice.allocations.map(a => ({
        id: a.id,
        cost_code_id: a.cost_code_id || '',
        amount: String(a.amount),
        description: a.description || '',
      })));
    } else {
      setAllocations([{ cost_code_id: '', amount: '', description: '' }]);
    }
    setNotes(invoice?.notes || '');

    // Load edit fields
    if (invoice) {
      setEditVendorId(invoice.vendor_id || '');
      setEditJobId(invoice.job_id || '');
      setEditAmount(String(invoice.amount || ''));
      setEditInvoiceNumber(invoice.invoice_number || '');
      setEditInvoiceDate(invoice.invoice_date || '');
      setEditDueDate(invoice.due_date || '');
    }
  }, [invoice]);

  // Reset edit mode when dialog closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  const costCodeOptions = costCodes
    .filter(cc => cc.code && cc.name)
    .map(cc => ({
      value: cc.id,
      label: `${cc.code} - ${cc.name}`,
    }));

  const poOptions = purchaseOrders
    .filter(po => po.po_number)
    .map(po => ({
      value: po.id,
      label: `${po.po_number} - ${po.vendor_name || 'Unknown Vendor'}`,
      description: `Remaining: ${formatCurrency(po.remaining_amount || 0)}`,
    }));

  // Validation - allow partial allocations (total <= invoice amount)
  const validAllocations = allocations.filter(a => a.cost_code_id && parseFloat(a.amount) > 0);
  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const allocationMatch = invoice ? Math.abs(totalAllocated - invoice.amount) < 0.01 : true;
  const isPartialAllocation = invoice ? totalAllocated < invoice.amount - 0.01 : false;
  const isOverAllocated = invoice ? totalAllocated > invoice.amount + 0.01 : false;
  // Valid if: has at least one allocation AND not over-allocated
  const hasValidAllocations = validAllocations.length > 0 && !isOverAllocated;

  const saveAllocations = async () => {
    if (!invoice) return false;

    setIsSaving(true);
    try {
      // Use the API endpoint to save allocations
      const validAllocs = allocations.filter(a => a.cost_code_id && parseFloat(a.amount) > 0);

      const response = await fetch(`/api/invoices/${invoice.id}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allocations: validAllocs.map(a => ({
            cost_code_id: a.cost_code_id,
            amount: parseFloat(a.amount),
            notes: a.description || null,
            job_id: invoice.job_id,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to save allocations: HTTP ${response.status}`);
      }

      // Update notes if changed
      if (notes !== invoice.notes) {
        await updateInvoice.mutateAsync({ id: invoice.id, notes });
      }

      queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
      toast.success('Cost allocations saved');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save allocations';
      toast.error(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!invoice) return;
    
    // Validate allocations before approval
    if (!hasValidAllocations) {
      if (validAllocations.length === 0) {
        toast.error('Cost code allocations are required before approval');
      } else if (isOverAllocated) {
        toast.error('Allocation total cannot exceed invoice amount');
      }
      return;
    }
    
    try {
      // Save allocations first
      const saved = await saveAllocations();
      if (!saved) return;
      
      // Use the new approve and stamp hook
      await approveAndStamp.mutateAsync({ 
        invoiceId: invoice.id, 
        approvedBy: userName // TODO: Get actual user name
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleRestamp = async () => {
    if (!invoice) return;
    
    try {
      await stampInvoice.mutateAsync({
        invoiceId: invoice.id,
        status: invoice.status as any,
      });
      toast.success('Invoice re-stamped successfully');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeny = async () => {
    if (!invoice) return;

    try {
      await updateInvoice.mutateAsync({ id: invoice.id, status: 'denied' });
      toast.success('Invoice denied');
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveEdit = async () => {
    if (!invoice) return;

    setIsSaving(true);
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        vendor_id: editVendorId || null,
        job_id: editJobId || null,
        amount: parseFloat(editAmount) || 0,
        invoice_number: editInvoiceNumber,
        invoice_date: editInvoiceDate,
        due_date: editDueDate || null,
        notes,
      });
      setIsEditing(false);
      toast.success('Invoice updated');
    } catch (error) {
      // Error handled by mutation
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;

    try {
      await deleteInvoice.mutateAsync(invoice.id);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;

    // Require valid allocations for approval
    if (newStatus === 'approved' && !hasValidAllocations) {
      if (validAllocations.length === 0) {
        toast.error('Cost code allocations are required before approval');
      } else if (isOverAllocated) {
        toast.error('Allocation total cannot exceed invoice amount');
      }
      return;
    }

    try {
      // Save allocations first if approving
      if (newStatus === 'approved') {
        const saved = await saveAllocations();
        if (!saved) return;
      }

      await changeStatus.mutateAsync({
        id: invoice.id,
        status: newStatus as any,
        approved_by: newStatus === 'approved' ? userName : undefined, // TODO: Get actual user
      });

      // Re-stamp the PDF with new status
      if (invoice.pdf_url) {
        await stampInvoice.mutateAsync({
          invoiceId: invoice.id,
          status: newStatus as any,
        });
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const addAllocation = () => {
    setAllocations([...allocations, { cost_code_id: '', amount: '', description: '' }]);
  };

  const removeAllocation = (index: number) => {
    setAllocations(allocations.filter((_, i) => i !== index));
  };

  const updateAllocation = (index: number, field: 'cost_code_id' | 'amount' | 'description', value: string) => {
    const updated = [...allocations];
    updated[index][field] = value;
    setAllocations(updated);
  };

  // Auto-fill remaining amount when cost code is selected on last empty allocation
  const handleCostCodeChange = (index: number, costCodeId: string) => {
    updateAllocation(index, 'cost_code_id', costCodeId);
    
    // If this is the only/last allocation and amount is empty, fill with invoice total
    if (allocations[index].amount === '' && invoice) {
      const remainingAmount = invoice.amount - totalAllocated;
      if (remainingAmount > 0) {
        updateAllocation(index, 'amount', remainingAmount.toFixed(2));
      }
    }
  };

  if (!invoice && !isLoading) return null;

  const statusConfig = invoice ? invoiceStatusConfig[invoice.status] : null;
  const canEdit = invoice?.status === 'received' || invoice?.status === 'needs_review' || invoice?.status === 'needs_approval';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              Invoice: {invoice?.invoice_number}
              {invoice?.vendor_name && ` - ${invoice.vendor_name}`}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Status Dropdown */}
              {invoice && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Badge className={`${statusConfig?.bgColor} ${statusConfig?.color} border-0`}>
                        {statusConfig?.label}
                      </Badge>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('needs_approval')}
                      disabled={invoice.status === 'needs_approval'}
                    >
                      Needs Approval
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('approved')}
                      disabled={invoice.status === 'approved' || !hasValidAllocations}
                      title={!hasValidAllocations ? 'Cost allocations required' : ''}
                    >
                      Approved {!hasValidAllocations && '(needs allocations)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('in_draw')}
                      disabled={invoice.status === 'in_draw'}
                    >
                      In Draw
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('paid')}
                      disabled={invoice.status === 'paid'}
                    >
                      Paid
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleStatusChange('denied')}
                      disabled={invoice.status === 'denied'}
                      className="text-destructive"
                    >
                      Denied
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* Edit/Cancel Button */}
              {invoice && !isEditing && (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
              {isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
              )}

              {/* Delete Button */}
              {invoice && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
            <p className="mt-2 text-muted-foreground">Loading invoice details...</p>
          </div>
        ) : invoice ? (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: PDF Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-muted-foreground">PDF Preview</Label>
                <div className="flex items-center gap-1">
                  {invoice.pdf_stamped_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(invoice.pdf_stamped_url!, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Stamped
                    </Button>
                  )}
                  {invoice.pdf_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.open(invoice.pdf_url!, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Original
                    </Button>
                  )}
                  {canEdit && invoice.pdf_url && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleRestamp}
                      disabled={stampInvoice.isPending}
                    >
                      {stampInvoice.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Stamp className="h-4 w-4 mr-1" />
                          Re-stamp
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="border rounded-lg bg-muted/30 min-h-[75vh] flex items-center justify-center">
                {(invoice.pdf_stamped_url || invoice.pdf_url) ? (
                  <iframe
                    src={invoice.pdf_stamped_url || invoice.pdf_url!}
                    className="w-full h-[75vh] rounded-lg"
                    title="Invoice PDF"
                  />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <FileText className="h-16 w-16 mx-auto mb-3 opacity-50" />
                    <p>PDF Preview</p>
                    <p className="text-sm">No PDF uploaded</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  {isEditing ? (
                    <Combobox
                      options={vendors.map(v => ({ value: v.id, label: v.name }))}
                      value={editVendorId}
                      onValueChange={setEditVendorId}
                      placeholder="Select vendor..."
                      searchPlaceholder="Search vendors..."
                    />
                  ) : (
                    <p className="font-medium">{invoice.vendor_name || '—'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice #</Label>
                  {isEditing ? (
                    <Input
                      value={editInvoiceNumber}
                      onChange={(e) => setEditInvoiceNumber(e.target.value)}
                      placeholder="Invoice number"
                    />
                  ) : (
                    <p className="font-medium">{invoice.invoice_number}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editInvoiceDate}
                      onChange={(e) => setEditInvoiceDate(e.target.value)}
                    />
                  ) : (
                    <p className="font-medium">{formatDate(invoice.invoice_date)}</p>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  {isEditing ? (
                    <Input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                    />
                  ) : (
                    <p className="font-medium">{formatDate(invoice.due_date)}</p>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Amount</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="text-2xl font-bold w-48"
                  />
                ) : (
                  <p className={`text-2xl font-bold ${invoice.is_credit ? 'text-red-600' : ''}`}>
                    {invoice.is_credit ? '-' : ''}{formatCurrency(Math.abs(invoice.amount))}
                  </p>
                )}
              </div>

              <Separator />

              {/* Job & PO Assignment */}
              <div className="space-y-3">
                <h4 className="font-medium">Job & PO Assignment</h4>
                <div className="space-y-2">
                  <Label>Job</Label>
                  {isEditing ? (
                    <Combobox
                      options={jobs.map(j => ({ value: j.id, label: j.name }))}
                      value={editJobId}
                      onValueChange={setEditJobId}
                      placeholder="Select job..."
                      searchPlaceholder="Search jobs..."
                    />
                  ) : (
                    <p className="font-medium">{invoice.job_name || 'Not assigned'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Purchase Order</Label>
                  {poOptions.length > 0 ? (
                    <Combobox
                      options={poOptions}
                      value={invoice.po_id || ''}
                      onValueChange={() => {}}
                      placeholder="Select PO..."
                      searchPlaceholder="Search POs..."
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">No POs available for this job</p>
                  )}
                </div>

                {/* Budget Standing */}
                {invoice.po_id && (() => {
                  const po = purchaseOrders.find(p => p.id === invoice.po_id);
                  if (!po) return null;

                  const committed = po.current_amount ?? po.original_amount ?? 0;
                  const invoiced = po.invoiced_amount ?? 0;
                  const remaining = committed - invoiced;
                  const percentUsed = committed > 0 ? (invoiced / committed) * 100 : 0;
                  const isOverBudget = invoiced > committed;
                  const willExceed = (invoiced + invoice.amount) > committed;

                  return (
                    <div className={`mt-3 p-3 rounded-lg border ${isOverBudget ? 'bg-red-50 border-red-200' : willExceed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Budget Standing</span>
                        {isOverBudget ? (
                          <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                        ) : willExceed ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Will Exceed</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">Within Budget</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">PO Amount</p>
                          <p className="font-medium">{formatCurrency(committed)}</p>
                          {po.change_order_amount > 0 && (
                            <p className="text-xs text-muted-foreground">+{formatCurrency(po.change_order_amount)} COs</p>
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Already Invoiced</p>
                          <p className="font-medium">{formatCurrency(invoiced)}</p>
                          <p className="text-xs text-muted-foreground">{percentUsed.toFixed(0)}% used</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Remaining</p>
                          <p className={`font-medium ${remaining < 0 ? 'text-red-600' : remaining < invoice.amount ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrency(remaining)}
                          </p>
                          {remaining < invoice.amount && remaining >= 0 && (
                            <p className="text-xs text-amber-600">Less than this invoice</p>
                          )}
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${isOverBudget ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(percentUsed, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>

              <Separator />

              {/* Cost Allocations - REQUIRED */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">Cost Allocations</h4>
                    <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                      Required
                    </Badge>
                  </div>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={addAllocation}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  )}
                </div>
                
                <div className="space-y-2">
                  {allocations.map((alloc, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="flex-1">
                        <Combobox
                          options={costCodeOptions}
                          value={alloc.cost_code_id}
                          onValueChange={(v) => handleCostCodeChange(idx, v)}
                          placeholder="Select cost code..."
                          searchPlaceholder="Search..."
                          disabled={!canEdit}
                        />
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-32"
                        value={alloc.amount}
                        onChange={(e) => updateAllocation(idx, 'amount', e.target.value)}
                        placeholder="Amount"
                        disabled={!canEdit}
                      />
                      {canEdit && allocations.length > 1 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeAllocation(idx)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <div className={`flex items-center gap-2 text-sm ${isOverAllocated ? 'text-red-600' : hasValidAllocations ? 'text-green-600' : 'text-amber-600'}`}>
                  {isOverAllocated ? (
                    <AlertTriangle className="h-4 w-4" />
                  ) : hasValidAllocations ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <span>
                    Total: {formatCurrency(totalAllocated)}
                    {!allocationMatch && ` (Invoice: ${formatCurrency(invoice.amount)})`}
                  </span>
                  {isOverAllocated && (
                    <span className="text-xs ml-2">— Cannot exceed invoice total</span>
                  )}
                  {isPartialAllocation && hasValidAllocations && (
                    <span className="text-xs ml-2 text-blue-600">— Partial allocation</span>
                  )}
                  {validAllocations.length === 0 && (
                    <span className="text-xs ml-2">— Add at least one cost code</span>
                  )}
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                  disabled={!canEdit}
                />
              </div>

              {/* Review Flags */}
              {invoice.review_flags && (invoice.review_flags as string[]).length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Review Required</span>
                      <ReviewStatusSummary 
                        needsReview={invoice.needs_review ?? false}
                        flags={invoice.review_flags as string[]}
                      />
                    </div>
                    <ReviewFlagsList flags={invoice.review_flags as string[]} />
                  </AlertDescription>
                </Alert>
              )}

              {/* AI Confidence (if available) */}
              {invoice.ai_confidence && (
                <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h5 className="font-medium text-sm">AI Extraction Confidence</h5>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(invoice.ai_confidence).map(([key, value]) => (
                      <AIConfidenceBar 
                        key={key} 
                        confidence={value as number} 
                        label={key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Cost Code Suggestions (if available from AI) */}
              {showCostSuggestions && invoice.ai_extracted_data && (invoice.ai_extracted_data as any)?.suggestions?.costCodes && (
                <CostCodeSuggestions
                  suggestions={((invoice.ai_extracted_data as any).suggestions.costCodes as CostCodeSuggestion[])}
                  invoiceAmount={invoice.amount}
                  onAccept={(allocs) => {
                    setAllocations(allocs.map(a => ({
                      cost_code_id: a.cost_code_id,
                      amount: String(a.amount),
                      description: ''
                    })));
                    setShowCostSuggestions(false);
                    toast.success('Cost code allocations applied');
                  }}
                  onDismiss={() => setShowCostSuggestions(false)}
                />
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <Button
                  variant="outline"
                  onClick={saveAllocations}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Allocations
                </Button>
              )}
              {(invoice?.status === 'needs_approval' || invoice?.status === 'needs_review') && (
                <>
                  <Button
                    variant="destructive"
                    onClick={handleDeny}
                    disabled={updateInvoice.isPending}
                  >
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Deny
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approveAndStamp.isPending || !hasValidAllocations}
                    title={!hasValidAllocations ? (isOverAllocated ? 'Allocations exceed invoice amount' : 'At least one cost code allocation required') : ''}
                  >
                    {approveAndStamp.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-2" />
                    )}
                    Approve & Stamp
                  </Button>
                </>
              )}
              {invoice?.status !== 'needs_approval' && invoice?.status !== 'needs_review' && !canEdit && (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice "{invoice?.invoice_number}"?
              This will also delete all cost allocations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvoice.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
