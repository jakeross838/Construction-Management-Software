import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle2,
  Users,
  DollarSign,
  Package,
  Calendar,
  Award,
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { useJob } from '@/contexts/JobContext';
import {
  useBidPackages,
  BidPackage,
  BID_PACKAGE_STATUS_OPTIONS,
  TRADE_CATEGORIES,
} from '@/hooks/useBidPackages';
import { BidPackageFormDialog } from '@/components/bids/BidPackageFormDialog';
import { BidPackageDetailPanel } from '@/components/bids/BidPackageDetailPanel';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const Bids = () => {
  const { selectedJobId } = useJob();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tradeFilter, setTradeFilter] = useState<string>('all');
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<BidPackage | null>(null);
  const [editingPackage, setEditingPackage] = useState<BidPackage | null>(null);

  const { data: packages = [], isLoading } = useBidPackages(selectedJobId || undefined);

  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      const matchesSearch = !searchQuery.trim() ||
        pkg.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.package_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.trade_category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      const matchesTrade = tradeFilter === 'all' || pkg.trade_category === tradeFilter;
      return matchesSearch && matchesStatus && matchesTrade;
    });
  }, [packages, searchQuery, statusFilter, tradeFilter]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);

    const activePackages = packages.filter((p) =>
      ['draft', 'issued', 'receiving', 'evaluating'].includes(p.status)
    );
    const awardedPackages = packages.filter((p) => p.status === 'awarded');
    const dueSoon = packages.filter(
      (p) =>
        ['issued', 'receiving'].includes(p.status) &&
        isBefore(new Date(p.due_date), nextWeek) &&
        isAfter(new Date(p.due_date), today)
    );
    const totalBids = packages.reduce((sum, p) => sum + (p.bid_count || 0), 0);

    return {
      active: activePackages.length,
      awarded: awardedPackages.length,
      dueSoon: dueSoon.length,
      totalBids,
    };
  }, [packages]);

  const handleEdit = (pkg: BidPackage) => {
    setEditingPackage(pkg);
    setShowFormDialog(true);
  };

  return (
    <AppLayout>
      <div className="flex h-full">
        {/* Main Content */}
        <div
          className={cn(
            'flex-1 space-y-6 animate-fade-in transition-all duration-300',
            selectedPackage ? 'pr-4' : ''
          )}
        >
          {/* Header */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Subcontractor Bids</h1>
              <p className="text-sm text-muted-foreground">
                Manage bid packages and collect pricing from subcontractors
              </p>
            </div>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingPackage(null);
                setShowFormDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New Bid Package
            </Button>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="stat-card border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Packages</p>
                    <p className="text-2xl font-semibold">{stats.active}</p>
                  </div>
                  <Package className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Awarded</p>
                    <p className="text-2xl font-semibold">{stats.awarded}</p>
                  </div>
                  <Award className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Due This Week</p>
                    <p className="text-2xl font-semibold">{stats.dueSoon}</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>
            <Card className="stat-card border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bids Received</p>
                    <p className="text-2xl font-semibold">{stats.totalBids}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search packages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={tradeFilter} onValueChange={setTradeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Trade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Trades</SelectItem>
                    {TRADE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {BID_PACKAGE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Packages Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredPackages.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No bid packages found</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => setShowFormDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Package
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Package</TableHead>
                      <TableHead>Trade</TableHead>
                      <TableHead>Job</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-center">Invites</TableHead>
                      <TableHead className="text-center">Bids</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Awarded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPackages.map((pkg) => {
                      const statusInfo = BID_PACKAGE_STATUS_OPTIONS.find(
                        (s) => s.value === pkg.status
                      );
                      const isOverdue =
                        new Date(pkg.due_date) < new Date() &&
                        ['issued', 'receiving'].includes(pkg.status);
                      const isDueSoon =
                        !isOverdue &&
                        isBefore(new Date(pkg.due_date), addDays(new Date(), 3)) &&
                        ['issued', 'receiving'].includes(pkg.status);

                      return (
                        <TableRow
                          key={pkg.id}
                          className={cn(
                            'cursor-pointer hover:bg-muted/50',
                            selectedPackage?.id === pkg.id && 'bg-muted'
                          )}
                          onClick={() => setSelectedPackage(pkg)}
                        >
                          <TableCell>
                            <div>
                              <p className="font-medium">{pkg.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {pkg.package_number}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {pkg.trade_category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {pkg.job_name || '—'}
                          </TableCell>
                          <TableCell>
                            <div
                              className={cn(
                                'flex items-center gap-1',
                                isOverdue && 'text-red-600 font-medium',
                                isDueSoon && 'text-amber-600'
                              )}
                            >
                              <Calendar className="h-3 w-3" />
                              {format(new Date(pkg.due_date), 'MMM d, yyyy')}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              {pkg.invite_count || 0}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <DollarSign className="h-3 w-3 text-muted-foreground" />
                              {pkg.bid_count || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn('text-xs', statusInfo?.color)}
                            >
                              {statusInfo?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {pkg.awarded_amount ? (
                              <div>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(pkg.awarded_amount)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {pkg.awarded_vendor_name}
                                </p>
                              </div>
                            ) : (
                              '—'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Detail Panel */}
        {selectedPackage && (
          <div className="w-[500px] flex-shrink-0 border-l pl-4">
            <BidPackageDetailPanel
              bidPackage={selectedPackage}
              onClose={() => setSelectedPackage(null)}
              onEdit={() => handleEdit(selectedPackage)}
            />
          </div>
        )}
      </div>

      {/* Form Dialog */}
      <BidPackageFormDialog
        open={showFormDialog}
        onOpenChange={setShowFormDialog}
        editPackage={editingPackage}
      />
    </AppLayout>
  );
};

export default Bids;
