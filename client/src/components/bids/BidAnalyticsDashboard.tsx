import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Package,
  Award,
  Percent,
  Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface BidAnalytics {
  summary: {
    total_packages: number;
    awarded_packages: number;
    award_rate: number;
    total_bids_received: number;
    avg_bids_per_package: number;
    total_awarded_amount: number;
  };
  by_trade: Array<{
    trade: string;
    packages: number;
    awarded: number;
    totalAwarded: number;
    award_rate: number;
  }>;
  vendor_performance: Array<{
    vendor_id: string;
    vendor_name: string;
    total_bids: number;
    won: number;
    win_rate: number;
    avg_bid: number;
    won_amount: number;
  }>;
  monthly_trend: Array<{
    month: string;
    packages: number;
    bids: number;
    awarded: number;
  }>;
  spread_by_trade: Array<{
    trade: string;
    avg_spread: number;
    sample_size: number;
  }>;
}

function useBidAnalytics(jobId?: string) {
  return useQuery({
    queryKey: ['bid-analytics', jobId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (jobId) params.append('job_id', jobId);
      const response = await fetch(`/api/bids/analytics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return response.json() as Promise<BidAnalytics>;
    },
  });
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

interface BidAnalyticsDashboardProps {
  jobId?: string;
}

export function BidAnalyticsDashboard({ jobId }: BidAnalyticsDashboardProps) {
  const { data: analytics, isLoading, error } = useBidAnalytics(jobId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-muted-foreground">Loading analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Unable to load analytics</p>
      </div>
    );
  }

  const { summary, by_trade, vendor_performance, monthly_trend, spread_by_trade } = analytics;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bid Packages</p>
                <p className="text-2xl font-bold">{summary.total_packages}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Award className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Awarded</p>
                <p className="text-2xl font-bold">{summary.awarded_packages}</p>
                <p className="text-xs text-muted-foreground">{summary.award_rate}% rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bids Received</p>
                <p className="text-2xl font-bold">{summary.total_bids_received}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.avg_bids_per_package} avg/pkg
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Awarded</p>
                <p className="text-2xl font-bold">{formatCurrency(summary.total_awarded_amount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By Trade Category */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              By Trade Category
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {by_trade.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              by_trade.slice(0, 8).map((trade) => (
                <div key={trade.trade} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{trade.trade}</span>
                    <span className="text-muted-foreground">
                      {trade.awarded}/{trade.packages} awarded
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={trade.award_rate} className="h-2 flex-1" />
                    <span className="text-xs w-10 text-right">{trade.award_rate}%</span>
                  </div>
                  {trade.totalAwarded > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(trade.totalAwarded)} awarded
                    </p>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top Vendors */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Subcontractors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {vendor_performance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            ) : (
              vendor_performance.slice(0, 6).map((vendor, idx) => (
                <div
                  key={vendor.vendor_id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="font-medium text-sm">{vendor.vendor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vendor.total_bids} bids • {vendor.won} won
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant="secondary"
                      className={
                        vendor.win_rate >= 50
                          ? 'bg-green-100 text-green-700'
                          : vendor.win_rate >= 25
                          ? 'bg-amber-100 text-amber-700'
                          : ''
                      }
                    >
                      {vendor.win_rate}% win
                    </Badge>
                    {vendor.won_amount > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatCurrency(vendor.won_amount)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Monthly Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {monthly_trend.map((month) => (
                <div key={month.month} className="flex items-center gap-4">
                  <span className="text-sm w-20 text-muted-foreground">{month.month}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div
                      className="h-6 bg-blue-200 rounded"
                      style={{ width: `${Math.max(10, (month.packages / 10) * 100)}%` }}
                    >
                      <span className="text-xs px-2 text-blue-800">{month.packages} pkg</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {month.bids} bids
                    </Badge>
                    {month.awarded > 0 && (
                      <Badge className="bg-green-100 text-green-700 text-xs">
                        {month.awarded} awarded
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Bid Spread by Trade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Bid Spread by Trade
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Average difference between lowest and highest bids
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {spread_by_trade.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Need 2+ bids per package
              </p>
            ) : (
              spread_by_trade.slice(0, 6).map((item) => (
                <div
                  key={item.trade}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium text-sm">{item.trade}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sample_size} package{item.sample_size !== 1 ? 's' : ''} analyzed
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      item.avg_spread > 30
                        ? 'bg-red-100 text-red-700'
                        : item.avg_spread > 15
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-green-100 text-green-700'
                    }
                  >
                    {item.avg_spread}% spread
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
