import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Download, 
  Send, 
  CheckCircle, 
  Clock, 
  DollarSign,
  FileText,
  Calendar,
  Receipt,
  FileEdit,
  ShieldCheck,
  X,
  Undo2,
  Eye,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency, formatDate, drawStatusConfig } from '@/types/financial';
import type { G703LineItem, LienRelease, ChangeOrder, Invoice } from '@/types/financial';
import { useDraw, useBudgetLines, useChangeOrdersByDraw, useLienReleasesByDraw } from '@/hooks/useFinancialData';
import { 
  useSubmitDraw, 
  useUnsubmitDraw, 
  useRemoveInvoiceFromDraw,
  useRemoveChangeOrderFromDraw,
  useRemoveLienReleaseFromDraw,
} from '@/hooks/useDrawMutations';
import { cn } from '@/lib/utils';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { COInvoicesDialog } from './COInvoicesDialog';
import { LienReleaseQuickView } from './LienReleaseQuickView';
import { FundDrawDialog } from './FundDrawDialog';
import { toast } from 'sonner';

interface DrawDetailPanelProps {
  drawId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DrawDetailPanel({ drawId, open, onOpenChange }: DrawDetailPanelProps) {
  const { data: draw, isLoading } = useDraw(drawId || '');
  const { data: budgetLines } = useBudgetLines(draw?.job_id || '');
  const { data: pccos = [] } = useChangeOrdersByDraw(drawId);
  const { data: lienReleases = [] } = useLienReleasesByDraw(drawId);
  
  // Mutations
  const submitDraw = useSubmitDraw();
  const unsubmitDraw = useUnsubmitDraw();
  const removeInvoice = useRemoveInvoiceFromDraw();
  const removeCO = useRemoveChangeOrderFromDraw();
  const removeLR = useRemoveLienReleaseFromDraw();
  
  // View dialogs
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedCO, setSelectedCO] = useState<ChangeOrder | null>(null);
  const [coInvoicesDialogOpen, setCOInvoicesDialogOpen] = useState(false);
  const [selectedLR, setSelectedLR] = useState<LienRelease | null>(null);
  const [lrDialogOpen, setLRDialogOpen] = useState(false);
  const [fundDialogOpen, setFundDialogOpen] = useState(false);

  // Use scheduleOfValues from API response (already computed by backend)
  const g703Lines: G703LineItem[] = useMemo(() => {
    // Use pre-computed scheduleOfValues from API if available
    if (draw?.scheduleOfValues && draw.scheduleOfValues.length > 0) {
      return draw.scheduleOfValues.map((sov: any) => ({
        cost_code: sov.costCode || '—',
        description: sov.description || 'Unknown',
        scheduled_value: sov.scheduledValue || 0,
        previous_applications: sov.previousBilled || 0,
        this_period: sov.thisPeriod || 0,
        materials_stored: sov.materialsStored || 0,
        total_completed: sov.totalBilled || 0,
        percent_complete: Math.min(Math.round(sov.percentComplete || 0), 100),
        balance_to_finish: sov.balance || 0,
      }));
    }

    // Fallback: compute from budget lines if scheduleOfValues not available
    if (!budgetLines) return [];

    // Build map of invoice amounts by cost code
    const invoicesByCostCode = new Map<string, number>();
    draw?.invoices?.forEach((invoice: any) => {
      const allocations = invoice.invoice_allocations || invoice.allocations || [];
      allocations.forEach((alloc: any) => {
        if (alloc.cost_code_id) {
          const current = invoicesByCostCode.get(alloc.cost_code_id) || 0;
          invoicesByCostCode.set(alloc.cost_code_id, current + (alloc.amount || 0));
        }
      });
    });

    return budgetLines.map(bl => {
      const thisPeriod = invoicesByCostCode.get(bl.cost_code_id) || 0;
      const totalCompleted = thisPeriod;
      const percentComplete = bl.budgeted_amount > 0
        ? Math.round((totalCompleted / bl.budgeted_amount) * 100)
        : 0;

      return {
        cost_code: bl.cost_code || '—',
        description: bl.cost_code_name || 'Unknown',
        scheduled_value: bl.budgeted_amount || 0,
        previous_applications: 0,
        this_period: thisPeriod,
        materials_stored: 0,
        total_completed: totalCompleted,
        percent_complete: percentComplete,
        balance_to_finish: (bl.budgeted_amount || 0) - totalCompleted,
      };
    });
  }, [draw?.scheduleOfValues, draw?.invoices, budgetLines]);
  
  // Early return AFTER all hooks
  if (!drawId) return null;

  const config = draw ? drawStatusConfig[draw.status] : null;
  const isDraft = draw?.status === 'draft';
  const isSubmitted = draw?.status === 'submitted';
  const isFunded = draw?.status === 'funded';
  
  // Calculate G702 summary
  const invoiceTotal = draw?.invoices?.reduce((sum, inv: any) => sum + (inv.amount || 0), 0) || 0;
  const pccoTotal = pccos.reduce((sum, co) => sum + (co.total_amount || 0), 0);
  
  const g702 = draw ? {
    contractAmount: 0,
    changeOrdersAmount: pccoTotal,
    totalContract: 0,
    completedPrevious: 0,
    completedThisPeriod: draw.current_payment_due || 0,
    totalCompleted: draw.total_completed || 0,
    percentComplete: 0,
    currentPaymentDue: draw.current_payment_due || 0,
  } : null;
  
  // Filter to only show lines affected this period (have activity)
  const activeG703Lines = g703Lines.filter(line => line.this_period > 0);
  const g703Total = activeG703Lines.reduce((sum, l) => sum + l.this_period, 0);
  
  // Validation: all invoices must have cost code allocations
  const invoicesWithAllocations = draw?.invoices?.filter((inv: any) => {
    const allocations = inv.invoice_allocations || inv.allocations || [];
    return allocations.length > 0 && allocations.some((a: any) => a.cost_code_id);
  }) || [];
  const invoicesWithoutAllocations = (draw?.invoices || []).filter((inv: any) => {
    const allocations = inv.invoice_allocations || inv.allocations || [];
    return allocations.length === 0 || !allocations.some((a: any) => a.cost_code_id);
  });
  const allInvoicesHaveAllocations = draw?.invoices?.length ? invoicesWithoutAllocations.length === 0 : true;
  
  // Handler functions
  const handleSubmit = async () => {
    if (!draw) return;
    if (!allInvoicesHaveAllocations) {
      toast.error('All invoices must have cost code allocations before submitting');
      return;
    }
    await submitDraw.mutateAsync({ drawId: draw.id, submittedBy: 'Current User' });
  };
  
  const handleUnsubmit = async () => {
    if (!draw) return;
    await unsubmitDraw.mutateAsync(draw.id);
  };
  
  const handleRemoveInvoice = async (invoiceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDraft) {
      toast.error('Can only remove invoices from draft draws');
      return;
    }
    await removeInvoice.mutateAsync(invoiceId);
  };
  
  const handleRemoveCO = async (coId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDraft) {
      toast.error('Can only remove PCCOs from draft draws');
      return;
    }
    await removeCO.mutateAsync(coId);
  };
  
  const handleRemoveLR = async (lrId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDraft) {
      toast.error('Can only remove lien releases from draft draws');
      return;
    }
    await removeLR.mutateAsync(lrId);
  };
  
  const openInvoice = (invoice: any) => {
    setSelectedInvoiceId(invoice.id);
    setInvoiceDialogOpen(true);
  };
  
  const openCO = (co: ChangeOrder) => {
    setSelectedCO(co);
    setCOInvoicesDialogOpen(true);
  };
  
  const openLR = (lr: LienRelease) => {
    setSelectedLR(lr);
    setLRDialogOpen(true);
  };
  
  // Funding status display
  const getFundingStatus = () => {
    if (!isFunded || !draw) return null;
    // Use G702 currentPaymentDue, fallback to total_amount (sum of invoices)
    const due = draw.g702?.currentPaymentDue || draw.total_amount || 0;
    const funded = draw.funded_amount || 0;
    if (funded === due) return { status: 'full', variance: 0 };
    if (funded < due) return { status: 'partial', variance: funded - due };
    return { status: 'over', variance: funded - due };
  };
  
  const fundingStatus = getFundingStatus();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 gap-0">
          {isLoading || !draw ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <DialogHeader className="border-b px-6 py-4 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <DialogTitle className="text-xl">Draw #{draw.draw_number}</DialogTitle>
                      <Badge 
                        variant="outline" 
                        className={cn("border", config?.color)}
                      >
                        {config?.label}
                      </Badge>
                      {fundingStatus && fundingStatus.status !== 'full' && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            fundingStatus.status === 'partial' 
                              ? 'border-amber-500 text-amber-600 bg-amber-50' 
                              : 'border-blue-500 text-blue-600 bg-blue-50'
                          )}
                        >
                          {fundingStatus.status === 'partial' ? 'Partial' : 'Over-Funded'}
                          {' '}({formatCurrency(Math.abs(fundingStatus.variance))})
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{draw.job_name}</p>
                  </div>
                </div>
                
                {/* Quick Actions */}
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export G702/G703
                  </Button>
                  
                  {isDraft && (
                    <>
                      {!allInvoicesHaveAllocations && (draw?.invoices?.length || 0) > 0 && (
                        <Badge variant="outline" className="text-amber-600 border-amber-500 gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {invoicesWithoutAllocations.length} invoice(s) missing cost codes
                        </Badge>
                      )}
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={handleSubmit}
                        disabled={submitDraw.isPending || !allInvoicesHaveAllocations}
                        title={!allInvoicesHaveAllocations ? 'All invoices must have cost code allocations' : ''}
                      >
                        <Send className="h-4 w-4" />
                        Submit Draw
                      </Button>
                    </>
                  )}
                  
                  {isSubmitted && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={handleUnsubmit}
                        disabled={unsubmitDraw.isPending}
                      >
                        <Undo2 className="h-4 w-4" />
                        Unsubmit
                      </Button>
                      <Button 
                        size="sm" 
                        className="gap-2"
                        onClick={() => setFundDialogOpen(true)}
                      >
                        <CheckCircle className="h-4 w-4" />
                        Mark as Funded
                      </Button>
                    </>
                  )}
                </div>
              </DialogHeader>

              {/* Content - Single Scrollable Page */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Period Info & G702 Summary Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Period Info */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Draw Period
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Period Start</p>
                          <p className="font-medium">{formatDate(draw.period_start)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Period End</p>
                          <p className="font-medium">{formatDate(draw.period_end)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Application Date</p>
                          <p className="font-medium">
                            {draw.application_date ? formatDate(draw.application_date) : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Created</p>
                          <p className="font-medium">{formatDate(draw.created_at)}</p>
                        </div>
                      </div>

                      {/* Timeline */}
                      <Separator />
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Timeline</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="gap-1.5">
                            <FileText className="h-3 w-3" />
                            Created {formatDate(draw.created_at)}
                          </Badge>
                          {draw.submitted_at && (
                            <Badge variant="outline" className="gap-1.5 border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                              <Send className="h-3 w-3" />
                              Submitted {formatDate(draw.submitted_at)}
                            </Badge>
                          )}
                          {draw.funded_at && (
                            <Badge variant="outline" className="gap-1.5 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                              <DollarSign className="h-3 w-3" />
                              Funded {formatDate(draw.funded_at)}
                            </Badge>
                          )}
                          {draw.status === 'draft' && (
                            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Pending Submission
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* G702 Financial Summary */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Application for Payment (G702)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Invoices Total</p>
                          <p className="text-lg font-semibold">{formatCurrency(invoiceTotal)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">PCCO Total</p>
                          <p className="text-lg font-semibold">{formatCurrency(pccoTotal)}</p>
                        </div>
                      </div>
                      
                      <div className="bg-primary/5 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">Current Payment Due</p>
                            <p className="text-2xl font-bold text-primary">
                              {formatCurrency(g702?.currentPaymentDue || 0)}
                            </p>
                          </div>
                          <DollarSign className="h-8 w-8 text-primary" />
                        </div>
                      </div>

                      {draw.funded_amount !== null && draw.funded_amount !== undefined && (
                        <div className={cn(
                          "rounded-lg p-4",
                          fundingStatus?.status === 'partial' 
                            ? "bg-amber-50 dark:bg-amber-950/20" 
                            : fundingStatus?.status === 'over'
                            ? "bg-blue-50 dark:bg-blue-950/20"
                            : "bg-green-50 dark:bg-green-950/20"
                        )}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Funded Amount</p>
                              <p className={cn(
                                "text-xl font-bold",
                                fundingStatus?.status === 'partial' 
                                  ? "text-amber-600" 
                                  : fundingStatus?.status === 'over'
                                  ? "text-blue-600"
                                  : "text-green-600"
                              )}>
                                {formatCurrency(draw.funded_amount)}
                              </p>
                              {fundingStatus && fundingStatus.variance !== 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {fundingStatus.status === 'partial' ? 'Shortfall' : 'Overage'}: {formatCurrency(Math.abs(fundingStatus.variance))}
                                </p>
                              )}
                            </div>
                            {fundingStatus?.status === 'partial' ? (
                              <AlertTriangle className="h-8 w-8 text-amber-600" />
                            ) : fundingStatus?.status === 'over' ? (
                              <TrendingUp className="h-8 w-8 text-blue-600" />
                            ) : (
                              <CheckCircle className="h-8 w-8 text-green-600" />
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Notes */}
                {draw.notes && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{draw.notes}</p>
                    </CardContent>
                  </Card>
                )}

                {/* G703 Schedule - Lines Affected This Period */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Continuation Sheet (G703) — Lines Affected This Period
                      {activeG703Lines.length > 0 && (
                        <span className="text-muted-foreground font-normal">
                          • {formatCurrency(g703Total)}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {activeG703Lines.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-20">Code</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Scheduled Value</TableHead>
                              <TableHead className="text-right">Previous</TableHead>
                              <TableHead className="text-right">This Period</TableHead>
                              <TableHead className="text-right">% Complete</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeG703Lines.map((line, idx) => (
                              <TableRow key={idx} className="bg-primary/5">
                                <TableCell className="font-mono text-xs">{line.cost_code}</TableCell>
                                <TableCell className="text-sm">{line.description}</TableCell>
                                <TableCell className="text-right">{formatCurrency(line.scheduled_value)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(line.previous_applications)}</TableCell>
                                <TableCell className="text-right font-semibold text-primary">
                                  {formatCurrency(line.this_period)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Progress value={line.percent_complete} className="h-1.5 w-12" />
                                    <span className="text-xs">{line.percent_complete}%</span>
                                  </div>
                                </TableCell>
                                <TableCell className={cn(
                                  "text-right",
                                  line.balance_to_finish < 0 && "text-destructive font-semibold"
                                )}>
                                  {formatCurrency(line.balance_to_finish)}
                                  {line.balance_to_finish < 0 && (
                                    <AlertTriangle className="inline-block h-3 w-3 ml-1" />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No budget lines affected this period</p>
                        <p className="text-xs mt-1">Invoice allocations with cost codes will appear here</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Linked Invoices */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Invoices ({draw.invoices?.length || 0})
                      {invoiceTotal > 0 && (
                        <span className="text-muted-foreground font-normal">
                          • {formatCurrency(invoiceTotal)}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {draw.invoices && draw.invoices.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {draw.invoices.map((invoice: any) => (
                            <TableRow 
                              key={invoice.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openInvoice(invoice)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {invoice.invoice_number}
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TableCell>
                              <TableCell>{invoice.vendor_name || '—'}</TableCell>
                              <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(invoice.amount)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{invoice.status}</Badge>
                              </TableCell>
                              <TableCell>
                                {isDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleRemoveInvoice(invoice.id, e)}
                                    disabled={removeInvoice.isPending}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No invoices attached to this draw</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* PCCOs (Change Orders) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileEdit className="h-4 w-4" />
                      PCCOs - Change Orders ({pccos.length})
                      {pccoTotal > 0 && (
                        <span className="text-muted-foreground font-normal">
                          • {formatCurrency(pccoTotal)}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {pccos.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>CO #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pccos.map((co) => (
                            <TableRow 
                              key={co.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openCO(co)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {co.co_number}
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">{co.description}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize text-xs">
                                  {co.type.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(co.total_amount || 0)}
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant={co.status === 'approved' ? 'default' : 'outline'}
                                  className="capitalize"
                                >
                                  {co.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleRemoveCO(co.id, e)}
                                    disabled={removeCO.isPending}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileEdit className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No change orders attached to this draw</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lien Releases */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" />
                      Lien Releases ({lienReleases.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {lienReleases.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendor</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Through Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lienReleases.map((lr) => (
                            <TableRow 
                              key={lr.id} 
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => openLR(lr)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {lr.vendor_name || '—'}
                                  <Eye className="h-3 w-3 text-muted-foreground" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "capitalize text-xs",
                                    lr.release_type === 'unconditional' 
                                      ? 'border-green-500 text-green-600' 
                                      : 'border-amber-500 text-amber-600'
                                  )}
                                >
                                  {lr.release_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(lr.amount)}
                              </TableCell>
                              <TableCell>{lr.through_date ? formatDate(lr.through_date) : '—'}</TableCell>
                              <TableCell>
                                <Badge 
                                  variant={lr.status === 'received' ? 'default' : 'outline'}
                                  className={cn(
                                    "capitalize",
                                    lr.status === 'received' && 'bg-green-600',
                                    lr.status === 'pending' && 'text-amber-600',
                                    lr.status === 'requested' && 'text-blue-600'
                                  )}
                                >
                                  {lr.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isDraft && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleRemoveLR(lr.id, e)}
                                    disabled={removeLR.isPending}
                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No lien releases for this draw</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Detail Dialogs */}
      <InvoiceDetailDialog 
        invoiceId={selectedInvoiceId}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />
      
      <COInvoicesDialog
        changeOrder={selectedCO}
        open={coInvoicesDialogOpen}
        onOpenChange={setCOInvoicesDialogOpen}
      />
      
      <LienReleaseQuickView
        lienRelease={selectedLR}
        open={lrDialogOpen}
        onOpenChange={setLRDialogOpen}
      />
      
      <FundDrawDialog
        draw={draw ? { id: draw.id, draw_number: draw.draw_number, current_payment_due: draw.g702?.currentPaymentDue || draw.total_amount || 0 } : null}
        open={fundDialogOpen}
        onOpenChange={setFundDialogOpen}
      />
    </>
  );
}
