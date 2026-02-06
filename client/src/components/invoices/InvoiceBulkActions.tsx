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
  Download,
  ChevronDown,
  Loader2,
  FileSpreadsheet,
  X,
  CircleDollarSign,
} from 'lucide-react';
import { Invoice, formatCurrency, formatDate } from '@/types/financial';
import {
  useBulkApproveInvoices,
  useBulkDeleteInvoices,
  useBulkAddToDraw,
  useDraws,
} from '@/hooks/useFinancialData';
import { BulkAddToDrawDialog } from './BulkAddToDrawDialog';

interface InvoiceBulkActionsProps {
  selectedIds: string[];
  invoices: Invoice[];
  onClearSelection: () => void;
}

export function InvoiceBulkActions({
  selectedIds,
  invoices,
  onClearSelection,
}: InvoiceBulkActionsProps) {
  const { user } = useAuth();
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'User' : 'User';
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [addToDrawOpen, setAddToDrawOpen] = useState(false);

  const bulkApprove = useBulkApproveInvoices();
  const bulkDelete = useBulkDeleteInvoices();

  const selectedInvoices = invoices.filter(inv => selectedIds.includes(inv.id));
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  // Count by status
  const approvableCount = selectedInvoices.filter(
    inv => inv.status === 'needs_approval' || inv.status === 'needs_review'
  ).length;
  const approvedCount = selectedInvoices.filter(
    inv => inv.status === 'approved'
  ).length;

  const handleBulkApprove = async () => {
    const toApprove = selectedInvoices.filter(
      inv => inv.status === 'needs_approval' || inv.status === 'needs_review'
    );
    if (toApprove.length === 0) return;

    await bulkApprove.mutateAsync({
      ids: toApprove.map(inv => inv.id),
      approvedBy: userName,
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
      'Invoice #',
      'Vendor',
      'Job',
      'PO #',
      'Date',
      'Due Date',
      'Amount',
      'Status',
    ];

    const rows = selectedInvoices.map(inv => [
      inv.invoice_number || '',
      inv.vendor_name || inv.vendor?.name || '',
      inv.job_name || inv.job?.name || '',
      inv.po_number || inv.po?.po_number || '',
      formatDate(inv.invoice_date),
      formatDate(inv.due_date),
      inv.amount.toString(),
      inv.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `invoices-export-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (selectedIds.length === 0) return null;

  const isLoading = bulkApprove.isPending || bulkDelete.isPending;

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
        {approvableCount > 0 && (
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={isLoading}
            className="gap-2"
          >
            {bulkApprove.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4" />
            )}
            Approve ({approvableCount})
          </Button>
        )}

        {/* Add to Draw Button */}
        {approvedCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAddToDrawOpen(true)}
            disabled={isLoading}
            className="gap-2"
          >
            <CircleDollarSign className="h-4 w-4" />
            Add to Draw ({approvedCount})
          </Button>
        )}

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
            <AlertDialogTitle>Delete {selectedIds.length} Invoice(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected invoices. This action cannot be undone.
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

      {/* Add to Draw Dialog */}
      <BulkAddToDrawDialog
        open={addToDrawOpen}
        onOpenChange={setAddToDrawOpen}
        invoices={selectedInvoices.filter(inv => inv.status === 'approved')}
        onSuccess={onClearSelection}
      />
    </>
  );
}
