import { useState } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Receipt, FileEdit, ExternalLink, Eye } from 'lucide-react';
import { formatCurrency, formatDate, invoiceStatusConfig } from '@/types/financial';
import type { ChangeOrder, Invoice } from '@/types/financial';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';

interface COInvoicesDialogProps {
  changeOrder: ChangeOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function COInvoicesDialog({ changeOrder, open, onOpenChange }: COInvoicesDialogProps) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);

  // Fetch invoices linked to this CO's PO
  const { data: relatedInvoices = [], isLoading } = useQuery({
    queryKey: ['co-invoices', changeOrder?.id, changeOrder?.po_id],
    queryFn: async () => {
      if (!changeOrder?.po_id) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          vendors (name)
        `)
        .eq('po_id', changeOrder.po_id)
        .order('invoice_date', { ascending: false });
      
      if (error) throw error;
      
      return data.map((inv: any) => ({
        ...inv,
        vendor_name: inv.vendors?.name,
      })) as Invoice[];
    },
    enabled: !!changeOrder?.po_id && open,
  });

  if (!changeOrder) return null;

  const totalInvoiced = relatedInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

  const openInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setInvoiceDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <FileEdit className="h-5 w-5 text-muted-foreground" />
                  <DialogTitle className="text-lg">{changeOrder.co_number}</DialogTitle>
                  <Badge variant="outline" className="capitalize">
                    {changeOrder.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{changeOrder.description}</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-y-auto">
            {/* CO Summary */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">CO Amount</p>
                <p className="text-lg font-semibold">{formatCurrency(changeOrder.total_amount || 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PO #</p>
                <p className="text-sm font-medium">{changeOrder.po_number || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Invoiced</p>
                <p className={cn(
                  "text-lg font-semibold",
                  totalInvoiced > (changeOrder.total_amount || 0) ? "text-red-600" : "text-green-600"
                )}>
                  {formatCurrency(totalInvoiced)}
                </p>
              </div>
            </div>

            {/* Related Invoices */}
            <div>
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4" />
                Related Invoices ({relatedInvoices.length})
              </h3>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading invoices...
                </div>
              ) : !changeOrder.po_id ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>This change order is not linked to a PO</p>
                  <p className="text-xs mt-1">Invoices are tracked through POs</p>
                </div>
              ) : relatedInvoices.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relatedInvoices.map((invoice) => {
                      const statusConfig = invoiceStatusConfig[invoice.status];
                      return (
                        <TableRow 
                          key={invoice.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => openInvoice(invoice.id)}
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
                            <Badge 
                              variant="outline" 
                              className={cn(statusConfig?.color, statusConfig?.bgColor)}
                            >
                              {statusConfig?.label || invoice.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No invoices found for this PO</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog
        invoiceId={selectedInvoiceId}
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
      />
    </>
  );
}
