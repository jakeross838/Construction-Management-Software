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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DollarSign,
  Clock,
  Upload,
  FileCheck,
  Ban,
  Banknote,
  FolderPlus,
  MessageSquare,
  Bot,
  ChevronRight,
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
import { useInvoice, useUpdateInvoice, useDeleteInvoice, useChangeInvoiceStatus, useCostCodes, usePurchaseOrders, useVendors, useDBJobs, useInvoiceActivity, InvoiceActivity } from '@/hooks/useFinancialData';
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
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { usePaymentHistory } from '@/hooks/useVendorPayments';
import { useBudgetSummary } from '@/hooks/useBudget';
import { apiPost } from '@/lib/api';

// Activity action icons and labels
const activityConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  uploaded: { icon: <Upload className="h-3.5 w-3.5" />, label: 'Uploaded', color: 'text-blue-600' },
  processed: { icon: <Bot className="h-3.5 w-3.5" />, label: 'AI Processed', color: 'text-purple-600' },
  coded: { icon: <FileCheck className="h-3.5 w-3.5" />, label: 'Cost Coded', color: 'text-indigo-600' },
  approved: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Approved', color: 'text-green-600' },
  status_approved: { icon: <CheckCircle className="h-3.5 w-3.5" />, label: 'Approved', color: 'text-green-600' },
  denied: { icon: <Ban className="h-3.5 w-3.5" />, label: 'Denied', color: 'text-red-600' },
  status_denied: { icon: <Ban className="h-3.5 w-3.5" />, label: 'Denied', color: 'text-red-600' },
  status_needs_approval: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Needs Approval', color: 'text-amber-600' },
  status_needs_review: { icon: <AlertTriangle className="h-3.5 w-3.5" />, label: 'Needs Review', color: 'text-amber-600' },
  status_in_draw: { icon: <FolderPlus className="h-3.5 w-3.5" />, label: 'Added to Draw', color: 'text-cyan-600' },
  status_billed: { icon: <FileCheck className="h-3.5 w-3.5" />, label: 'Billed', color: 'text-teal-600' },
  status_paid: { icon: <Banknote className="h-3.5 w-3.5" />, label: 'Paid', color: 'text-emerald-600' },
  stamped: { icon: <Stamp className="h-3.5 w-3.5" />, label: 'Stamped', color: 'text-orange-600' },
  added_to_draw: { icon: <FolderPlus className="h-3.5 w-3.5" />, label: 'Added to Draw', color: 'text-cyan-600' },
  removed_from_draw: { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Removed from Draw', color: 'text-amber-600' },
  paid: { icon: <Banknote className="h-3.5 w-3.5" />, label: 'Paid', color: 'text-emerald-600' },
  paid_to_vendor: { icon: <Banknote className="h-3.5 w-3.5" />, label: 'Payment Recorded', color: 'text-emerald-600' },
  unpaid: { icon: <X className="h-3.5 w-3.5" />, label: 'Payment Reversed', color: 'text-red-600' },
  updated: { icon: <Pencil className="h-3.5 w-3.5" />, label: 'Updated', color: 'text-gray-600' },
  split: { icon: <Plus className="h-3.5 w-3.5" />, label: 'Split', color: 'text-purple-600' },
  created_from_split: { icon: <Plus className="h-3.5 w-3.5" />, label: 'Created from Split', color: 'text-purple-600' },
  unsplit: { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Unsplit', color: 'text-amber-600' },
  deleted: { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Deleted', color: 'text-red-600' },
  allocation_removed: { icon: <Trash2 className="h-3.5 w-3.5" />, label: 'Allocation Removed', color: 'text-amber-600' },
  allocation_reassigned: { icon: <Pencil className="h-3.5 w-3.5" />, label: 'Allocation Reassigned', color: 'text-blue-600' },
  co_auto_linked: { icon: <FileCheck className="h-3.5 w-3.5" />, label: 'Linked to CO', color: 'text-indigo-600' },
  created: { icon: <Plus className="h-3.5 w-3.5" />, label: 'Created', color: 'text-blue-600' },
};

function ActivityItem({ activity }: { activity: InvoiceActivity }) {
  const config = activityConfig[activity.action] || {
    icon: <Clock className="h-3.5 w-3.5" />,
    label: activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    color: 'text-gray-500'
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  // Format activity details for display
  const getDetailsSummary = () => {
    if (!activity.details) return null;
    const d = activity.details;

    // AI Processing details
    if (activity.action === 'processed' || activity.action === 'uploaded') {
      const parts: string[] = [];
      if (d.vendorName) parts.push(`Vendor: ${d.vendorName}`);
      if (d.jobName) parts.push(`Job: ${d.jobName}`);
      if (d.poNumber) parts.push(`PO: ${d.poNumber}`);
      if (d.confidence) parts.push(`${Math.round(d.confidence * 100)}% confidence`);
      return parts.length > 0 ? parts.join(' · ') : null;
    }

    // Status change details
    if (d.from && d.to) return `${d.from} → ${d.to}`;
    if (d.from) return `from ${d.from}`;

    // Payment details
    if (d.amount) return formatCurrency(d.amount);
    if (d.payment_method) return `via ${d.payment_method}`;

    // Generic note/message
    if (d.note) return d.note;
    if (d.message) return d.message;
    if (d.reason) return d.reason;

    // Fields updated
    if (d.fields && Array.isArray(d.fields)) return `Updated: ${d.fields.join(', ')}`;

    return null;
  };

  const detailsSummary = getDetailsSummary();

  return (
    <div className="flex items-start gap-3 py-2 px-2 rounded hover:bg-muted/50 transition-colors">
      <div className={`mt-0.5 ${config.color}`}>
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{config.label}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(activity.created_at)}</span>
        </div>
        {activity.performed_by && (
          <p className="text-xs text-muted-foreground">by {activity.performed_by}</p>
        )}
        {detailsSummary && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{detailsSummary}</p>
        )}
      </div>
    </div>
  );
}

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
  const { data: budgetSummary = [] } = useBudgetSummary(invoice?.job_id || undefined);
  const { data: activityLog = [] } = useInvoiceActivity(invoiceId || '');

  const approveAndStamp = useApproveAndStampInvoice();
  const stampInvoice = useStampInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const changeStatus = useChangeInvoiceStatus();
  const recordCorrection = useRecordCorrection();

  const [showCostSuggestions, setShowCostSuggestions] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  // Vendor payment tracking
  const { data: paymentData } = usePaymentHistory(invoiceId || '');

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

  // Resolve vendor and job names with fallback to lookup from fetched lists
  const resolvedVendorName = invoice?.vendor_name ||
    vendors.find(v => v.id === invoice?.vendor_id)?.name ||
    null;
  const resolvedJobName = invoice?.job_name ||
    jobs.find(j => j.id === invoice?.job_id)?.name ||
    null;

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

      const response = await apiPost(`/api/invoices/${invoice.id}/allocate`, {
        allocations: validAllocs.map(a => ({
          cost_code_id: a.cost_code_id,
          amount: parseFloat(a.amount),
          notes: a.description || '',
          job_id: invoice.job_id,
        })),
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

  const handleApprove = async (allowPartial = false) => {
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

    // If partial allocation, confirm with user first
    if (isPartialAllocation && !allowPartial) {
      const remaining = invoice.amount - totalAllocated;
      const confirmed = window.confirm(
        `This invoice has only ${formatCurrency(totalAllocated)} of ${formatCurrency(invoice.amount)} allocated.\n\n` +
        `${formatCurrency(remaining)} remains unallocated.\n\n` +
        `When added to a draw, the allocated portion will be billed, and the invoice will return to "Needs Approval" for the remaining amount.\n\n` +
        `Proceed with partial approval?`
      );
      if (!confirmed) return;
      // Recursively call with allowPartial = true
      return handleApprove(true);
    }

    try {
      // Save allocations first
      const saved = await saveAllocations();
      if (!saved) return;

      // Use the new approve and stamp hook
      await approveAndStamp.mutateAsync({
        invoiceId: invoice.id,
        approvedBy: userName,
        allowPartial: isPartialAllocation
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
      <DialogContent className="w-full max-w-[95vw] lg:max-w-[1200px] xl:max-w-[1400px] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              Invoice: {invoice?.invoice_number}
              {resolvedVendorName && ` - ${resolvedVendorName}`}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Vendor Payment Status */}
              {invoice && (
                <PaymentStatusBadge
                  paymentStatus={invoice.payment_status}
                  paidAmount={paymentData?.summary?.total_paid || invoice.paid_amount}
                  totalAmount={invoice.amount}
                />
              )}

              {/* Workflow Status Dropdown */}
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
                      onClick={() => handleStatusChange('billed')}
                      disabled={invoice.status === 'billed'}
                    >
                      Billed (Draw Funded)
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

        <ScrollArea className="flex-1">
          <div className="py-4">
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
                    <p className="font-medium">{resolvedVendorName || '—'}</p>
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

              {/* Billable Status */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Billable to Client</Label>
                <div className="flex items-center gap-3">
                  <select
                    value={
                      invoice.billable_amount === null ? 'full' :
                      invoice.billable_amount === 0 ? 'none' : 'partial'
                    }
                    onChange={(e) => {
                      const value = e.target.value;
                      let billableAmount: number | null = null;
                      if (value === 'none') billableAmount = 0;
                      else if (value === 'partial') billableAmount = invoice.amount / 2; // Default to 50%
                      updateInvoice.mutate({
                        id: invoice.id,
                        billable_amount: billableAmount
                      });
                    }}
                    disabled={!canEdit}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="full">Fully Billable</option>
                    <option value="partial">Partially Billable</option>
                    <option value="none">Non-Billable</option>
                  </select>
                  {invoice.billable_amount !== null && invoice.billable_amount < invoice.amount && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        value={invoice.billable_amount}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          updateInvoice.mutate({
                            id: invoice.id,
                            billable_amount: Math.min(Math.max(0, value), invoice.amount)
                          });
                        }}
                        disabled={!canEdit}
                        className="w-32"
                      />
                      <span className="text-sm text-muted-foreground">
                        of {formatCurrency(invoice.amount)}
                      </span>
                    </div>
                  )}
                </div>
                {invoice.billable_amount !== null && invoice.billable_amount < invoice.amount && (
                  <div className="flex items-center gap-2 mt-2">
                    <Label className="text-sm text-muted-foreground">Reason:</Label>
                    <select
                      value={invoice.non_billable_reason || ''}
                      onChange={(e) => {
                        updateInvoice.mutate({
                          id: invoice.id,
                          non_billable_reason: e.target.value || null
                        });
                      }}
                      disabled={!canEdit}
                      className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Select reason...</option>
                      <option value="warranty">Warranty/Callback</option>
                      <option value="overhead">Overhead/Administrative</option>
                      <option value="rework">Rework (Our Error)</option>
                      <option value="goodwill">Customer Goodwill</option>
                      <option value="absorbed">Absorbed Cost Overrun</option>
                      <option value="other">Other</option>
                    </select>
                    {invoice.billable_amount === 0 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                        Not in Draw
                      </Badge>
                    )}
                  </div>
                )}
                {invoice.billable_amount !== null && invoice.billable_amount > 0 && invoice.billable_amount < invoice.amount && (
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(invoice.billable_amount)} will go to draw,
                    {formatCurrency(invoice.amount - invoice.billable_amount)} absorbed by contractor
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
                    <p className="font-medium">{resolvedJobName || 'Not assigned'}</p>
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

                {/* PO Balance - updates live as allocations change */}
                {invoice.po_id && (() => {
                  const po = purchaseOrders.find(p => p.id === invoice.po_id);
                  if (!po) return null;

                  const committed = po.current_amount ?? po.original_amount ?? 0;
                  const invoiced = po.invoiced_amount ?? 0;
                  const remaining = committed - invoiced;
                  const percentUsed = committed > 0 ? (invoiced / committed) * 100 : 0;
                  const isOverBudget = invoiced > committed;
                  // Use totalAllocated for live updates as user changes allocations
                  const currentAllocationTotal = totalAllocated > 0 ? totalAllocated : invoice.amount;
                  const willExceed = (invoiced + currentAllocationTotal) > committed;
                  const afterThisInvoice = remaining - currentAllocationTotal;

                  return (
                    <div className={`mt-3 p-3 rounded-lg border ${isOverBudget ? 'bg-red-50 border-red-200' : willExceed ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">PO Balance</span>
                        {isOverBudget ? (
                          <Badge variant="destructive" className="text-xs">Over PO</Badge>
                        ) : willExceed ? (
                          <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Will Exceed PO</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 border-0 text-xs">Within PO</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-sm">
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
                          <p className="text-muted-foreground text-xs">PO Remaining</p>
                          <p className={`font-medium ${remaining < 0 ? 'text-red-600' : remaining < currentAllocationTotal ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrency(remaining)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">After This</p>
                          <p className={`font-medium ${afterThisInvoice < 0 ? 'text-red-600' : afterThisInvoice < committed * 0.1 ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrency(afterThisInvoice)}
                          </p>
                          {afterThisInvoice < 0 && (
                            <p className="text-xs text-red-600">Exceeds PO</p>
                          )}
                        </div>
                      </div>
                      {/* Progress bar showing current + this invoice */}
                      <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full flex">
                          <div
                            className={`h-full ${isOverBudget ? 'bg-red-500' : percentUsed > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(percentUsed, 100)}%` }}
                          />
                          {!isOverBudget && currentAllocationTotal > 0 && (
                            <div
                              className={`h-full ${willExceed ? 'bg-red-300' : 'bg-blue-400'} opacity-60`}
                              style={{ width: `${Math.min((currentAllocationTotal / committed) * 100, 100 - percentUsed)}%` }}
                            />
                          )}
                        </div>
                      </div>
                      {currentAllocationTotal > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          This invoice: {formatCurrency(currentAllocationTotal)}
                        </p>
                      )}
                    </div>
                  );
                })()}

                {/* Budget Balance - per cost code */}
                {budgetSummary.length > 0 && allocations.length > 0 && (() => {
                  // Get budget info for allocated cost codes
                  const allocatedCostCodes = allocations
                    .filter(a => a.cost_code_id)
                    .map(a => {
                      const budget = budgetSummary.find(b => b.cost_code_id === a.cost_code_id);
                      const costCode = costCodes.find(c => c.id === a.cost_code_id);
                      return {
                        costCode: costCode?.code || '',
                        name: costCode?.name || budget?.name || 'Unknown',
                        budgeted: budget?.budget || 0,
                        actual: budget?.actual || 0,
                        committed: budget?.committed || 0,
                        allocAmount: parseFloat(a.amount as any) || 0,
                      };
                    })
                    .filter(a => a.budgeted > 0 || a.committed > 0);

                  if (allocatedCostCodes.length === 0) return null;

                  return (
                    <div className="mt-3 p-3 rounded-lg border bg-blue-50 border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Budget Balance by Cost Code</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        {allocatedCostCodes.map((cc, idx) => {
                          const budgetRemaining = cc.budgeted - cc.actual;
                          const afterThisInvoice = budgetRemaining - cc.allocAmount;
                          const willExceedBudget = afterThisInvoice < 0;
                          const budgetPercent = cc.budgeted > 0 ? (cc.actual / cc.budgeted) * 100 : 0;

                          return (
                            <div key={idx} className="p-2 bg-white/50 rounded border border-blue-100">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium text-xs">{cc.costCode} - {cc.name}</span>
                                {willExceedBudget ? (
                                  <Badge variant="destructive" className="text-xs">Over Budget</Badge>
                                ) : budgetRemaining < cc.allocAmount ? (
                                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Tight</Badge>
                                ) : (
                                  <Badge className="bg-green-100 text-green-700 border-0 text-xs">OK</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-1 text-xs">
                                <div>
                                  <p className="text-muted-foreground">Budget</p>
                                  <p className="font-medium">{formatCurrency(cc.budgeted)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Spent</p>
                                  <p className="font-medium">{formatCurrency(cc.actual)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Remaining</p>
                                  <p className={`font-medium ${budgetRemaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatCurrency(budgetRemaining)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">After This</p>
                                  <p className={`font-medium ${afterThisInvoice < 0 ? 'text-red-600' : afterThisInvoice < cc.budgeted * 0.1 ? 'text-amber-600' : 'text-green-600'}`}>
                                    {formatCurrency(afterThisInvoice)}
                                  </p>
                                </div>
                              </div>
                              {/* Budget progress bar */}
                              <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${budgetPercent > 100 ? 'bg-red-500' : budgetPercent > 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                  style={{ width: `${Math.min(budgetPercent, 100)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
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

              {/* Review Flags - Show prominently if present */}
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

              {/* Notes - Clean section for human input */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <Label>Notes</Label>
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes about this invoice..."
                  rows={2}
                  disabled={!canEdit}
                  className="resize-none"
                />
              </div>

              <Separator />

              {/* Activity Log */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <h4 className="font-medium">Activity</h4>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {activityLog.length > 0 ? (
                    activityLog.map((activity) => (
                      <ActivityItem key={activity.id} activity={activity} />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No activity recorded yet</p>
                  )}
                </div>
              </div>

              {/* AI Processing Info - Collapsible */}
              {(invoice.ai_processed || invoice.ai_confidence) && (
                <details className="group">
                  <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                    <Bot className="h-4 w-4" />
                    <span>AI Processing Details</span>
                    {invoice.ai_processed && (
                      <Badge variant="outline" className="text-xs ml-auto">AI Processed</Badge>
                    )}
                  </summary>
                  <div className="mt-2 pl-6 space-y-2">
                    {invoice.ai_confidence && (
                      <div className="space-y-1">
                        {Object.entries(invoice.ai_confidence).map(([key, value]) => (
                          <AIConfidenceBar
                            key={key}
                            confidence={value as number}
                            label={key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </details>
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
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
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
              {/* Record Payment Button - show when invoice is approved/in_draw/billed and not fully paid */}
              {invoice && ['approved', 'in_draw', 'billed', 'paid'].includes(invoice.status) && invoice.payment_status !== 'paid' && (
                <Button variant="outline" onClick={() => setShowPaymentDialog(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Record Payment
                </Button>
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

      {/* Record Vendor Payment Dialog */}
      <RecordPaymentDialog
        invoice={invoice || null}
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
      />
    </Dialog>
  );
}
