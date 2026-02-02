import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Shield,
  FileText,
  AlertTriangle,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useWarranties, useWarrantyStats, Warranty, warrantyTypes, warrantyCategories } from '@/hooks/useWarranties';
import { WarrantyFormDialog } from '@/components/warranties/WarrantyFormDialog';
import { WarrantyDetailDialog } from '@/components/warranties/WarrantyDetailDialog';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  expired: { label: 'Expired', variant: 'destructive' },
  claimed: { label: 'Claimed', variant: 'secondary' },
  void: { label: 'Void', variant: 'outline' },
};

function getDaysUntilExpiry(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  const diff = end.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const years = end.getFullYear() - start.getFullYear();
  if (years >= 1) return `${years} year${years > 1 ? 's' : ''}`;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
  return `${months} month${months > 1 ? 's' : ''}`;
}

const Warranties = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedWarrantyId, setSelectedWarrantyId] = useState<string | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Fetch warranties with filters
  const { data: warranties = [], isLoading, error } = useWarranties({
    job_id: selectedJobId || undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
  });

  // Fetch stats
  const { data: stats } = useWarrantyStats(selectedJobId || undefined);

  const filteredWarranties = useMemo(() => {
    if (!searchQuery.trim()) return warranties;
    const query = searchQuery.toLowerCase();
    return warranties.filter(warranty =>
      warranty.name?.toLowerCase().includes(query) ||
      warranty.warranty_number?.toLowerCase().includes(query) ||
      warranty.manufacturer?.toLowerCase().includes(query) ||
      warranty.vendor?.name?.toLowerCase().includes(query) ||
      warranty.category?.toLowerCase().includes(query)
    );
  }, [warranties, searchQuery]);

  const displayStats = useMemo(() => ({
    active: stats?.active || 0,
    total: stats?.total || 0,
    expiring_soon: stats?.expiring_soon || 0,
  }), [stats]);

  const handleWarrantyClick = (warranty: Warranty) => {
    setSelectedWarrantyId(warranty.id);
    setShowDetailDialog(true);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setCategoryFilter('all');
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim() !== '';

  if (error) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-medium">Failed to load warranties</p>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Warranties</h1>
            <p className="text-sm text-muted-foreground">Track warranty information and expiration dates</p>
          </div>
          <Button className="gap-2" onClick={() => setShowFormDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Warranty
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Warranties</p>
                  <p className="text-2xl font-semibold">{displayStats.active}</p>
                </div>
                <Shield className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Warranties</p>
                  <p className="text-2xl font-semibold">{displayStats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon (90 days)</p>
                  <p className="text-2xl font-semibold">{displayStats.expiring_soon}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search warranties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {warrantyTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {warrantyCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <Filter className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Warranties Table */}
        <Card>
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredWarranties.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4" />
              <p>No warranties found</p>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Warranty #</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Vendor/Manufacturer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWarranties.map((warranty) => {
                  const daysLeft = getDaysUntilExpiry(warranty.end_date);
                  const isExpiringSoon = warranty.status === 'active' && daysLeft > 0 && daysLeft <= 90;
                  return (
                    <TableRow
                      key={warranty.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleWarrantyClick(warranty)}
                    >
                      <TableCell className="font-mono text-sm">{warranty.warranty_number}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{warranty.name}</p>
                          <p className="text-sm text-muted-foreground">{warranty.job?.name || '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {warranty.vendor?.name || warranty.manufacturer || '-'}
                      </TableCell>
                      <TableCell>{warranty.category || '-'}</TableCell>
                      <TableCell>{formatDuration(warranty.start_date, warranty.end_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{new Date(warranty.end_date).toLocaleDateString()}</span>
                          {isExpiringSoon && (
                            <Badge variant="outline" className="text-amber-500 border-amber-500 text-xs">
                              {daysLeft}d left
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig[warranty.status]?.variant || 'secondary'}>
                          {statusConfig[warranty.status]?.label || warranty.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Create/Edit Warranty Dialog */}
      <WarrantyFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        warranty={null}
      />

      {/* Warranty Detail Dialog */}
      <WarrantyDetailDialog
        open={showDetailDialog}
        onOpenChange={(open) => {
          setShowDetailDialog(open);
          if (!open) setSelectedWarrantyId(null);
        }}
        warrantyId={selectedWarrantyId}
      />
    </AppLayout>
  );
};

export default Warranties;
