import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Combobox } from '@/components/ui/combobox';
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  Trash2,
  RotateCcw,
  Download,
  Loader2,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useUserName } from '@/contexts/UserContext';
import {
  useInvoices,
  useApproveInvoice,
  useUpdateInvoice,
  useVendors,
  useDBJobs,
  useDeleteInvoice,
  useBulkDeleteInvoices,
  useBulkApproveInvoices,
  useBulkStatusChange,
  useBulkAddToDraw,
  useCreateInvoice,
  useDraws,
} from '@/hooks/useFinancialData';
import {
  Invoice,
  InvoiceStatus,
  invoiceStatusConfig,
  formatCurrency,
  formatDateShort
} from '@/types/financial';
import { toast } from 'sonner';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { UnifiedAIUpload } from '@/components/ai/UnifiedAIUpload';
import { Sparkles } from 'lucide-react';

const InvoicesPage = () => {
  const { selectedJobId } = useJob();
  const userName = useUserName();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [addToDrawDialogOpen, setAddToDrawDialogOpen] = useState(false);
  const [selectedDrawId, setSelectedDrawId] = useState<string>('');

  // Form state for create dialog
  const [newInvoice, setNewInvoice] = useState({
    vendor_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    amount: '',
    due_date: '',
    notes: ''
  });

  const { data: invoices = [], isLoading } = useInvoices(selectedJobId || undefined, statusFilter);
  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useDBJobs();
  const { data: draws = [] } = useDraws();
  const approveInvoice = useApproveInvoice();
  const updateInvoice = useUpdateInvoice();
  const deleteInvoice = useDeleteInvoice();
  const bulkDelete = useBulkDeleteInvoices();
  const bulkApprove = useBulkApproveInvoices();
  const bulkStatusChange = useBulkStatusChange();
  const bulkAddToDraw = useBulkAddToDraw();
  const createInvoice = useCreateInvoice();

  // Get draft draws for the selected job
  const draftDraws = useMemo(() =>
    draws.filter(d => d.status === 'draft' && (!selectedJobId || d.job_id === selectedJobId)),
    [draws, selectedJobId]
  );

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;

    const query = searchQuery.toLowerCase();
    return invoices.filter(inv => {
      const vendorName = inv.vendor_name || vendors.find(v => v.id === inv.vendor_id)?.name || '';
      const jobName = inv.job_name || jobs.find(j => j.id === inv.job_id)?.name || '';
      return (
        inv.invoice_number?.toLowerCase().includes(query) ||
        vendorName.toLowerCase().includes(query) ||
        jobName.toLowerCase().includes(query)
      );
    });
  }, [invoices, searchQuery, vendors, jobs]);

  const stats = useMemo(() => ({
    needsApproval: invoices.filter(i => i.status === 'needs_approval').length,
    needsApprovalAmount: invoices.filter(i => i.status === 'needs_approval').reduce((sum, i) => sum + i.amount, 0),
    approved: invoices.filter(i => i.status === 'approved').reduce((sum, i) => sum + i.amount, 0),
    inDraw: invoices.filter(i => i.status === 'in_draw').reduce((sum, i) => sum + i.amount, 0),
    total: invoices.reduce((sum, i) => sum + i.amount, 0),
  }), [invoices]);

  // Resolve vendor/job names with fallback to lookup from fetched lists
  const getVendorName = (inv: Invoice) =>
    inv.vendor_name || vendors.find(v => v.id === inv.vendor_id)?.name || null;
  const getJobName = (inv: Invoice) =>
    inv.job_name || jobs.find(j => j.id === inv.job_id)?.name || null;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedInvoices(new Set(filteredInvoices.map(i => i.id)));
    } else {
      setSelectedInvoices(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedInvoices);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedInvoices(newSet);
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedInvoices);
    const eligibleInvoices = invoices.filter(i =>
      ids.includes(i.id) && (i.status === 'needs_approval' || i.status === 'received')
    );

    if (eligibleInvoices.length === 0) {
      toast.error('No invoices eligible for approval');
      return;
    }

    bulkApprove.mutate(
      { ids: eligibleInvoices.map(i => i.id), approvedBy: userName },
      { onSuccess: () => setSelectedInvoices(new Set()) }
    );
  };

  const handleBulkDeny = async () => {
    const ids = Array.from(selectedInvoices);
    bulkStatusChange.mutate(
      { ids, status: 'denied', performedBy: userName },
      { onSuccess: () => setSelectedInvoices(new Set()) }
    );
  };

  const handleBulkUnapprove = async () => {
    const ids = Array.from(selectedInvoices);
    const eligibleInvoices = invoices.filter(i =>
      ids.includes(i.id) && (i.status === 'approved' || i.status === 'in_draw')
    );

    if (eligibleInvoices.length === 0) {
      toast.error('No invoices eligible to send back');
      return;
    }

    bulkStatusChange.mutate(
      { ids: eligibleInvoices.map(i => i.id), status: 'needs_approval', performedBy: userName },
      { onSuccess: () => setSelectedInvoices(new Set()) }
    );
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedInvoices);
    bulkDelete.mutate(ids, {
      onSuccess: () => {
        setSelectedInvoices(new Set());
        setBulkDeleteConfirmOpen(false);
      }
    });
  };

  const handleBulkAddToDraw = async () => {
    if (!selectedDrawId) {
      toast.error('Please select a draw');
      return;
    }

    const ids = Array.from(selectedInvoices);
    const eligibleInvoices = invoices.filter(i =>
      ids.includes(i.id) && i.status === 'approved'
    );

    if (eligibleInvoices.length === 0) {
      toast.error('No approved invoices to add to draw');
      return;
    }

    bulkAddToDraw.mutate(
      { invoiceIds: eligibleInvoices.map(i => i.id), drawId: selectedDrawId },
      {
        onSuccess: () => {
          setSelectedInvoices(new Set());
          setAddToDrawDialogOpen(false);
          setSelectedDrawId('');
        }
      }
    );
  };

  const handleSingleDelete = (id: string) => {
    setInvoiceToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmSingleDelete = () => {
    if (invoiceToDelete) {
      deleteInvoice.mutate(invoiceToDelete, {
        onSuccess: () => {
          setDeleteConfirmOpen(false);
          setInvoiceToDelete(null);
        }
      });
    }
  };

  const handleCreateInvoice = () => {
    if (!selectedJobId) {
      toast.error('Please select a job first');
      return;
    }
    if (!newInvoice.vendor_id || !newInvoice.invoice_number || !newInvoice.amount) {
      toast.error('Please fill in required fields');
      return;
    }

    createInvoice.mutate(
      {
        job_id: selectedJobId,
        vendor_id: newInvoice.vendor_id,
        invoice_number: newInvoice.invoice_number,
        invoice_date: newInvoice.invoice_date,
        amount: parseFloat(newInvoice.amount),
        due_date: newInvoice.due_date || undefined,
        notes: newInvoice.notes || undefined,
      },
      {
        onSuccess: () => {
          setCreateDialogOpen(false);
          setNewInvoice({
            vendor_id: '',
            invoice_number: '',
            invoice_date: new Date().toISOString().split('T')[0],
            amount: '',
            due_date: '',
            notes: ''
          });
        }
      }
    );
  };

  const handleQuickApprove = (invoice: Invoice) => {
    setDetailInvoiceId(invoice.id);
    toast.info('Assign cost codes and approve from the detail view');
  };

  const handleQuickDeny = (invoice: Invoice) => {
    updateInvoice.mutate({ id: invoice.id, status: 'denied' });
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    const url = invoice.pdf_stamped_url || invoice.pdf_url;
    if (url) {
      window.open(url, '_blank');
    } else {
      toast.error('No PDF available');
    }
  };

  const getStatusBadge = (status: InvoiceStatus) => {
    const config = invoiceStatusConfig[status];
    return (
      <Badge className={`${config.bgColor} ${config.color} border-0`}>
        {config.label}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Review, approve, and track vendor invoices
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Invoice
            </Button>
            <UnifiedAIUpload
              contextHint="invoice"
              jobId={selectedJobId || undefined}
              trigger={
                <Button className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Upload Document
                </Button>
              }
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Needs Approval</p>
                  <p className="text-2xl font-semibold">{stats.needsApproval}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(stats.needsApprovalAmount)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.approved)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Ready for draw</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Draw</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.inDraw)}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Awaiting funding</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total This Period</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.total)}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Bulk Actions */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as InvoiceStatus | 'all')}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="needs_approval">Needs Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_draw">In Draw</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedInvoices.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">
                {selectedInvoices.size} selected
              </span>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkApprove}
                disabled={bulkApprove.isPending}
              >
                {bulkApprove.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ThumbsUp className="h-4 w-4 mr-2" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDeny}
                disabled={bulkStatusChange.isPending}
              >
                <ThumbsDown className="h-4 w-4 mr-2" />
                Deny
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkUnapprove}
                disabled={bulkStatusChange.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Send Back
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddToDrawDialogOpen(true)}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Add to Draw
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => setBulkDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedInvoices(new Set())}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Invoice Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading invoices...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No invoices found</p>
                    <UnifiedAIUpload
                      contextHint="invoice"
                      jobId={selectedJobId || undefined}
                      trigger={
                        <Button variant="outline" className="mt-4 gap-2">
                          <Sparkles className="h-4 w-4" />
                          Upload Document
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="group">
                    <TableCell>
                      <Checkbox 
                        checked={selectedInvoices.has(invoice.id)}
                        onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{getVendorName(invoice) || '—'}</TableCell>
                    <TableCell>{invoice.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{getJobName(invoice) || '—'}</TableCell>
                    <TableCell>{formatDateShort(invoice.invoice_date)}</TableCell>
                    <TableCell className={`text-right font-medium ${invoice.is_credit ? 'text-red-600' : ''}`}>
                      {invoice.is_credit ? '-' : ''}{formatCurrency(Math.abs(invoice.amount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setDetailInvoiceId(invoice.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailInvoiceId(invoice.id)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {invoice.status === 'needs_approval' && (
                              <>
                                <DropdownMenuItem onClick={() => handleQuickApprove(invoice)}>
                                  <ThumbsUp className="h-4 w-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickDeny(invoice)}>
                                  <ThumbsDown className="h-4 w-4 mr-2" />
                                  Deny
                                </DropdownMenuItem>
                              </>
                            )}
                            {invoice.status === 'approved' && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedInvoices(new Set([invoice.id]));
                                setAddToDrawDialogOpen(true);
                              }}>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Add to Draw
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'approved' || invoice.status === 'in_draw') && (
                              <DropdownMenuItem onClick={() => {
                                bulkStatusChange.mutate({
                                  ids: [invoice.id],
                                  status: 'needs_approval',
                                  performedBy: userName
                                });
                              }}>
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Send Back
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {(invoice.pdf_url || invoice.pdf_stamped_url) && (
                              <DropdownMenuItem onClick={() => handleDownloadPdf(invoice)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download PDF
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleSingleDelete(invoice.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Pagination */}
        {filteredInvoices.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Showing 1-{filteredInvoices.length} of {filteredInvoices.length}</span>
          </div>
        )}
      </div>

      {/* Detail Dialog */}
      <InvoiceDetailDialog
        invoiceId={detailInvoiceId}
        open={!!detailInvoiceId}
        onOpenChange={(open) => !open && setDetailInvoiceId(null)}
      />

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Vendor *</Label>
              <Combobox
                options={vendors.map(v => ({ value: v.id, label: v.name }))}
                value={newInvoice.vendor_id}
                onValueChange={(v) => setNewInvoice(prev => ({ ...prev, vendor_id: v }))}
                placeholder="Select vendor..."
                searchPlaceholder="Search vendors..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice # *</Label>
                <Input
                  value={newInvoice.invoice_number}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_number: e.target.value }))}
                  placeholder="INV-001"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newInvoice.amount}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={newInvoice.invoice_date}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={newInvoice.due_date}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional notes..."
              />
            </div>
            {!selectedJobId && (
              <p className="text-sm text-amber-600">
                Please select a job from the sidebar to create an invoice.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateInvoice}
              disabled={!selectedJobId || createInvoice.isPending}
            >
              {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Draw Dialog */}
      <Dialog open={addToDrawDialogOpen} onOpenChange={setAddToDrawDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Draw</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Select a draft draw to add {selectedInvoices.size} invoice(s) to:
            </p>
            {draftDraws.length === 0 ? (
              <p className="text-sm text-amber-600">
                No draft draws available. Create a draw first.
              </p>
            ) : (
              <Select value={selectedDrawId} onValueChange={setSelectedDrawId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select draw..." />
                </SelectTrigger>
                <SelectContent>
                  {draftDraws.map((draw) => (
                    <SelectItem key={draw.id} value={draw.id}>
                      Draw #{draw.draw_number} - {draw.job_name || 'Unknown Job'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddToDrawDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBulkAddToDraw}
              disabled={!selectedDrawId || bulkAddToDraw.isPending}
            >
              {bulkAddToDraw.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Draw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Delete Confirm */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSingleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirm */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedInvoices.size} Invoice(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedInvoices.size} selected invoice(s)?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={bulkDelete.isPending}
            >
              {bulkDelete.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default InvoicesPage;
