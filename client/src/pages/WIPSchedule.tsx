import { useState } from 'react';
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
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
} from 'lucide-react';
import {
  useWIPDashboard,
  useWIPBillingReport,
  formatCurrency,
  formatPercent,
  getWIPStatus,
  type WIPJob,
} from '@/hooks/useWIP';

const WIPSchedule = () => {
  const { data: dashboard, isLoading, error, refetch, isFetching } = useWIPDashboard();
  const { data: billingReport } = useWIPBillingReport();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading WIP data...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Failed to load WIP data</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const summary = dashboard?.summary;
  const jobs = dashboard?.jobs || [];

  const getStatusBadge = (job: WIPJob) => {
    const status = getWIPStatus(job);
    switch (status) {
      case 'overbilled':
        return <Badge className="bg-amber-100 text-amber-800">Overbilled</Badge>;
      case 'underbilled':
        return <Badge className="bg-blue-100 text-blue-800">Underbilled</Badge>;
      case 'at-risk':
        return <Badge variant="destructive">At Risk</Badge>;
      case 'balanced':
        return <Badge className="bg-green-100 text-green-800">Balanced</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">WIP Schedule</h1>
            <p className="text-sm text-muted-foreground">Work-in-Progress tracking and billing analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Contract Value</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary?.total_revised_contract)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{summary?.job_count || 0} active jobs</p>
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Billed</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary?.total_billed)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Earned: {formatCurrency(summary?.total_earned_revenue)}
              </p>
            </CardContent>
          </Card>

          <Card className={`stat-card border-l-4 ${(summary?.total_overbilling || 0) > (summary?.total_underbilling || 0) ? 'border-l-amber-500' : 'border-l-blue-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net WIP Position</p>
                  <p className={`text-2xl font-semibold ${(summary?.net_wip_position || 0) > 0 ? 'text-amber-600' : 'text-blue-600'}`}>
                    {formatCurrency(Math.abs(summary?.net_wip_position || 0))}
                  </p>
                </div>
                {(summary?.net_wip_position || 0) > 0 ? (
                  <ArrowUpCircle className="h-8 w-8 text-amber-500" />
                ) : (
                  <ArrowDownCircle className="h-8 w-8 text-blue-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {(summary?.net_wip_position || 0) > 0 ? 'Net Overbilled' : 'Net Underbilled'}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Cost to Date</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary?.total_cost_to_date)}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Projected Profit: {formatCurrency(summary?.total_projected_profit)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* WIP Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Jobs</TabsTrigger>
            <TabsTrigger value="overbilled">
              Overbilled ({summary?.overbilled_jobs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="underbilled">
              Underbilled ({summary?.underbilled_jobs?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="at-risk">
              At Risk ({summary?.at_risk_jobs?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Contract</TableHead>
                    <TableHead className="text-right">% Complete</TableHead>
                    <TableHead className="text-right">Earned</TableHead>
                    <TableHead className="text-right">Billed</TableHead>
                    <TableHead className="text-right">Over/(Under)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No active jobs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => {
                      const overUnder = (job.overbilling || 0) - (job.underbilling || 0);
                      return (
                        <TableRow key={job.job_id}>
                          <TableCell className="font-medium">{job.job_name}</TableCell>
                          <TableCell>{job.client_name}</TableCell>
                          <TableCell className="text-right">{formatCurrency(job.revised_contract)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={job.percent_complete || 0} className="h-2 w-16" />
                              <span className="w-12">{formatPercent(job.percent_complete)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(job.earned_revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(job.billed_to_date)}</TableCell>
                          <TableCell className={`text-right font-medium ${overUnder > 0 ? 'text-amber-600' : overUnder < 0 ? 'text-blue-600' : ''}`}>
                            {overUnder > 0 ? formatCurrency(overUnder) : overUnder < 0 ? `(${formatCurrency(Math.abs(overUnder))})` : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(job)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="overbilled">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-amber-500" />
                  Overbilled Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(summary?.overbilled_jobs?.length || 0) === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No overbilled jobs</p>
                ) : (
                  <div className="space-y-4">
                    {summary?.overbilled_jobs?.map((job) => (
                      <div key={job.job_id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{job.job_name}</p>
                          <p className="text-sm text-muted-foreground">{job.client_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-amber-600">{formatCurrency(job.overbilling)}</p>
                          <p className="text-sm text-muted-foreground">overbilled</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="underbilled">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownCircle className="h-5 w-5 text-blue-500" />
                  Underbilled Jobs
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(summary?.underbilled_jobs?.length || 0) === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No underbilled jobs</p>
                ) : (
                  <div className="space-y-4">
                    {summary?.underbilled_jobs?.map((job) => (
                      <div key={job.job_id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{job.job_name}</p>
                          <p className="text-sm text-muted-foreground">{job.client_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-blue-600">{formatCurrency(job.underbilling)}</p>
                          <p className="text-sm text-muted-foreground">underbilled</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="at-risk">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  At-Risk Jobs (Margin &lt; 5%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(summary?.at_risk_jobs?.length || 0) === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No at-risk jobs</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {summary?.at_risk_jobs?.map((job) => (
                      <div key={job.job_id} className="flex justify-between items-center p-4 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/10">
                        <div>
                          <p className="font-medium">{job.job_name}</p>
                          <p className="text-sm text-muted-foreground">{job.client_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-600">
                            {formatPercent((job.projected_margin || 0) * 100)} margin
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Profit: {formatCurrency(job.projected_final_profit)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Billing Summary */}
        {billingReport && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Billing Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 border rounded-lg">
                  <ArrowUpCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-amber-600">
                    {formatCurrency(billingReport.summary.total_overbilling)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Overbilled ({billingReport.summary.overbilled_count} jobs)
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <ArrowDownCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-blue-600">
                    {formatCurrency(billingReport.summary.total_underbilling)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Underbilled ({billingReport.summary.underbilled_count} jobs)
                  </p>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <MinusCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-semibold text-green-600">
                    {billingReport.summary.balanced_count}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Balanced Jobs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default WIPSchedule;
