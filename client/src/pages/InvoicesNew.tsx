import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search, 
  Plus, 
  Upload,
  FileText,
  Clock,
  CheckCircle,
  DollarSign,
  AlertCircle,
  Eye,
  MoreHorizontal,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useInvoices, useApproveInvoice, useUpdateInvoice, useVendors } from '@/hooks/useFinancialData';
import { 
  Invoice, 
  InvoiceStatus, 
  invoiceStatusConfig, 
  formatCurrency, 
  formatDateShort 
} from '@/types/financial';
import { toast } from 'sonner';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { InvoiceUploadDialog } from '@/components/invoices/InvoiceUploadDialog';

const InvoicesPage = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
  const [detailInvoiceId, setDetailInvoiceId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { data: invoices = [], isLoading } = useInvoices(selectedJobId || undefined, statusFilter);
  const { data: vendors = [] } = useVendors();
  const approveInvoice = useApproveInvoice();
  const updateInvoice = useUpdateInvoice();

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoices;

    const query = searchQuery.toLowerCase();
    return invoices.filter(inv =>
      inv.invoice_number?.toLowerCase().includes(query) ||
      inv.vendor_name?.toLowerCase().includes(query) ||
      inv.job_name?.toLowerCase().includes(query)
    );
  }, [invoices, searchQuery]);

  const stats = useMemo(() => ({
    needsApproval: invoices.filter(i => i.status === 'needs_approval').length,
    needsApprovalAmount: invoices.filter(i => i.status === 'needs_approval').reduce((sum, i) => sum + i.amount, 0),
    approved: invoices.filter(i => i.status === 'approved').reduce((sum, i) => sum + i.amount, 0),
    inDraw: invoices.filter(i => i.status === 'in_draw').reduce((sum, i) => sum + i.amount, 0),
    total: invoices.reduce((sum, i) => sum + i.amount, 0),
  }), [invoices]);

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
    // Note: For bulk approval, invoices should have allocations set up beforehand
    // This is a simplified version - in practice, you'd validate each invoice has allocations
    toast.info('Open each invoice to assign cost codes before approval', {
      description: 'Cost code allocations are required for approval.',
    });
    setSelectedInvoices(new Set());
  };

  const handleQuickApprove = (invoice: Invoice) => {
    // Quick approve only works from detail dialog where allocations can be verified
    setDetailInvoiceId(invoice.id);
    toast.info('Assign cost codes and approve from the detail view');
  };

  const handleQuickDeny = (invoice: Invoice) => {
    updateInvoice.mutate({ id: invoice.id, status: 'denied' });
    toast.success('Invoice denied');
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
          <Button className="gap-2" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="h-4 w-4" />
            Upload Invoice
          </Button>
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
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedInvoices.size} selected
              </span>
              <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                <ThumbsUp className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button size="sm" variant="outline">
                <ArrowRight className="h-4 w-4 mr-2" />
                Add to Draw
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
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => setUploadDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Invoice
                    </Button>
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
                    <TableCell className="font-medium">{invoice.vendor_name || '—'}</TableCell>
                    <TableCell>{invoice.invoice_number}</TableCell>
                    <TableCell className="text-muted-foreground">{invoice.job_name || '—'}</TableCell>
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
                              <DropdownMenuItem>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Add to Draw
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <FileText className="h-4 w-4 mr-2" />
                              Download PDF
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

      {/* Upload Dialog */}
      <InvoiceUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        vendors={vendors}
        selectedJobId={selectedJobId}
      />
    </AppLayout>
  );
};

export default InvoicesPage;
