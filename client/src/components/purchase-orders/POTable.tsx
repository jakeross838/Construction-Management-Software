import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDate, PurchaseOrder, poStatusConfig } from '@/types/financial';

interface POTableProps {
  purchaseOrders: PurchaseOrder[];
  onSelectPO: (po: PurchaseOrder) => void;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

export function POTable({
  purchaseOrders,
  onSelectPO,
  selectedIds = [],
  onSelectionChange,
}: POTableProps) {
  const getStatusBadge = (status: string, approvalStatus: string) => {
    if (approvalStatus === 'pending') {
      return <Badge variant="destructive">Pending Approval</Badge>;
    }
    if (approvalStatus === 'rejected') {
      return <Badge variant="outline" className="text-red-600">Rejected</Badge>;
    }
    const config = poStatusConfig[status as keyof typeof poStatusConfig];
    if (!config) return <Badge variant="secondary">{status}</Badge>;
    return (
      <Badge variant="outline" className={`${config.color} ${config.bgColor}`}>
        {config.label}
      </Badge>
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(purchaseOrders.map(po => po.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(i => i !== id));
    }
  };

  const showCheckboxes = !!onSelectionChange;
  const allSelected = purchaseOrders.length > 0 && purchaseOrders.every(po => selectedIds.includes(po.id));

  if (purchaseOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No purchase orders found matching your filters</p>
      </div>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            {showCheckboxes && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
            )}
            <TableHead>PO Number</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Job</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Invoiced</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.map((po) => {
            const amount = po.current_amount || po.original_amount;
            const invoiced = po.invoiced_amount || 0;
            const remaining = po.remaining_amount ?? (amount - invoiced);
            const invoicedPercent = amount > 0 ? (invoiced / amount) * 100 : 0;
            const isSelected = selectedIds.includes(po.id);

            return (
              <TableRow
                key={po.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectPO(po)}
              >
                {showCheckboxes && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleSelectOne(po.id, !!checked)}
                    />
                  </TableCell>
                )}
                <TableCell className="font-medium font-mono">{po.po_number}</TableCell>
                <TableCell>{po.vendor_name || '—'}</TableCell>
                <TableCell>{po.job_name || '—'}</TableCell>
                <TableCell className="max-w-xs truncate">{po.description || '—'}</TableCell>
                <TableCell className="text-right font-medium">{formatCurrency(amount)}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <span className="text-sm">{formatCurrency(invoiced)}</span>
                    <Progress value={invoicedPercent} className="h-1.5 w-16" />
                  </div>
                </TableCell>
                <TableCell className={`text-right ${remaining === 0 ? 'text-muted-foreground' : 'text-amber-600 font-medium'}`}>
                  {formatCurrency(remaining)}
                </TableCell>
                <TableCell>
                  {getStatusBadge(po.status, po.approval_status)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
