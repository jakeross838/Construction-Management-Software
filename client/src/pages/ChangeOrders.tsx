import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
  Plus, 
  FileEdit,
  Clock,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useChangeOrders } from '@/hooks/useChangeOrders';
import { COFormDialog } from '@/components/change-orders/COFormDialog';
import { CODetailPanel } from '@/components/change-orders/CODetailPanel';
import { CompactStats } from '@/components/ui/compact-stats';
import { formatCurrency, formatDate, coStatusConfig, coTypeConfig, COStatus, COType } from '@/types/financial';
import { cn } from '@/lib/utils';

const statusIcons: Record<COStatus, React.ComponentType<{ className?: string }>> = {
  draft: FileEdit,
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

const ChangeOrders = () => {
  const { selectedJobId, selectedJobName } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCOId, setSelectedCOId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch all COs (we filter client-side for name fallback)
  const { data: changeOrders = [], isLoading } = useChangeOrders(
    undefined,
    statusFilter
  );

  const filteredCOs = useMemo(() => {
    let filtered = changeOrders;

    // Apply job filtering with ID + name fallback
    if (selectedJobId) {
      const contextJobId = String(selectedJobId);
      const contextJobName = selectedJobName?.trim().toLowerCase() || '';

      filtered = filtered.filter(co => {
        const coJobId = co.job_id ? String(co.job_id) : '';
        // Primary: ID match
        if (coJobId && coJobId === contextJobId) return true;
        // Fallback: name match
        if (contextJobName && co.job_name?.trim().toLowerCase() === contextJobName) return true;
        return false;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(co =>
        co.co_number?.toLowerCase().includes(query) ||
        co.description?.toLowerCase().includes(query) ||
        co.job_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [changeOrders, searchQuery, selectedJobId, selectedJobName]);

  // Calculate stats from filtered data (respects job filter)
  const stats = useMemo(() => {
    const pending = filteredCOs.filter(co => co.status === 'pending');
    const approved = filteredCOs.filter(co => co.status === 'approved');
    return {
      pending: pending.length,
      approved: approved.length,
      pendingValue: pending.reduce((sum, co) => sum + (co.total_amount || 0), 0),
      approvedValue: approved.reduce((sum, co) => sum + (co.total_amount || 0), 0),
      total: filteredCOs.length,
    };
  }, [filteredCOs]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Change Orders</h1>
            <p className="text-sm text-muted-foreground">Track and approve change orders</p>
          </div>
          <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            New Change Order
          </Button>
        </div>

        {/* Filters & Compact Stats */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-4">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search change orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {!isLoading && (
            <CompactStats
              stats={[
                { label: 'Pending', value: stats.pending, subValue: formatCurrency(stats.pendingValue), icon: Clock, color: 'amber' },
                { label: 'Approved', value: stats.approved, subValue: formatCurrency(stats.approvedValue), icon: CheckCircle2, color: 'green' },
                { label: 'Total', value: stats.total, icon: FileEdit, color: 'default' },
              ]}
            />
          )}
        </div>

        {/* Change Orders Table */}
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : filteredCOs.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CO #</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCOs.map((co) => {
                  const StatusIcon = statusIcons[co.status] || FileEdit;
                  const statusConfig = coStatusConfig[co.status] || { label: co.status, color: 'text-gray-600', bgColor: 'bg-gray-100' };
                  const typeConfig = coTypeConfig[co.type as COType] || { label: co.type || 'Unknown', color: 'text-gray-600' };
                  
                  return (
                    <TableRow 
                      key={co.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCOId(co.id)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{co.co_number}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{co.job_name || '—'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{co.description}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={typeConfig.color}>
                          {typeConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-semibold",
                        (co.total_amount || 0) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {(co.total_amount || 0) >= 0 ? '+' : ''}{formatCurrency(co.total_amount || 0)}
                      </TableCell>
                      <TableCell className="capitalize">{co.requested_by || '—'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(co.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(statusConfig.color, statusConfig.bgColor, 'gap-1')}>
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No change orders found</p>
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <COFormDialog 
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        selectedJobId={selectedJobId}
      />

      {/* Detail Panel */}
      <CODetailPanel
        coId={selectedCOId}
        open={!!selectedCOId}
        onOpenChange={(open) => !open && setSelectedCOId(null)}
      />
    </AppLayout>
  );
};

export default ChangeOrders;
