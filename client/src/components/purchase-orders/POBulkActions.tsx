import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
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
import {
  ThumbsUp,
  Trash2,
  ChevronDown,
  Loader2,
  FileSpreadsheet,
  X,
  CheckCircle,
  XCircle,
  Archive,
} from 'lucide-react';
import { PurchaseOrder, formatCurrency, formatDate } from '@/types/financial';
import {
  useBulkPOStatusChange,
  useBulkPOApproval,
  useBulkDeletePOs,
} from '@/hooks/useFinancialData';

interface POBulkActionsProps {
  selectedIds: string[];
  purchaseOrders: PurchaseOrder[];
  onClearSelection: () => void;
}

export function POBulkActions({
  selectedIds,
  purchaseOrders,
  onClearSelection,
}: POBulkActionsProps) {
  const { user } = useAuth();
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User' : 'User';
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const bulkStatusChange = useBulkPOStatusChange();
  const bulkApproval = useBulkPOApproval();
  const bulkDelete = useBulkDeletePOs();

  const selectedPOs = purchaseOrders.filter(po => selectedIds.includes(po.id));
  const totalAmount = selectedPOs.reduce((sum, po) => sum + (po.current_amount || po.original_amount || 0), 0);

  // Count by status
  const pendingApprovalCount = selectedPOs.filter(
    po => po.approval_status === 'pending'
  ).length;
  const openCount = selectedPOs.filter(po => po.status === 'open').length;
  const closedCount = selectedPOs.filter(po => po.status === 'closed').length;

  const handleBulkApprove = async () => {
    const toApprove = selectedPOs.filter(po => po.approval_status === 'pending');
    if (toApprove.length === 0) return;

    await bulkApproval.mutateAsync({
      ids: toApprove.map(po => po.id),
      approvedBy: userName,
    });
    onClearSelection();
  };

  const handleStatusChange = async (status: 'open' | 'closed' | 'cancelled') => {
    await bulkStatusChange.mutateAsync({
      ids: selectedIds,
      status,
    });
    onClearSelection();
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync(selectedIds);
    setDeleteDialogOpen(false);
    onClearSelection();
  };

  const handleExportCSV = () => {
    const headers = [
      'PO Number',
      'Vendor',
      'Job',
      'Description',
      'Original Amount',
      'Current Amount',
      'Invoiced',
      'Remaining',
      'Status',
      'Approval Status',
      'Created Date',
    ];

    const rows = selectedPOs.map(po => {
      const amount = po.current_amount || po.original_amount || 0;
      const invoiced = po.invoiced_amount || 0;
      const remaining = po.remaining_amount ?? (amount - invoiced);

      return [
        po.po_number || '',
        po.vendor_name || '',
        po.job_name || '',
        po.description || '',
        (po.original_amount || 0).toString(),
        (po.current_amount || po.original_amount || 0).toString(),
        invoiced.toString(),
        remaining.toString(),
        po.status || '',
        po.approval_status || '',
        formatDate(po.created_at),
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `purchase-orders-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (selectedIds.length === 0) return null;

  const isLoading = bulkStatusChange.isPending || bulkApproval.isPending || bulkDelete.isPending;

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 px-2"
        >
          <X className="h-4 w-4" />
        </Button>

        <Badge variant="secondary" className="font-medium">
          {selectedIds.length} selected
        </Badge>

        <span className="text-sm text-muted-foreground">
          {formatCurrency(totalAmount)} total
        </span>

        <div className="flex-1" />

        {/* Approve Button */}
        {pendingApprovalCount > 0 && (
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={isLoading}
            className="gap-2"
          >
            {bulkApproval.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            Approve ({pendingApprovalCount})
          </Button>
        )}

        {/* Status Change Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2" disabled={isLoading}>
              Change Status
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleStatusChange('open')}>
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
              Set to Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('closed')}>
              <Archive className="h-4 w-4 mr-2 text-blue-600" />
              Set to Closed
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('cancelled')}>
              <XCircle className="h-4 w-4 mr-2 text-red-600" />
              Set to Cancelled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* More Actions Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              More
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export to CSV
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Purchase Order(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected purchase orders. This action cannot be undone.
              Any associated line items will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDelete.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
