import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUp,
  ArrowDown,
  Download,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line
} from 'recharts';
import {
  usePnLDashboard,
  formatCurrency,
  formatPercent,
  formatMonthFromDate,
} from '@/hooks/usePnL';

const PnLDashboard = () => {
  const { data, isLoading, error, refetch, isFetching } = usePnLDashboard();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading P&L data...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Failed to load P&L data</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const ytd = data?.ytd || {
    total_revenue: 0,
    total_cogs: 0,
    gross_profit: 0,
    gross_margin: 0,
    total_opex: 0,
    net_income: 0,
    net_margin: 0,
  };

  const topJobs = data?.top_jobs || [];
  const monthlyTrend = (data?.monthly_trend || []).map(m => ({
    month: formatMonthFromDate(m.start_date),
    revenue: m.revenue || 0,
    costs: (m.cogs || 0) + (m.opex || 0),
    profit: m.net_income || 0,
  })).reverse();

  // Calculate cost breakdown from YTD data
  const totalCosts = (ytd.total_cogs || 0) + (ytd.total_opex || 0);
  const costBreakdown = [
    { category: 'Cost of Goods Sold', amount: ytd.total_cogs || 0, percentage: totalCosts > 0 ? ((ytd.total_cogs || 0) / totalCosts) * 100 : 0 },
    { category: 'Operating Expenses', amount: ytd.total_opex || 0, percentage: totalCosts > 0 ? ((ytd.total_opex || 0) / totalCosts) * 100 : 0 },
  ];

  const profitMargin = ytd.net_margin || 0;
  const hasData = ytd.total_revenue > 0 || topJobs.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">P&L Dashboard</h1>
            <p className="text-muted-foreground">
              Company-wide profit and loss analysis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">YTD {new Date().getFullYear()}</Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {!hasData && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No P&L Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                P&L data will appear here once you have closed financial periods with expenses and revenue.
                Check your job profitability data below for real-time insights.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Key metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(ytd.total_revenue)}
            icon={DollarSign}
            trend={ytd.total_revenue > 0 ? "up" : "neutral"}
          />
          <MetricCard
            title="Total Costs"
            value={formatCurrency(totalCosts)}
            icon={TrendingDown}
            trend="neutral"
          />
          <MetricCard
            title="Net Income"
            value={formatCurrency(ytd.net_income)}
            icon={TrendingUp}
            trend={ytd.net_income > 0 ? "up" : ytd.net_income < 0 ? "down" : "neutral"}
          />
          <MetricCard
            title="Profit Margin"
            value={formatPercent(profitMargin)}
            icon={BarChart3}
            trend={profitMargin >= 0.11 ? "up" : profitMargin > 0 ? "neutral" : "down"}
          />
        </div>

        {/* P&L Summary Cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-lg border-2 border-profit/30 bg-profit/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-profit/20 p-2">
                <ArrowUp className="h-5 w-5 text-profit" />
              </div>
              <h3 className="font-semibold text-profit">Revenue</h3>
            </div>
            <p className="text-3xl font-bold font-mono">{formatCurrency(ytd.total_revenue)}</p>
            <p className="text-sm text-muted-foreground mt-1">Year-to-date</p>
          </div>

          <div className="rounded-lg border-2 border-loss/30 bg-loss/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-loss/20 p-2">
                <ArrowDown className="h-5 w-5 text-loss" />
              </div>
              <h3 className="font-semibold text-loss">Costs</h3>
            </div>
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalCosts)}</p>
            <p className="text-sm text-muted-foreground mt-1">COGS + Operating Expenses</p>
          </div>

          <div className={`rounded-lg border-2 p-6 ${ytd.net_income >= 0 ? 'border-primary/30 bg-primary/5' : 'border-loss/30 bg-loss/5'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`rounded-full p-2 ${ytd.net_income >= 0 ? 'bg-primary/20' : 'bg-loss/20'}`}>
                {ytd.net_income >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-primary" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-loss" />
                )}
              </div>
              <h3 className={`font-semibold ${ytd.net_income >= 0 ? 'text-primary' : 'text-loss'}`}>
                Net {ytd.net_income >= 0 ? 'Profit' : 'Loss'}
              </h3>
            </div>
            <p className="text-3xl font-bold font-mono">{formatCurrency(Math.abs(ytd.net_income))}</p>
            <p className="text-sm text-muted-foreground mt-1">{formatPercent(profitMargin)} margin</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue & Costs trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Revenue vs Costs</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyTrend.length > 0 ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 20%)" />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(215, 15%, 55%)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(215, 15%, 55%)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value / 1000}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(222, 25%, 11%)',
                          border: '1px solid hsl(215, 20%, 20%)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="revenue" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Revenue" />
                      <Bar dataKey="costs" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Costs" />
                      <Line type="monotone" dataKey="profit" stroke="hsl(38, 92%, 50%)" strokeWidth={2} name="Profit" dot={{ fill: 'hsl(38, 92%, 50%)' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-72 flex items-center justify-center text-muted-foreground">
                  No monthly trend data available
                </div>
              )}
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-profit" />
                  <span className="text-sm text-muted-foreground">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-loss" />
                  <span className="text-sm text-muted-foreground">Costs</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-primary" />
                  <span className="text-sm text-muted-foreground">Profit</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cost breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cost Breakdown (YTD)</CardTitle>
            </CardHeader>
            <CardContent>
              {totalCosts > 0 ? (
                <div className="space-y-4">
                  {costBreakdown.map((item) => (
                    <div key={item.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">{item.category}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">{formatCurrency(item.amount)}</span>
                          <span className="text-xs text-muted-foreground w-12 text-right">
                            {item.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <Progress value={item.percentage} className="h-2" />
                    </div>
                  ))}
                  <div className="mt-6 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total Costs</span>
                      <span className="font-mono font-bold text-lg">{formatCurrency(totalCosts)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  No cost data available
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Jobs by Profit */}
        {topJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Jobs by Net Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topJobs.map((job, index) => (
                  <div key={job.job_id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="font-medium">{job.job_name}</p>
                        <p className="text-sm text-muted-foreground">
                          Contract: {formatCurrency(job.total_contract)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-bold ${job.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(job.net_profit)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatPercent(job.net_margin)} margin
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Industry comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Industry Benchmark Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Your Gross Margin</p>
                <p className={`text-3xl font-bold font-mono ${(ytd.gross_margin || 0) >= 0.22 ? 'text-profit' : 'text-amber-500'}`}>
                  {formatPercent(ytd.gross_margin)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  NAHB benchmark: 22%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Your Net Margin</p>
                <p className={`text-3xl font-bold font-mono ${profitMargin >= 0.085 ? 'text-profit' : 'text-amber-500'}`}>
                  {formatPercent(profitMargin)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  NAHB benchmark: 8.5%
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Target Profit Margin</p>
                <p className="text-3xl font-bold font-mono">11%</p>
                <p className={`text-xs mt-1 ${profitMargin >= 0.11 ? 'text-profit' : 'text-amber-500'}`}>
                  {profitMargin >= 0.11 ? (
                    <span><TrendingUp className="h-3 w-3 inline mr-1" />Above target</span>
                  ) : (
                    <span><TrendingDown className="h-3 w-3 inline mr-1" />Below target</span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PnLDashboard;
