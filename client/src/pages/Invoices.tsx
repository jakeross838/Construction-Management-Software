import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Upload,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useInvoices, useVendors, useJobs, usePurchaseOrders, useUpdateInvoice, useCostCodes } from '@/hooks/useFinancialData';
import { formatCurrency, formatDate, invoiceStatusConfig } from '@/types/financial';
import { InvoiceUploadDialog } from '@/components/invoices/InvoiceUploadDialog';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { ReviewFlagsList } from '@/components/invoices/ReviewFlagsBadges';
import { AIConfidenceBadge } from '@/components/invoices/AIConfidenceBadge';

const Invoices = () => {
  const { selectedJobId } = useJob();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: vendors = [] } = useVendors();
  const { data: jobs = [] } = useJobs();
  const { data: purchaseOrders = [] } = usePurchaseOrders();
  const { data: costCodes = [] } = useCostCodes();
  const updateInvoice = useUpdateInvoice();

  // Build a map of cost code spending from all invoices
  const costCodeSpending = useMemo(() => {
    const spending: Record<string, number> = {};
    // Sum up invoice amounts by their PO's cost code (simplified - assuming 1 cost code per PO for now)
    invoices.forEach(inv => {
      const po = purchaseOrders.find(p => p.id === inv.po_id);
      if (po && (inv.status === 'approved' || inv.status === 'in_draw' || inv.status === 'paid')) {
        // For now, we'll track by PO - in a full implementation, this would use invoice_allocations
        // This is a simplified view
      }
    });
    return spending;
  }, [invoices, purchaseOrders]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const vendor = vendors.find(v => v.id === inv.vendor_id);
      const job = jobs.find(j => j.id === inv.job_id);
      
      const matchesSearch = !searchQuery.trim() ||
        inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        job?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchesJob = !selectedJobId || inv.job_id === selectedJobId;
      
      return matchesSearch && matchesStatus && matchesJob;
    });
  }, [invoices, vendors, jobs, searchQuery, statusFilter, selectedJobId]);

  const stats = useMemo(() => {
    const needsReview = invoices.filter(i => i.status === 'needs_review');
    const needsApproval = invoices.filter(i => i.status === 'needs_approval');
    const approved = invoices.filter(i => i.status === 'approved');
    const inDraw = invoices.filter(i => i.status === 'in_draw');

    // Count both needs_review and needs_approval as "needs attention"
    const needsAttention = [...needsReview, ...needsApproval];

    return {
      needsApprovalCount: needsAttention.length,
      needsApprovalAmount: needsAttention.reduce((sum, i) => sum + i.amount, 0),
      approvedAmount: approved.reduce((sum, i) => sum + i.amount, 0),
      inDrawAmount: inDraw.reduce((sum, i) => sum + i.amount, 0),
      totalThisMonth: invoices.reduce((sum, i) => sum + i.amount, 0),
    };
  }, [invoices]);

  const getVendorName = (vendorId: string | null) => {
    if (!vendorId) return '—';
    return vendors.find(v => v.id === vendorId)?.name || 'Unknown';
  };

  const getJobName = (jobId: string | null) => {
    if (!jobId) return '—';
    return jobs.find(j => j.id === jobId)?.name || 'Unknown';
  };

  const getPO = (poId: string | null) => {
    if (!poId) return null;
    return purchaseOrders.find(po => po.id === poId) || null;
  };

  // Get budget context for an invoice based on its PO
  const getBudgetContext = (invoice: typeof invoices[0]) => {
    const po = getPO(invoice.po_id);
    if (!po) return null;
    
    // Show PO committed amount and how much has been invoiced against it
    const committed = po.current_amount ?? po.original_amount ?? 0;
    const invoiced = po.invoiced_amount ?? 0;
    const remaining = committed - invoiced;
    
    return {
      committed,
      invoiced,
      remaining,
      percentUsed: committed > 0 ? (invoiced / committed) * 100 : 0,
      isOverBudget: invoiced > committed
    };
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredInvoices.map(inv => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkApprove = async () => {
    const toApprove = invoices.filter(inv => 
      selectedIds.includes(inv.id) && inv.status === 'needs_approval'
    );
    
    for (const inv of toApprove) {
      await updateInvoice.mutateAsync({
        id: inv.id,
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'Current User',
      });
    }
    
    setSelectedIds([]);
  };

  const handleViewInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setDetailDialogOpen(true);
  };

  const pendingApprovalSelected = selectedIds.some(id => {
    const inv = invoices.find(i => i.id === id);
    return inv && inv.status === 'needs_approval';
  });

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground">Review and approve vendor invoices</p>
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
                  <p className="text-2xl font-semibold">{stats.needsApprovalCount}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-amber-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats.needsApprovalAmount)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.approvedAmount)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Ready for draw</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Draw</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.inDrawAmount)}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">Awaiting funding</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total This Month</p>
                  <p className="text-2xl font-semibold">{formatCurrency(stats.totalThisMonth)}</p>
                </div>
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{invoices.length} invoices</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Bulk Actions */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="needs_review">Needs Review</SelectItem>
                <SelectItem value="needs_approval">Needs Approval</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="in_draw">In Draw</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="denied">Denied</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Invoice Sections by Status */}
        {['needs_review', 'needs_approval', 'approved', 'in_draw', 'paid', 'denied', 'received'].map((status) => {
          const statusInvoices = filteredInvoices.filter(inv => inv.status === status);
          if (statusInvoices.length === 0) return null;
          
          const config = invoiceStatusConfig[status as keyof typeof invoiceStatusConfig];
          
          return (
            <Card key={status}>
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className={`${config.bgColor} ${config.color} border-0`}>
                    {config.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {statusInvoices.length} invoice{statusInvoices.length !== 1 ? 's' : ''} · {formatCurrency(statusInvoices.reduce((sum, i) => sum + i.amount, 0))}
                  </span>
                </div>
                {status === 'needs_approval' && statusInvoices.some(inv => selectedIds.includes(inv.id)) && (
                  <Button size="sm" className="gap-2" onClick={handleBulkApprove}>
                    <ThumbsUp className="h-4 w-4" />
                    Approve Selected
                  </Button>
                )}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox 
                        checked={statusInvoices.every(inv => selectedIds.includes(inv.id)) && statusInvoices.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds(prev => [...new Set([...prev, ...statusInvoices.map(inv => inv.id)])]);
                          } else {
                            setSelectedIds(prev => prev.filter(id => !statusInvoices.some(inv => inv.id === id)));
                          }
                        }}
                      />
                    </TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>PO #</TableHead>
                    <TableHead>Budget Standing</TableHead>
                    <TableHead>AI Confidence</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusInvoices.map((invoice) => {
                    const po = getPO(invoice.po_id);
                    const budgetCtx = getBudgetContext(invoice);
                    
                    return (
                      <TableRow 
                        key={invoice.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleViewInvoice(invoice.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedIds.includes(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {invoice.invoice_number}
                            {invoice.needs_review && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getVendorName(invoice.vendor_id)}</TableCell>
                        <TableCell>{getJobName(invoice.job_id)}</TableCell>
                        <TableCell className="text-muted-foreground">{po?.po_number || '—'}</TableCell>
                        <TableCell>
                          {budgetCtx ? (
                            <div className="flex flex-col">
                              <span className={budgetCtx.isOverBudget ? 'text-destructive font-medium' : 'text-foreground'}>
                                {formatCurrency(budgetCtx.remaining)} left
                                {budgetCtx.isOverBudget && ' ⚠️'}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(budgetCtx.invoiced)} / {formatCurrency(budgetCtx.committed)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {invoice.matched_confidence?.overall ? (
                            <div className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <AIConfidenceBadge 
                                confidence={invoice.matched_confidence.overall} 
                                showPercent={false}
                              />
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell className="font-medium text-right">{formatCurrency(invoice.amount)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          );
        })}

        {!isLoading && filteredInvoices.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No invoices found
          </Card>
        )}
      </div>

      <InvoiceUploadDialog 
        open={uploadDialogOpen} 
        onOpenChange={setUploadDialogOpen}
        vendors={vendors}
        selectedJobId={selectedJobId}
      />

      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </AppLayout>
  );
};

export default Invoices;
