import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  BarChart3,
  List,
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
import { BidPackageDetailDialog } from '@/components/bids/BidPackageDetailDialog';
import { BidAnalyticsDashboard } from '@/components/bids/BidAnalyticsDashboard';
import { CompactStats } from '@/components/ui/compact-stats';

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
        pkg.trade_category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pkg.vendor?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || pkg.status === statusFilter;
      const matchesTrade = tradeFilter === 'all' ||
        pkg.trade_category === tradeFilter ||
        pkg.trade_type === tradeFilter;
      return matchesSearch && matchesStatus && matchesTrade;
    });
  }, [packages, searchQuery, statusFilter, tradeFilter]);

  // Stats
  const stats = useMemo(() => {
    const today = new Date();
    const nextWeek = addDays(today, 7);

    const activePackages = packages.filter((p) =>
      ['draft', 'issued', 'receiving', 'evaluating', 'received', 'in_review'].includes(p.status)
    );
    const awardedPackages = packages.filter((p) => ['awarded', 'accepted'].includes(p.status));
    const dueSoon = packages.filter(
      (p) =>
        p.due_date &&
        ['issued', 'receiving'].includes(p.status) &&
        isBefore(new Date(p.due_date), nextWeek) &&
        isAfter(new Date(p.due_date), today)
    );
    // Count items that have a bid_amount as actual bids received
    const totalBids = packages.filter((p) => p.bid_amount && p.bid_amount > 0).length;

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
      <div className="space-y-6 animate-fade-in">
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

          {/* View Toggle Tabs */}
          <Tabs defaultValue="list" className="w-full">
            <TabsList>
              <TabsTrigger value="list" className="gap-2">
                <List className="h-4 w-4" />
                Bid Packages
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-4 space-y-4">
          {/* Filters & Compact Stats */}
          <div className="flex flex-col gap-3">
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
            <CompactStats
              stats={[
                { label: 'Active', value: stats.active, icon: Package, color: 'blue' },
                { label: 'Awarded', value: stats.awarded, icon: Award, color: 'green' },
                { label: 'Due This Week', value: stats.dueSoon, icon: Clock, color: 'amber' },
                { label: 'Bids Received', value: stats.totalBids, icon: DollarSign, color: 'purple' },
              ]}
            />
          </div>

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
                        pkg.due_date &&
                        new Date(pkg.due_date) < new Date() &&
                        ['issued', 'receiving'].includes(pkg.status);
                      const isDueSoon =
                        pkg.due_date &&
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
                              {pkg.trade_category || pkg.trade_type || '—'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {pkg.job_name || pkg.job?.name || '—'}
                          </TableCell>
                          <TableCell>
                            {pkg.due_date ? (
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
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
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
                            {(pkg.awarded_amount || pkg.bid_amount) ? (
                              <div>
                                <p className="font-semibold text-green-600">
                                  {formatCurrency(pkg.awarded_amount || pkg.bid_amount || 0)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {pkg.awarded_vendor_name || pkg.vendor?.name}
                                </p>
                              </div>
                            ) : pkg.vendor?.name ? (
                              <p className="text-xs text-muted-foreground">
                                {pkg.vendor.name}
                              </p>
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
            </TabsContent>

            <TabsContent value="analytics" className="mt-4">
              <BidAnalyticsDashboard jobId={selectedJobId || undefined} />
            </TabsContent>
          </Tabs>
      </div>

      {/* Detail Dialog */}
      <BidPackageDetailDialog
        bidPackage={selectedPackage}
        open={!!selectedPackage}
        onOpenChange={(open) => !open && setSelectedPackage(null)}
        onEdit={() => selectedPackage && handleEdit(selectedPackage)}
      />

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
