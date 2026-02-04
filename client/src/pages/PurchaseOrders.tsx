import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Plus, Sparkles, CheckCircle, Clock, ClipboardList, FileText } from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { usePurchaseOrders } from '@/hooks/useFinancialData';
import { CompactStats } from '@/components/ui/compact-stats';
import { POTable } from '@/components/purchase-orders/POTable';
import { formatCurrency } from '@/types/financial';
import { PODetailPanel } from '@/components/purchase-orders/PODetailPanel';
import { POFormDialog } from '@/components/purchase-orders/POFormDialog';
import { POUploadDialog } from '@/components/purchase-orders/POUploadDialog';
import { POBulkActions } from '@/components/purchase-orders/POBulkActions';
import type { PurchaseOrder } from '@/types/financial';

const PurchaseOrders = () => {
  const { selectedJobId, selectedJobName } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPOId, setSelectedPOId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Fetch all POs when filtering by job (we filter client-side for name fallback)
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders(
    undefined,
    statusFilter !== 'all' ? statusFilter : undefined
  );

  const filteredPOs = useMemo(() => {
    let filtered = purchaseOrders;

    // Apply job filtering with ID + name fallback
    if (selectedJobId) {
      const contextJobId = String(selectedJobId);
      const contextJobName = selectedJobName?.trim().toLowerCase() || '';

      filtered = filtered.filter(po => {
        const poJobId = po.job_id ? String(po.job_id) : '';
        // Primary: ID match
        if (poJobId && poJobId === contextJobId) return true;
        // Fallback: name match
        if (contextJobName && po.job_name?.trim().toLowerCase() === contextJobName) return true;
        return false;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(po =>
        po.po_number?.toLowerCase().includes(query) ||
        po.vendor_name?.toLowerCase().includes(query) ||
        po.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [purchaseOrders, searchQuery, selectedJobId, selectedJobName]);

  // Calculate stats from filtered data
  const stats = useMemo(() => {
    const open = filteredPOs.filter(p => p.status === 'open');
    const pendingApproval = filteredPOs.filter(p => p.approval_status === 'pending');
    const totalCommitted = filteredPOs.reduce((sum, p) => sum + (p.current_amount || p.original_amount), 0);
    const totalInvoiced = filteredPOs.reduce((sum, p) => sum + (p.invoiced_amount || 0), 0);
    return { open: open.length, pendingApproval: pendingApproval.length, totalCommitted, totalInvoiced };
  }, [filteredPOs]);

  const handleSelectPO = (po: PurchaseOrder) => {
    setSelectedPOId(po.id);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Manage vendor commitments and PO tracking</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowUploadDialog(true)}>
              <Sparkles className="h-4 w-4" />
              AI Upload
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              New PO
            </Button>
          </div>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search POs..."
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isLoading && (
            <CompactStats
              stats={[
                { label: 'Open', value: stats.open, icon: CheckCircle, color: 'green' },
                { label: 'Pending Approval', value: stats.pendingApproval, icon: Clock, color: 'amber' },
                { label: 'Committed', value: formatCurrency(stats.totalCommitted), icon: ClipboardList, color: 'blue' },
                { label: 'Invoiced', value: formatCurrency(stats.totalInvoiced), icon: FileText, color: 'default' },
              ]}
            />
          )}
        </div>

        {/* Bulk Actions Bar */}
        <POBulkActions
          selectedIds={selectedIds}
          purchaseOrders={purchaseOrders}
          onClearSelection={() => setSelectedIds([])}
        />

        {/* PO Table */}
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <POTable
            purchaseOrders={filteredPOs}
            onSelectPO={handleSelectPO}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}
      </div>

      {/* PO Detail Panel */}
      <PODetailPanel 
        poId={selectedPOId}
        open={!!selectedPOId}
        onOpenChange={(open) => !open && setSelectedPOId(null)}
      />

      {/* Create PO Dialog */}
      <POFormDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        selectedJobId={selectedJobId}
      />

      {/* AI Upload Dialog */}
      <POUploadDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
        selectedJobId={selectedJobId}
      />
    </AppLayout>
  );
};

export default PurchaseOrders;
