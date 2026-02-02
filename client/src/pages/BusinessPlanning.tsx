import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  DollarSign,
  Briefcase,
  BarChart3,
  RefreshCw,
  Loader2,
  Plus,
  Flag,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
  Cell,
} from 'recharts';
import {
  useBusinessPlanningDashboard,
  usePlans,
  useKPIs,
  formatCurrency,
  formatPercent,
  formatDateShort,
  getMilestoneStatusBadgeClass,
  getVarianceClass,
} from '@/hooks/useBusinessPlanning';

const BusinessPlanning = () => {
  const { data: dashboard, isLoading, error, refetch, isFetching } = useBusinessPlanningDashboard();
  const { data: allPlans } = usePlans();
  const { data: kpiDefinitions } = useKPIs();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading business planning data...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Failed to load business planning data</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const activePlan = dashboard?.active_plan;
  const performance = dashboard?.performance;
  const upcomingMilestones = dashboard?.upcoming_milestones || [];
  const kpis = dashboard?.kpis || [];
  const plans = allPlans || [];

  const currentYear = new Date().getFullYear();

  // Calculate progress percentage for active plan
  const revenueProgress = performance?.revenue_percent || 0;
  const jobsProgress = performance ? (performance.jobs_actual / Math.max(performance.jobs_target, 1)) * 100 : 0;

  // Prepare chart data for KPIs
  const kpiChartData = kpis.slice(0, 4).map(kpi => ({
    name: kpi.kpi_name,
    target: kpi.default_target || 0,
    actual: 0, // Would need to be populated from actual KPI values
  }));

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Business Planning</h1>
            <p className="text-sm text-muted-foreground">
              Annual targets, KPIs, and performance tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{currentYear}</Badge>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Plan
            </Button>
          </div>
        </div>

        {/* Active Plan Summary */}
        {activePlan ? (
          <>
            {/* Plan Header */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-primary" />
                      <h2 className="text-xl font-semibold">{activePlan.plan_name}</h2>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {formatDateShort(activePlan.start_date)} - {formatDateShort(activePlan.end_date)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Revenue Target</p>
                      <p className="text-2xl font-bold">{formatCurrency(activePlan.revenue_target)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Gross Margin</p>
                      <p className="text-2xl font-bold">{formatPercent(activePlan.gross_margin_target)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Jobs Target</p>
                      <p className="text-2xl font-bold">{activePlan.jobs_target}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Net Margin</p>
                      <p className="text-2xl font-bold">{formatPercent(activePlan.net_margin_target)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Cards */}
            {performance && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="stat-card border-l-4 border-l-green-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Revenue Progress</p>
                      <DollarSign className="h-5 w-5 text-green-500" />
                    </div>
                    <p className="text-2xl font-semibold">{formatCurrency(performance.revenue_actual)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Progress value={Math.min(revenueProgress, 100)} className="h-2 flex-1 mr-2" />
                      <span className="text-sm font-medium">{revenueProgress.toFixed(1)}%</span>
                    </div>
                    <p className={`text-sm mt-1 ${getVarianceClass(performance.revenue_variance)}`}>
                      {performance.revenue_variance >= 0 ? '+' : ''}{formatCurrency(performance.revenue_variance)} vs target
                    </p>
                  </CardContent>
                </Card>

                <Card className="stat-card border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Jobs Completed</p>
                      <Briefcase className="h-5 w-5 text-blue-500" />
                    </div>
                    <p className="text-2xl font-semibold">{performance.jobs_actual} / {performance.jobs_target}</p>
                    <div className="flex items-center justify-between mt-2">
                      <Progress value={Math.min(jobsProgress, 100)} className="h-2 flex-1 mr-2" />
                      <span className="text-sm font-medium">{jobsProgress.toFixed(1)}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="stat-card border-l-4 border-l-amber-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Gross Margin</p>
                      <TrendingUp className="h-5 w-5 text-amber-500" />
                    </div>
                    <p className="text-2xl font-semibold">{formatPercent(performance.gross_margin_actual)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Target: {formatPercent(performance.gross_margin_target)}
                    </p>
                  </CardContent>
                </Card>

                <Card className="stat-card border-l-4 border-l-purple-500">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-muted-foreground">Avg Job Size</p>
                      <BarChart3 className="h-5 w-5 text-purple-500" />
                    </div>
                    <p className="text-2xl font-semibold">{formatCurrency(performance.avg_job_size_actual)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Target: {formatCurrency(activePlan.avg_job_size_target)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Active Business Plan</h3>
              <p className="text-muted-foreground text-center max-w-md mb-4">
                Create a business plan to set annual revenue targets, job goals, and track your company's performance throughout the year.
              </p>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create {currentYear} Plan
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="milestones" className="space-y-4">
          <TabsList>
            <TabsTrigger value="milestones">
              Milestones ({upcomingMilestones.length})
            </TabsTrigger>
            <TabsTrigger value="kpis">
              KPIs ({kpis.length})
            </TabsTrigger>
            <TabsTrigger value="plans">
              All Plans ({plans.length})
            </TabsTrigger>
          </TabsList>

          {/* Milestones Tab */}
          <TabsContent value="milestones">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Flag className="h-5 w-5" />
                  Upcoming Milestones
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMilestones.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingMilestones.map((milestone) => (
                      <div key={milestone.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`rounded-full p-2 ${
                            milestone.status === 'at_risk' ? 'bg-amber-100 dark:bg-amber-900/30' :
                            milestone.status === 'on_track' ? 'bg-blue-100 dark:bg-blue-900/30' :
                            'bg-gray-100 dark:bg-gray-900/30'
                          }`}>
                            {milestone.status === 'at_risk' ? (
                              <AlertTriangle className="h-5 w-5 text-amber-600" />
                            ) : milestone.status === 'on_track' ? (
                              <TrendingUp className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Clock className="h-5 w-5 text-gray-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{milestone.milestone_name}</p>
                            {milestone.category && (
                              <p className="text-sm text-muted-foreground">{milestone.category}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-sm font-medium flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDateShort(milestone.target_date)}
                            </p>
                            {milestone.target_value && (
                              <p className="text-sm text-muted-foreground">
                                Target: {milestone.target_metric === 'currency'
                                  ? formatCurrency(milestone.target_value)
                                  : milestone.target_value}
                              </p>
                            )}
                          </div>
                          <Badge className={getMilestoneStatusBadgeClass(milestone.status)}>
                            {milestone.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    {activePlan ? 'No upcoming milestones' : 'Create a plan to add milestones'}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* KPIs Tab */}
          <TabsContent value="kpis">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Key Performance Indicators
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {kpis.length > 0 ? (
                    <div className="space-y-4">
                      {kpis.map((kpi) => (
                        <div key={kpi.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{kpi.kpi_name}</p>
                            <p className="text-sm text-muted-foreground capitalize">{kpi.category}</p>
                          </div>
                          <div className="text-right">
                            {kpi.default_target !== null && (
                              <p className="font-mono">
                                {kpi.format === 'currency'
                                  ? formatCurrency(kpi.default_target)
                                  : kpi.format === 'percent'
                                    ? `${kpi.default_target}%`
                                    : kpi.default_target}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {kpi.higher_is_better ? '↑ Higher is better' : '↓ Lower is better'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground">
                      No KPIs defined
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* KPI Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">KPI Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  {kpiChartData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kpiChartData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 20%)" />
                          <XAxis type="number" stroke="hsl(215, 15%, 55%)" fontSize={12} />
                          <YAxis dataKey="name" type="category" stroke="hsl(215, 15%, 55%)" fontSize={12} width={80} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'hsl(222, 25%, 11%)',
                              border: '1px solid hsl(215, 20%, 20%)',
                              borderRadius: '8px',
                            }}
                          />
                          <Bar dataKey="target" fill="hsl(217, 91%, 60%)" name="Target" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No KPI data to display
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* All Plans Tab */}
          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Business Plans
                </CardTitle>
              </CardHeader>
              <CardContent>
                {plans.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plan Name</TableHead>
                        <TableHead>Year</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Revenue Target</TableHead>
                        <TableHead className="text-right">Jobs Target</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.map((plan) => (
                        <TableRow key={plan.id}>
                          <TableCell className="font-medium">{plan.plan_name}</TableCell>
                          <TableCell>{plan.year}</TableCell>
                          <TableCell className="capitalize">{plan.plan_type}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(plan.revenue_target)}</TableCell>
                          <TableCell className="text-right">{plan.jobs_target}</TableCell>
                          <TableCell>
                            <Badge className={
                              plan.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                              plan.status === 'completed' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
                            }>
                              {plan.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No business plans created yet
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Industry Benchmarks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Industry Benchmarks (NAHB)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-4">
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Gross Margin</p>
                <p className="text-2xl font-bold">22%</p>
                <p className="text-xs text-muted-foreground mt-1">Industry average</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Net Margin</p>
                <p className="text-2xl font-bold">8.5%</p>
                <p className="text-xs text-muted-foreground mt-1">Industry average</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Target Net Margin</p>
                <p className="text-2xl font-bold">11%</p>
                <p className="text-xs text-muted-foreground mt-1">Top performers</p>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">Revenue Growth</p>
                <p className="text-2xl font-bold">10-15%</p>
                <p className="text-xs text-muted-foreground mt-1">Healthy growth rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default BusinessPlanning;
