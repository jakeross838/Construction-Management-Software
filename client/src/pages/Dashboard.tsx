import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { JobsTable } from '@/components/dashboard/JobsTable';
import { RevenueChart, ExpenseBreakdownChart } from '@/components/dashboard/Charts';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useJob } from '@/contexts/JobContext';
import { useDBJobs } from '@/hooks/useFinancialData';
import { formatCurrency } from '@/types/financial';
import { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Building2, 
  Clock,
  Calculator,
  Users
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const { selectedJobId } = useJob();
  const { data: dbJobs = [], isLoading } = useDBJobs();
  
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

  const pageTitle = selectedJob ? selectedJob.name : 'All Jobs Dashboard';
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
            value={formatCurrency(metrics.totalRevenue)}
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
            value={selectedJob ? (selectedJob.status === 'active' ? 'Active' : selectedJob.status) : String(metrics.activeCount)}
            icon={Building2}
            change={{ value: selectedJob ? (selectedJob.percent_complete || 0) : 25, label: selectedJob ? '% complete' : 'capacity used' }}
            trend="neutral"
          />
          <MetricCard
            title="Overhead Rate"
            value="$42.50"
            icon={Calculator}
            change={{ value: -3.2, label: 'per labor hour' }}
            trend="up"
          />
        </div>

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

        {/* Labor metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title={selectedJob ? "Progress" : "Avg Completion"}
            value={`${Math.round(metrics.avgPercentComplete)}%`}
            icon={Clock}
            change={{ value: 8.5, label: 'vs last month' }}
            trend="up"
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

export default Dashboard;