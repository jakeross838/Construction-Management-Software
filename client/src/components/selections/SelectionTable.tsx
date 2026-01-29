import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MoreHorizontal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  ShoppingCart,
  Image,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Selection,
  CATEGORY_OPTIONS,
  ORDER_STATUS_OPTIONS,
  APPROVAL_STATUS_OPTIONS,
  useUpdateSelection,
  useDeleteSelection,
} from '@/hooks/useSelections';
import { useUserName } from '@/contexts/UserContext';

interface SelectionTableProps {
  selections: Selection[];
  onEdit: (selection: Selection) => void;
  onSelect: (selection: Selection) => void;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function SelectionTable({ selections, onEdit, onSelect }: SelectionTableProps) {
  const userName = useUserName();
  const updateMutation = useUpdateSelection();
  const deleteMutation = useDeleteSelection();

  const getCategoryInfo = (category: string) => {
    return CATEGORY_OPTIONS.find(c => c.value === category) || { icon: '📦', label: category };
  };

  const getOrderStatusInfo = (status: string) => {
    return ORDER_STATUS_OPTIONS.find(s => s.value === status) || ORDER_STATUS_OPTIONS[0];
  };

  const getApprovalStatusInfo = (status: string) => {
    return APPROVAL_STATUS_OPTIONS.find(s => s.value === status) || APPROVAL_STATUS_OPTIONS[0];
  };

  const handleApprove = (selection: Selection) => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: userName,
    });
  };

  const handleReject = (selection: Selection) => {
    updateMutation.mutate({
      id: selection.id,
      approval_status: 'rejected',
    });
  };

  const handleUpdateOrderStatus = (selection: Selection, status: string) => {
    updateMutation.mutate({
      id: selection.id,
      order_status: status as Selection['order_status'],
      ordered_at: status === 'ordered' ? new Date().toISOString() : selection.ordered_at,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this selection?')) {
      deleteMutation.mutate(id);
    }
  };

  if (selections.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">No selections found</p>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Selection</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Room</TableHead>
            <TableHead className="text-right">Allowance</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Variance</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Order Status</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {selections.map((selection) => {
            const categoryInfo = getCategoryInfo(selection.category);
            const orderStatusInfo = getOrderStatusInfo(selection.order_status);
            const approvalStatusInfo = getApprovalStatusInfo(selection.approval_status);
            const variance = selection.allowance_amount - selection.actual_cost;

            return (
              <TableRow 
                key={selection.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelect(selection)}
              >
                <TableCell>
                  <div className="flex items-start gap-2">
                    {selection.image_url && (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                        <img
                          src={selection.image_url}
                          alt={selection.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div>
                      <div className="font-medium flex items-center gap-1">
                        {selection.name}
                        {selection.reference_url && (
                          <a
                            href={selection.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {selection.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {selection.description}
                        </p>
                      )}
                      {selection.job_name && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {selection.job_name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {categoryInfo.icon} {categoryInfo.label}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {selection.room_area || '—'}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(selection.allowance_amount)}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {formatCurrency(selection.actual_cost)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono text-sm font-medium",
                  variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : ""
                )}>
                  {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{selection.vendor_name || '—'}</span>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 gap-1">
                        <span className={cn("text-xs", orderStatusInfo.color)}>
                          {orderStatusInfo.label}
                        </span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {ORDER_STATUS_OPTIONS.map((status) => (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => handleUpdateOrderStatus(selection, status.value)}
                          className={status.color}
                        >
                          {status.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      approvalStatusInfo.color,
                      approvalStatusInfo.bgColor
                    )}
                  >
                    {approvalStatusInfo.label}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(selection)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {selection.reference_url && (
                        <DropdownMenuItem asChild>
                          <a
                            href={selection.reference_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Reference
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      {selection.approval_status === 'pending' && (
                        <>
                          <DropdownMenuItem onClick={() => handleApprove(selection)}>
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                            Approve
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleReject(selection)}>
                            <XCircle className="h-4 w-4 mr-2 text-red-600" />
                            Reject
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      <DropdownMenuItem
                        onClick={() => handleDelete(selection.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
