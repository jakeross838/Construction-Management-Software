import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  Line
} from 'recharts';

const monthlyPnL = [
  { month: 'Jul', revenue: 420000, costs: 340000, profit: 80000 },
  { month: 'Aug', revenue: 380000, costs: 310000, profit: 70000 },
  { month: 'Sep', revenue: 520000, costs: 420000, profit: 100000 },
  { month: 'Oct', revenue: 480000, costs: 390000, profit: 90000 },
  { month: 'Nov', revenue: 560000, costs: 445000, profit: 115000 },
  { month: 'Dec', revenue: 620000, costs: 495000, profit: 125000 },
  { month: 'Jan', revenue: 580000, costs: 460000, profit: 120000 },
];

const costBreakdown = [
  { category: 'Direct Labor', amount: 185000, percentage: 40.2 },
  { category: 'Materials', amount: 142000, percentage: 30.9 },
  { category: 'Subcontractors', amount: 68000, percentage: 14.8 },
  { category: 'Labor Burden', amount: 32500, percentage: 7.1 },
  { category: 'Overhead Allocation', amount: 32500, percentage: 7.1 },
];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PnLDashboard = () => {
  const totalRevenue = monthlyPnL.reduce((sum, m) => sum + m.revenue, 0);
  const totalCosts = monthlyPnL.reduce((sum, m) => sum + m.costs, 0);
  const totalProfit = monthlyPnL.reduce((sum, m) => sum + m.profit, 0);
  const profitMargin = ((totalProfit / totalRevenue) * 100).toFixed(1);

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
            <Badge variant="outline">FY 2025-2026</Badge>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={DollarSign}
            change={{ value: 15.2, label: 'vs prior period' }}
            trend="up"
          />
          <MetricCard
            title="Total Costs"
            value={formatCurrency(totalCosts)}
            icon={TrendingDown}
            change={{ value: 12.8, label: 'vs prior period' }}
            trend="neutral"
          />
          <MetricCard
            title="Net Profit"
            value={formatCurrency(totalProfit)}
            icon={TrendingUp}
            change={{ value: 22.4, label: 'vs prior period' }}
            trend="up"
          />
          <MetricCard
            title="Profit Margin"
            value={`${profitMargin}%`}
            icon={BarChart3}
            change={{ value: 1.8, label: 'improvement' }}
            trend="up"
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
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalRevenue)}</p>
            <p className="text-sm text-muted-foreground mt-1">7 months total</p>
          </div>

          <div className="rounded-lg border-2 border-loss/30 bg-loss/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-loss/20 p-2">
                <ArrowDown className="h-5 w-5 text-loss" />
              </div>
              <h3 className="font-semibold text-loss">Costs</h3>
            </div>
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalCosts)}</p>
            <p className="text-sm text-muted-foreground mt-1">Including overhead allocation</p>
          </div>

          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-primary/20 p-2">
                <ArrowRight className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-primary">Net Profit</h3>
            </div>
            <p className="text-3xl font-bold font-mono">{formatCurrency(totalProfit)}</p>
            <p className="text-sm text-muted-foreground mt-1">{profitMargin}% margin</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Revenue & Costs trend */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Monthly Revenue vs Costs</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyPnL}>
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
          </div>

          {/* Cost breakdown */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Cost Breakdown (Jan 2026)</h3>
            <div className="space-y-4">
              {costBreakdown.map((item) => (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{item.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">{formatCurrency(item.amount)}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Total Costs</span>
                <span className="font-mono font-bold text-lg">{formatCurrency(460000)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Industry comparison */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="font-semibold mb-4">Industry Benchmark Comparison</h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Overhead Rate</p>
              <p className="text-3xl font-bold font-mono text-profit">5.2%</p>
              <p className="text-xs text-profit mt-1">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                0.5% below industry avg
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">NAHB 2024 Overhead</p>
              <p className="text-3xl font-bold font-mono">5.7%</p>
              <p className="text-xs text-muted-foreground mt-1">Industry standard</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Your Profit Margin</p>
              <p className="text-3xl font-bold font-mono text-profit">{profitMargin}%</p>
              <p className="text-xs text-profit mt-1">
                <TrendingUp className="h-3 w-3 inline mr-1" />
                {(parseFloat(profitMargin) - 11).toFixed(1)}% above target 11%
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default PnLDashboard;
