import { Card, CardContent } from '@/components/ui/card';
import { 
  ClipboardList,
  CheckCircle,
  Clock,
  FileText,
} from 'lucide-react';
import { formatCurrency, PurchaseOrder } from '@/types/financial';

interface POStatsProps {
  purchaseOrders: PurchaseOrder[];
}

export function POStats({ purchaseOrders }: POStatsProps) {
  const stats = {
    open: purchaseOrders.filter(p => p.status === 'open').length,
    openAmount: purchaseOrders.filter(p => p.status === 'open').reduce((sum, p) => sum + (p.current_amount || p.original_amount), 0),
    pendingApproval: purchaseOrders.filter(p => p.approval_status === 'pending').length,
    totalCommitted: purchaseOrders.reduce((sum, p) => sum + (p.current_amount || p.original_amount), 0),
    totalInvoiced: purchaseOrders.reduce((sum, p) => sum + (p.invoiced_amount || 0), 0),
  };

  const invoicedPercent = stats.totalCommitted > 0 
    ? ((stats.totalInvoiced / stats.totalCommitted) * 100).toFixed(0) 
    : '0';

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open POs</p>
              <p className="text-2xl font-semibold">{stats.open}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatCurrency(stats.openAmount)}</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-amber-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approval</p>
              <p className="text-2xl font-semibold">{stats.pendingApproval}</p>
            </div>
            <Clock className="h-8 w-8 text-amber-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Awaiting review</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Committed</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.totalCommitted)}</p>
            </div>
            <ClipboardList className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Across all POs</p>
        </CardContent>
      </Card>
      
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Invoiced</p>
              <p className="text-2xl font-semibold">{formatCurrency(stats.totalInvoiced)}</p>
            </div>
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {invoicedPercent}% of committed
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
