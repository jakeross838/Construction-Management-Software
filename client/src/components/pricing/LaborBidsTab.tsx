import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users, Search, TrendingDown, Award, Clock, CheckCircle2 } from 'lucide-react';
import {
  useLaborBids,
  useLaborCategories,
  useUpdateLaborBid,
  BID_STATUS_OPTIONS,
} from '@/hooks/usePricing';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export function LaborBidsTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: bids = [], isLoading } = useLaborBids();
  const { data: categories = [] } = useLaborCategories();
  const updateBid = useUpdateLaborBid();

  const filteredBids = useMemo(() => {
    return bids.filter((bid) => {
      const matchesSearch =
        bid.vendor_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.job_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bid.category_name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || bid.labor_category_id === categoryFilter;
      const matchesStatus = statusFilter === 'all' || bid.status === statusFilter;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [bids, searchQuery, categoryFilter, statusFilter]);

  // Stats
  const pendingCount = bids.filter((b) => b.status === 'pending').length;
  const acceptedCount = bids.filter((b) => b.status === 'accepted').length;
  const avgPerSf = bids.filter((b) => b.calculated_per_sf).length > 0
    ? bids.filter((b) => b.calculated_per_sf).reduce((sum, b) => sum + (b.calculated_per_sf || 0), 0) /
      bids.filter((b) => b.calculated_per_sf).length
    : 0;

  const handleStatusChange = (bidId: string, status: string) => {
    updateBid.mutate({ id: bidId, status: status as any });
  };

  const getStatusBadge = (status: string) => {
    const info = BID_STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge variant="secondary" className={cn('text-xs', info?.color)}>
        {info?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Bids</p>
                <p className="text-2xl font-semibold">{bids.length}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-semibold">{pendingCount}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-semibold">{acceptedCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg $/SF</p>
                <p className="text-2xl font-semibold">${avgPerSf.toFixed(2)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-blue-500" />
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
                placeholder="Search bids..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trades</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
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
                {BID_STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Labor Categories Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Trade Pricing Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <span className="text-sm font-medium">{cat.name}</span>
                <span className="text-xs text-muted-foreground">
                  ${cat.min_price_per_sf?.toFixed(2)} - ${cat.max_price_per_sf?.toFixed(2)}/SF
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bids Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredBids.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No bids found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Trade</TableHead>
                  <TableHead className="text-right">Bid Amount</TableHead>
                  <TableHead className="text-right">$/SF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBids.map((bid) => (
                  <TableRow key={bid.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bid.vendor_name}</span>
                        {bid.is_lowest_bid && (
                          <Award className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{bid.job_name}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{bid.category_name}</p>
                        {bid.specification_name && (
                          <p className="text-xs text-muted-foreground">{bid.specification_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(bid.bid_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {bid.calculated_per_sf ? `$${bid.calculated_per_sf.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={bid.status}
                        onValueChange={(v) => handleStatusChange(bid.id, v)}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs">
                          <SelectValue>{getStatusBadge(bid.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {BID_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {bid.submitted_at ? format(new Date(bid.submitted_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
