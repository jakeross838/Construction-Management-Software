import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
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
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useInvoices, useVendors, useJobs, usePurchaseOrders, useUpdateInvoice, useCostCodes } from '@/hooks/useFinancialData';
import { formatCurrency, formatDate, invoiceStatusConfig } from '@/types/financial';
import { UnifiedAIUpload } from '@/components/ai/UnifiedAIUpload';
import { CompactStats } from '@/components/ui/compact-stats';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { ReviewFlagsList } from '@/components/invoices/ReviewFlagsBadges';
import { AIConfidenceBadge } from '@/components/invoices/AIConfidenceBadge';
import { InvoiceBulkActions } from '@/components/invoices/InvoiceBulkActions';

const Invoices = () => {
  const isMobile = useIsMobile();
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

  // Calculate stats from filtered data (respects job filter)
  const stats = useMemo(() => {
    const needsReview = filteredInvoices.filter(i => i.status === 'needs_review');
    const needsApproval = filteredInvoices.filter(i => i.status === 'needs_approval');
    const approved = filteredInvoices.filter(i => i.status === 'approved');
    const inDraw = filteredInvoices.filter(i => i.status === 'in_draw');

    // Count both needs_review and needs_approval as "needs attention"
    const needsAttention = [...needsReview, ...needsApproval];

    return {
      needsApprovalCount: needsAttention.length,
      needsApprovalAmount: needsAttention.reduce((sum, i) => sum + i.amount, 0),
      approvedAmount: approved.reduce((sum, i) => sum + i.amount, 0),
      inDrawAmount: inDraw.reduce((sum, i) => sum + i.amount, 0),
      total: filteredInvoices.length,
    };
  }, [filteredInvoices]);

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

  const handleViewInvoice = (id: string) => {
    setSelectedInvoiceId(id);
    setDetailDialogOpen(true);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-10 w-40" />
          </div>
          {/* Filters & stats skeleton */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <Skeleton className="h-10 w-full max-w-sm" />
              <Skeleton className="h-10 w-44" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          </div>
          {/* Table skeleton */}
          <Skeleton className="h-10 w-full" />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
            <p className="text-sm text-muted-foreground">Review and approve vendor invoices</p>
          </div>
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

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="invoice-search"
                  name="invoice-search"
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="needs_review">Needs Review</SelectItem>
                  <SelectItem value="needs_approval">Needs Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="in_draw">In Draw</SelectItem>
                  <SelectItem value="billed">Billed</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="denied">Denied</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CompactStats
            stats={[
              { label: 'Needs Approval', value: stats.needsApprovalCount, subValue: formatCurrency(stats.needsApprovalAmount), icon: AlertCircle, color: 'amber' },
              { label: 'Approved', value: formatCurrency(stats.approvedAmount), icon: CheckCircle, color: 'green' },
              { label: 'In Draw', value: formatCurrency(stats.inDrawAmount), icon: Clock, color: 'blue' },
              { label: 'Total', value: stats.total, icon: FileText, color: 'default' },
            ]}
          />
        </div>

        {/* Bulk Actions Bar */}
        <InvoiceBulkActions
          selectedIds={selectedIds}
          invoices={invoices}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* Invoice Sections by Status */}
        {['needs_review', 'needs_approval', 'ready_for_approval', 'approved', 'in_draw', 'billed', 'paid', 'denied', 'received'].map((status) => {
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
              </div>
              {isMobile ? (
                /* Mobile: Card-based list */
                <div className="divide-y">
                  {statusInvoices.map((invoice) => {
                    const statusCfg = invoiceStatusConfig[invoice.status as keyof typeof invoiceStatusConfig];
                    return (
                      <div
                        key={invoice.id}
                        className="flex items-start gap-3 p-4 min-h-[44px] cursor-pointer active:bg-muted/50"
                        onClick={() => handleViewInvoice(invoice.id)}
                      >
                        <div
                          className="pt-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.includes(invoice.id)}
                            onCheckedChange={(checked) => handleSelectOne(invoice.id, !!checked)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm truncate">
                                  {invoice.invoice_number || 'No #'}
                                </span>
                                {invoice.needs_review && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-foreground truncate">
                                {getVendorName(invoice.vendor_id)}
                              </p>
                            </div>
                            <span className="font-semibold text-sm whitespace-nowrap">
                              {formatCurrency(invoice.amount)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {getJobName(invoice.job_id)}
                            </span>
                            {statusCfg && (
                              <Badge className={`${statusCfg.bgColor} ${statusCfg.color} border-0 text-[10px] px-1.5 py-0`}>
                                {statusCfg.label}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {formatDate(invoice.invoice_date)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Desktop: Table view */
                <div className="overflow-x-auto">
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
                      <TableHead className="hidden md:table-cell">Job</TableHead>
                      <TableHead className="hidden lg:table-cell">PO #</TableHead>
                      <TableHead className="hidden lg:table-cell">Budget Standing</TableHead>
                      <TableHead className="hidden xl:table-cell">AI Confidence</TableHead>
                      <TableHead className="hidden sm:table-cell">Date</TableHead>
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
                          <TableCell className="hidden md:table-cell">{getJobName(invoice.job_id)}</TableCell>
                          <TableCell className="hidden lg:table-cell text-muted-foreground">{po?.po_number || '—'}</TableCell>
                          <TableCell className="hidden lg:table-cell">
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
                          <TableCell className="hidden xl:table-cell">
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
                          <TableCell className="hidden sm:table-cell">{formatDate(invoice.invoice_date)}</TableCell>
                          <TableCell className="font-medium text-right">{formatCurrency(invoice.amount)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </Card>
          );
        })}

        {!isLoading && filteredInvoices.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            No invoices found
          </Card>
        )}
      </div>

      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </AppLayout>
  );
};

export default Invoices;
