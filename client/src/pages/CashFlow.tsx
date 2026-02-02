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
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  ArrowUpCircle,
  ArrowDownCircle,
  RefreshCw,
  Loader2,
  Calendar,
  Wallet,
  Receipt,
  BarChart3,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  ComposedChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import {
  useCashFlowDashboard,
  useCashFlowByJob,
  useUpcomingPayments,
  formatCurrency,
  formatDateShort,
  formatWeekRange,
  getUrgencyBadgeClass,
} from '@/hooks/useCashFlow';

const CashFlow = () => {
  const { data: dashboard, isLoading, error, refetch, isFetching } = useCashFlowDashboard();
  const { data: byJobData } = useCashFlowByJob();
  const { data: paymentsData } = useUpcomingPayments(60);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading cash flow data...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Failed to load cash flow data</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  const summary = dashboard?.summary || {
    total_receivables: 0,
    total_payables: 0,
    overdue_receivables: 0,
    overdue_payables: 0,
    net_position: 0,
    payments_due_7_days: 0,
    payments_overdue: 0,
  };

  const position = dashboard?.position || {};
  const upcomingPayments = dashboard?.upcoming_payments || [];
  const expectedReceipts = dashboard?.expected_receipts || [];
  const forecast = dashboard?.weekly_forecast || [];
  const byJob = byJobData || [];

  // Prepare chart data from forecast
  const chartData = forecast.map(f => ({
    period: formatWeekRange(f.period_start, f.period_end),
    inflows: f.projected_inflows || 0,
    outflows: f.projected_outflows || 0,
    balance: f.closing_balance || 0,
  }));

  const hasData = summary.total_receivables > 0 || summary.total_payables > 0 || byJob.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cash Flow</h1>
            <p className="text-sm text-muted-foreground">
              Track cash position, payments, and forecasts
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Receivables</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary.total_receivables)}</p>
                </div>
                <ArrowDownCircle className="h-8 w-8 text-green-500" />
              </div>
              {summary.overdue_receivables > 0 && (
                <p className="text-sm text-amber-500 mt-1">
                  {formatCurrency(summary.overdue_receivables)} overdue
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Payables</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary.total_payables)}</p>
                </div>
                <ArrowUpCircle className="h-8 w-8 text-red-500" />
              </div>
              {summary.overdue_payables > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {formatCurrency(summary.overdue_payables)} overdue
                </p>
              )}
            </CardContent>
          </Card>

          <Card className={`stat-card border-l-4 ${summary.net_position >= 0 ? 'border-l-blue-500' : 'border-l-amber-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Net Position</p>
                  <p className={`text-2xl font-semibold ${summary.net_position >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                    {formatCurrency(summary.net_position)}
                  </p>
                </div>
                <Wallet className={`h-8 w-8 ${summary.net_position >= 0 ? 'text-blue-500' : 'text-amber-500'}`} />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {summary.net_position >= 0 ? 'Net positive' : 'Net negative'}
              </p>
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Due This Week</p>
                  <p className="text-2xl font-semibold">{formatCurrency(summary.payments_due_7_days)}</p>
                </div>
                <Calendar className="h-8 w-8 text-purple-500" />
              </div>
              {summary.payments_overdue > 0 && (
                <p className="text-sm text-red-500 mt-1">
                  {formatCurrency(summary.payments_overdue)} overdue
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {!hasData && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Cash Flow Data Yet</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Cash flow data will appear here once you have invoices, payments, and draws in the system.
                This dashboard will show upcoming payments, expected receipts, and cash flow projections.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">
              Payments ({upcomingPayments.length})
            </TabsTrigger>
            <TabsTrigger value="receipts">
              Receipts ({expectedReceipts.length})
            </TabsTrigger>
            <TabsTrigger value="by-job">
              By Job ({byJob.length})
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Cash Flow Forecast Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Weekly Cash Flow Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215, 20%, 20%)" />
                            <XAxis
                              dataKey="period"
                              stroke="hsl(215, 15%, 55%)"
                              fontSize={11}
                              tickLine={false}
                              axisLine={false}
                              angle={-45}
                              textAnchor="end"
                              height={60}
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
                            <Bar dataKey="inflows" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} name="Inflows" />
                            <Bar dataKey="outflows" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Outflows" />
                            <Line type="monotone" dataKey="balance" stroke="hsl(217, 91%, 60%)" strokeWidth={2} name="Balance" dot={{ fill: 'hsl(217, 91%, 60%)' }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex items-center justify-center gap-6 mt-4">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded bg-green-500" />
                          <span className="text-sm text-muted-foreground">Inflows</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded bg-red-500" />
                          <span className="text-sm text-muted-foreground">Outflows</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded bg-blue-500" />
                          <span className="text-sm text-muted-foreground">Balance</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                      No forecast data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Position Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Cash Position Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-2">
                          <ArrowDownCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Expected Inflows</p>
                          <p className="text-sm text-muted-foreground">Pending draws & payments</p>
                        </div>
                      </div>
                      <p className="text-xl font-semibold text-green-600">
                        {formatCurrency(position.submitted_draws || 0)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-2">
                          <ArrowUpCircle className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">Pending Payments</p>
                          <p className="text-sm text-muted-foreground">Approved invoices</p>
                        </div>
                      </div>
                      <p className="text-xl font-semibold text-red-600">
                        {formatCurrency(position.pending_payments || 0)}
                      </p>
                    </div>

                    <div className="pt-4 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${summary.net_position >= 0 ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            <Wallet className={`h-5 w-5 ${summary.net_position >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                          </div>
                          <div>
                            <p className="font-medium">Net Cash Position</p>
                            <p className="text-sm text-muted-foreground">Receivables - Payables</p>
                          </div>
                        </div>
                        <p className={`text-2xl font-bold ${summary.net_position >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                          {formatCurrency(summary.net_position)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowUpCircle className="h-5 w-5 text-red-500" />
                  Upcoming Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingPayments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Job</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {upcomingPayments.map((payment, idx) => (
                        <TableRow key={payment.id || idx}>
                          <TableCell className="font-medium">{payment.vendor_name}</TableCell>
                          <TableCell>{payment.invoice_number}</TableCell>
                          <TableCell>{payment.job_name || '-'}</TableCell>
                          <TableCell>{formatDateShort(payment.due_date)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getUrgencyBadgeClass(payment.urgency)}>
                              {payment.urgency === 'overdue' ? 'Overdue' :
                               payment.urgency === 'due_soon' ? 'Due Soon' : 'Upcoming'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No upcoming payments
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Totals */}
            {paymentsData && (
              <div className="grid gap-4 md:grid-cols-3 mt-6">
                <Card className="border-red-500/30 bg-red-500/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Overdue</p>
                      <p className="text-2xl font-bold text-red-600">
                        {formatCurrency(paymentsData.totals.overdue)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {paymentsData.payments.overdue.length} invoices
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Due This Week</p>
                      <p className="text-2xl font-bold text-amber-600">
                        {formatCurrency(paymentsData.totals.due_soon)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {paymentsData.payments.due_soon.length} invoices
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Upcoming</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {formatCurrency(paymentsData.totals.upcoming)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {paymentsData.payments.upcoming.length} invoices
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Receipts Tab */}
          <TabsContent value="receipts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowDownCircle className="h-5 w-5 text-green-500" />
                  Expected Receipts
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expectedReceipts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead>Draw #</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expectedReceipts.map((receipt, idx) => (
                        <TableRow key={receipt.id || idx}>
                          <TableCell className="font-medium">{receipt.job_name}</TableCell>
                          <TableCell>#{receipt.draw_number}</TableCell>
                          <TableCell>{formatDateShort(receipt.submitted_at)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{receipt.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">
                            {formatCurrency(receipt.total_amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No expected receipts (submitted draws awaiting funding)
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* By Job Tab */}
          <TabsContent value="by-job">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Cash Flow by Job
                </CardTitle>
              </CardHeader>
              <CardContent>
                {byJob.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job</TableHead>
                        <TableHead className="text-right">Inflows</TableHead>
                        <TableHead className="text-right">Outflows</TableHead>
                        <TableHead className="text-right">Net Cash Flow</TableHead>
                        <TableHead className="w-32">Flow</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {byJob.map((job) => {
                        const maxFlow = Math.max(...byJob.map(j => Math.abs(j.net)));
                        const flowPercent = maxFlow > 0 ? (Math.abs(job.net) / maxFlow) * 100 : 0;
                        return (
                          <TableRow key={job.job_id}>
                            <TableCell className="font-medium">{job.job_name}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">
                              {formatCurrency(job.inflows)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                              {formatCurrency(job.outflows)}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-medium ${job.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(job.net)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={flowPercent}
                                  className={`h-2 ${job.net >= 0 ? '[&>div]:bg-green-500' : '[&>div]:bg-red-500'}`}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    No cash flow data by job
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CashFlow;
