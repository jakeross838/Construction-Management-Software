import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Plus,
  Trash2,
  Loader2,
  FileText,
  CheckCircle,
  X,
} from 'lucide-react';
import { formatCurrency, formatDate } from '@/types/financial';
import { useBulkAddInvoicesToDraw, useBulkRemoveInvoicesFromDraw, useAddAllApprovedToDraw } from '@/hooks/useDrawMutations';
import { cn } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  vendor_name?: string;
  amount: number;
  invoice_date?: string;
  status: string;
}

interface DrawBulkActionsProps {
  drawId: string;
  isDraft: boolean;
  jobId: string;
  currentInvoiceIds: string[];
  availableInvoices?: Invoice[];
  onSelectionChange?: (invoiceIds: string[]) => void;
}

export function DrawBulkActions({
  drawId,
  isDraft,
  jobId,
  currentInvoiceIds,
  availableInvoices = [],
  onSelectionChange,
}: DrawBulkActionsProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [selectedToRemove, setSelectedToRemove] = useState<Set<string>>(new Set());

  const bulkAdd = useBulkAddInvoicesToDraw();
  const bulkRemove = useBulkRemoveInvoicesFromDraw();
  const addAllApproved = useAddAllApprovedToDraw();

  // Filter to only show approved invoices not already in draw
  const addableInvoices = availableInvoices.filter(
    inv => inv.status === 'approved' && !currentInvoiceIds.includes(inv.id)
  );

  const toggleAddSelection = (id: string) => {
    const newSet = new Set(selectedToAdd);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedToAdd(newSet);
  };

  const handleBulkAdd = async () => {
    if (selectedToAdd.size === 0) return;
    await bulkAdd.mutateAsync({
      drawId,
      invoiceIds: Array.from(selectedToAdd),
    });
    setSelectedToAdd(new Set());
    setShowAddDialog(false);
  };

  const handleAddAll = async () => {
    await addAllApproved.mutateAsync(drawId);
    setShowAddDialog(false);
  };

  const handleBulkRemove = async () => {
    if (selectedToRemove.size === 0) return;
    await bulkRemove.mutateAsync({
      drawId,
      invoiceIds: Array.from(selectedToRemove),
    });
    setSelectedToRemove(new Set());
    onSelectionChange?.([]);
  };

  const selectAllToAdd = () => {
    setSelectedToAdd(new Set(addableInvoices.map(inv => inv.id)));
  };

  const clearAddSelection = () => {
    setSelectedToAdd(new Set());
  };

  if (!isDraft) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Add Invoices Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowAddDialog(true)}
        disabled={addableInvoices.length === 0}
      >
        <Plus className="h-4 w-4 mr-1" />
        Add Invoices
        {addableInvoices.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {addableInvoices.length}
          </Badge>
        )}
      </Button>

      {/* Bulk Remove (when invoices are selected) */}
      {selectedToRemove.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
          <span className="text-sm text-muted-foreground">
            {selectedToRemove.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkRemove}
            disabled={bulkRemove.isPending}
          >
            {bulkRemove.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-1" />
            )}
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedToRemove(new Set());
              onSelectionChange?.([]);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Add Invoices Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Add Invoices to Draw
            </DialogTitle>
            <DialogDescription>
              Select approved invoices to add to this draw.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllToAdd}
                disabled={selectedToAdd.size === addableInvoices.length}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAddSelection}
                disabled={selectedToAdd.size === 0}
              >
                Clear
              </Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAll}
              disabled={addAllApproved.isPending || addableInvoices.length === 0}
            >
              {addAllApproved.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Add All Approved
            </Button>
          </div>

          {/* Invoice List */}
          <ScrollArea className="h-[400px] pr-4">
            {addableInvoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No approved invoices available to add
              </div>
            ) : (
              <div className="space-y-2">
                {addableInvoices.map(invoice => (
                  <div
                    key={invoice.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedToAdd.has(invoice.id)
                        ? "bg-primary/10 border-primary"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => toggleAddSelection(invoice.id)}
                  >
                    <Checkbox
                      checked={selectedToAdd.has(invoice.id)}
                      onCheckedChange={() => toggleAddSelection(invoice.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{invoice.invoice_number}</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          Approved
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.vendor_name || 'Unknown Vendor'}
                        {invoice.invoice_date && ` • ${formatDate(invoice.invoice_date)}`}
                      </p>
                    </div>
                    <span className="font-medium">{formatCurrency(invoice.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedToAdd.size > 0 && (
                <>
                  {selectedToAdd.size} invoice{selectedToAdd.size !== 1 ? 's' : ''} selected
                  {' • '}
                  {formatCurrency(
                    addableInvoices
                      .filter(inv => selectedToAdd.has(inv.id))
                      .reduce((sum, inv) => sum + inv.amount, 0)
                  )}
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkAdd}
                disabled={selectedToAdd.size === 0 || bulkAdd.isPending}
              >
                {bulkAdd.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-1" />
                )}
                Add {selectedToAdd.size || ''} Invoice{selectedToAdd.size !== 1 ? 's' : ''}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
