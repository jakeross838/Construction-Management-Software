import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { JobsTable } from '@/components/dashboard/JobsTable';
import { RevenueChart, ExpenseBreakdownChart } from '@/components/dashboard/Charts';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import { formatCurrency } from '@/types/financial';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  Building2,
  Clock,
  Calculator,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  CheckCircle,
  Target,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useExecutiveSummary,
  useCashPosition,
  usePipelineData,
  formatCurrency as execFormatCurrency,
  formatPercent,
} from '@/hooks/useExecutiveDashboard';

const Dashboard = () => {
  const { selectedJobId } = useJob();
  const { data: dbJobs = [], isLoading } = useDBJobs();

  // Executive data - only fetch when showing all jobs
  const { data: execSummary, isLoading: execLoading } = useExecutiveSummary();
  const { data: cashPosition, isLoading: cashLoading } = useCashPosition();
  const { data: pipelineData, isLoading: pipelineLoading } = usePipelineData();

  const selectedJob = useMemo(() => {
    if (!selectedJobId) return null;
    return dbJobs.find(j => j.id === selectedJobId);
  }, [selectedJobId, dbJobs]);

  const filteredJobs = useMemo(() => {
    if (!selectedJobId) return dbJobs;
    return dbJobs.filter(j => j.id === selectedJobId);
  }, [selectedJobId, dbJobs]);

  // Calculate metrics based on filtered jobs
  const metrics = useMemo(() => {
    const totalRevenue = filteredJobs.reduce((sum, j) => sum + (j.contract_amount || 0), 0);
    const totalBudget = filteredJobs.reduce((sum, j) => sum + (j.budget_amount || 0), 0);
    const avgMargin = filteredJobs.length > 0
      ? filteredJobs.reduce((sum, j) => sum + (j.target_margin || 0), 0) / filteredJobs.length
      : 0;
    const avgPercentComplete = filteredJobs.length > 0
      ? filteredJobs.reduce((sum, j) => sum + (j.percent_complete || 0), 0) / filteredJobs.length
      : 0;
    const activeCount = filteredJobs.filter(j => j.status === 'active').length;

    // Estimate spent based on percent complete (since we don't track actual spent in DB yet)
    const estimatedSpent = filteredJobs.reduce((sum, j) => {
      const percentComplete = j.percent_complete || 0;
      return sum + (j.budget_amount || 0) * (percentComplete / 100);
    }, 0);

    return {
      totalRevenue,
      totalBudget,
      estimatedSpent,
      avgMargin,
      avgPercentComplete,
      activeCount,
      netProfit: totalRevenue - estimatedSpent,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - estimatedSpent) / totalRevenue) * 100 : 0,
    };
  }, [filteredJobs]);

  const pageTitle = selectedJob ? selectedJob.name : 'Executive Dashboard';
  const pageDescription = selectedJob
    ? `Financial overview for ${selectedJob.name}`
    : 'Company overview and financial intelligence';

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          <p className="text-muted-foreground">
            {pageDescription}
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title={selectedJob ? "Contract Value" : "Total Revenue (YTD)"}
            value={formatCurrency(execSummary?.total_revenue || metrics.totalRevenue)}
            icon={DollarSign}
            change={{ value: 12.4, label: selectedJob ? 'of budget' : 'vs last year' }}
            trend="up"
          />
          <MetricCard
            title="Net Profit Margin"
            value={`${metrics.profitMargin.toFixed(1)}%`}
            icon={TrendingUp}
            change={{ value: 2.1, label: selectedJob ? 'current margin' : 'vs target 16.6%' }}
            trend={metrics.profitMargin >= 15 ? "up" : "down"}
          />
          <MetricCard
            title={selectedJob ? "Job Status" : "Active Jobs"}
            value={selectedJob ? (selectedJob.status === 'active' ? 'Active' : selectedJob.status) : String(execSummary?.total_jobs?.active || metrics.activeCount)}
            icon={Building2}
            change={{ value: selectedJob ? (selectedJob.percent_complete || 0) : 25, label: selectedJob ? '% complete' : 'capacity used' }}
            trend="neutral"
          />
          <MetricCard
            title={selectedJob ? "Progress" : "Pending Invoices"}
            value={selectedJob ? `${Math.round(metrics.avgPercentComplete)}%` : formatCurrency(execSummary?.total_invoices_pending?.amount || 0)}
            icon={selectedJob ? Clock : AlertCircle}
            change={{ value: execSummary?.total_invoices_pending?.count || 0, label: selectedJob ? 'complete' : 'invoices' }}
            trend="neutral"
          />
        </div>

        {/* Executive Insights - Only show when viewing all jobs */}
        {!selectedJobId && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Cash Position */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Cash Position</CardTitle>
                  {cashPosition?.summary?.health && (
                    <Badge variant={cashPosition.summary.health === 'positive' ? 'default' : 'destructive'}>
                      {cashPosition.summary.health === 'positive' ? (
                        <><CheckCircle className="h-3 w-3 mr-1" /> Healthy</>
                      ) : (
                        <><AlertCircle className="h-3 w-3 mr-1" /> Attention</>
                      )}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {cashLoading ? (
                  <Skeleton className="h-20" />
                ) : cashPosition ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AR Outstanding</span>
                      <span className="font-semibold text-green-600 flex items-center">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        {execFormatCurrency(cashPosition.ar_total)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">AP Outstanding</span>
                      <span className="font-semibold text-red-600 flex items-center">
                        <ArrowDownRight className="h-4 w-4 mr-1" />
                        {execFormatCurrency(cashPosition.ap_total)}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Net Position</span>
                      <span className={`font-bold ${cashPosition.net_position >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {execFormatCurrency(cashPosition.net_position)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* AR Aging */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium">AR Aging</CardTitle>
              </CardHeader>
              <CardContent>
                {cashLoading ? (
                  <Skeleton className="h-20" />
                ) : cashPosition?.ar_aging ? (
                  <div className="space-y-2">
                    <AgingBar label="Current" amount={cashPosition.ar_aging.current} total={cashPosition.ar_total} color="bg-green-500" />
                    <AgingBar label="30 Days" amount={cashPosition.ar_aging.days_30} total={cashPosition.ar_total} color="bg-yellow-500" />
                    <AgingBar label="60 Days" amount={cashPosition.ar_aging.days_60} total={cashPosition.ar_total} color="bg-orange-500" />
                    <AgingBar label="90+ Days" amount={cashPosition.ar_aging.days_90_plus} total={cashPosition.ar_total} color="bg-red-500" />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Pipeline Health */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium">Sales Pipeline</CardTitle>
                  {pipelineData?.summary?.pipeline_health && (
                    <Badge variant={pipelineData.summary.pipeline_health === 'healthy' ? 'default' : 'secondary'}>
                      {pipelineData.summary.pipeline_health === 'healthy' ? 'Healthy' : 'Needs Attention'}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {pipelineLoading ? (
                  <Skeleton className="h-20" />
                ) : pipelineData ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Active Leads</span>
                      <span className="font-semibold">{pipelineData.pipeline.total_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Pipeline Value</span>
                      <span className="font-semibold">{execFormatCurrency(pipelineData.pipeline.total_value)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="font-semibold">{formatPercent(pipelineData.conversion_rates.overall)}</span>
                    </div>
                    <div className="border-t pt-2 flex items-center justify-between">
                      <span className="text-sm font-medium">Backlog</span>
                      <span className="font-bold">{execFormatCurrency(pipelineData.backlog.total_value)}</span>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RevenueChart selectedJobId={selectedJobId} jobs={filteredJobs} />
          </div>
          <ExpenseBreakdownChart selectedJobId={selectedJobId} jobs={filteredJobs} />
        </div>

        {/* Jobs table and activity */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <JobsTable jobs={filteredJobs} />
          </div>
          <RecentActivity selectedJobId={selectedJobId} jobs={dbJobs} />
        </div>

        {/* Additional metrics row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Committed"
            value={formatCurrency(execSummary?.total_committed?.amount || metrics.totalBudget)}
            icon={Target}
            change={{ value: execSummary?.total_committed?.count || 0, label: 'POs' }}
            trend="neutral"
          />
          <MetricCard
            title="Billable Rate"
            value="94.2%"
            icon={Users}
            change={{ value: 1.8, label: 'improvement' }}
            trend="up"
          />
          <MetricCard
            title="Avg Target Margin"
            value={`${metrics.avgMargin.toFixed(1)}%`}
            icon={Calculator}
            change={{ value: -1.2, label: 'variance' }}
            trend="up"
          />
          <MetricCard
            title="Budget Total"
            value={formatCurrency(metrics.totalBudget)}
            icon={DollarSign}
            change={{ value: 5.4, label: 'this period' }}
            trend="neutral"
          />
        </div>
      </div>
    </AppLayout>
  );
};

// Aging Bar Component
function AgingBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{execFormatCurrency(amount)}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export default Dashboard;
