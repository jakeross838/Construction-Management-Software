import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DollarSign,
  Percent,
  Target,
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  useProfitabilityDashboard,
  formatCurrency,
  formatPercent,
  parseNumeric,
  type JobProfitability,
} from '@/hooks/useProfitability';

// NAHB benchmarks
const BENCHMARK_GROSS_MARGIN = 0.22; // 22%
const BENCHMARK_NET_MARGIN = 0.085; // 8.5%

const Profitability = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('netMargin');

  const { data, isLoading, error, refetch, isFetching } = useProfitabilityDashboard();

  // Transform and filter jobs
  const filteredJobs = useMemo(() => {
    if (!data?.all_jobs) return [];

    let result = data.all_jobs.map((job: JobProfitability) => ({
      ...job,
      // Parse numeric values for calculations
      revenue: parseNumeric(job.total_contract),
      directCosts: parseNumeric(job.total_direct),
      overhead: parseNumeric(job.total_overhead),
      totalCost: parseNumeric(job.total_cost),
      grossProfit: parseNumeric(job.gross_profit),
      grossMargin: parseNumeric(job.gross_margin),
      netProfit: parseNumeric(job.net_profit),
      netMargin: parseNumeric(job.net_margin),
      percentComplete: parseNumeric(job.percent_complete),
    }));

    if (statusFilter !== 'all') {
      result = result.filter(job => job.job_status === statusFilter);
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortBy === 'netMargin') return b.netMargin - a.netMargin;
      if (sortBy === 'grossMargin') return b.grossMargin - a.grossMargin;
      if (sortBy === 'revenue') return b.revenue - a.revenue;
      if (sortBy === 'netProfit') return b.netProfit - a.netProfit;
      return 0;
    });

    return result;
  }, [data?.all_jobs, statusFilter, sortBy]);

  // Calculate totals from filtered jobs
  const totals = useMemo(() => {
    return filteredJobs.reduce((acc, job) => ({
      revenue: acc.revenue + job.revenue,
      directCosts: acc.directCosts + job.directCosts,
      grossProfit: acc.grossProfit + job.grossProfit,
      overhead: acc.overhead + job.overhead,
      netProfit: acc.netProfit + job.netProfit,
      // Estimate cost breakdown (these will be calculated from actual data when available)
      laborCost: acc.laborCost + (job.directCosts * 0.35),
      materialCost: acc.materialCost + (job.directCosts * 0.45),
      subcontractorCost: acc.subcontractorCost + (job.directCosts * 0.20),
    }), {
      revenue: 0,
      directCosts: 0,
      grossProfit: 0,
      overhead: 0,
      netProfit: 0,
      laborCost: 0,
      materialCost: 0,
      subcontractorCost: 0,
    });
  }, [filteredJobs]);

  const avgGrossMargin = totals.revenue > 0 ? totals.grossProfit / totals.revenue : 0;
  const avgNetMargin = totals.revenue > 0 ? totals.netProfit / totals.revenue : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading profitability data...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-destructive">Failed to load profitability data</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Profitability Analysis</h1>
            <p className="text-sm text-muted-foreground">Job-level profit tracking and margin analysis</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pre-construction">Pre-Con</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="netMargin">Net Margin</SelectItem>
                <SelectItem value="grossMargin">Gross Margin</SelectItem>
                <SelectItem value="netProfit">Net Profit</SelectItem>
                <SelectItem value="revenue">Revenue</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-semibold">{formatCurrency(totals.revenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">{filteredJobs.length} jobs</p>
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Net Profit</p>
                  <p className="text-2xl font-semibold text-green-600">{formatCurrency(totals.netProfit)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">After overhead</p>
            </CardContent>
          </Card>

          <Card className={`stat-card border-l-4 ${avgGrossMargin >= BENCHMARK_GROSS_MARGIN ? 'border-l-green-500' : 'border-l-amber-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Gross Margin</p>
                  <p className="text-2xl font-semibold">{formatPercent(avgGrossMargin)}</p>
                </div>
                <Percent className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center gap-1 mt-1">
                {avgGrossMargin >= BENCHMARK_GROSS_MARGIN ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <p className="text-xs text-muted-foreground">
                  Benchmark: {formatPercent(BENCHMARK_GROSS_MARGIN)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className={`stat-card border-l-4 ${avgNetMargin >= BENCHMARK_NET_MARGIN ? 'border-l-green-500' : 'border-l-amber-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Net Margin</p>
                  <p className="text-2xl font-semibold">{formatPercent(avgNetMargin)}</p>
                </div>
                <Target className="h-8 w-8 text-primary" />
              </div>
              <div className="flex items-center gap-1 mt-1">
                {avgNetMargin >= BENCHMARK_NET_MARGIN ? (
                  <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
                <p className="text-xs text-muted-foreground">
                  Benchmark: {formatPercent(BENCHMARK_NET_MARGIN)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profitability Tabs */}
        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">Job Profitability</TabsTrigger>
            <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
            <TabsTrigger value="benchmark">Benchmarks</TabsTrigger>
          </TabsList>

          <TabsContent value="jobs">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Direct Costs</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Gross Margin</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Net Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No jobs found matching the selected filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {filteredJobs.map((job) => {
                        const isHealthy = job.netMargin >= BENCHMARK_NET_MARGIN;
                        const isWarning = job.netMargin < BENCHMARK_NET_MARGIN && job.netMargin > 0;
                        const isDanger = job.netMargin <= 0;

                        return (
                          <TableRow key={job.job_id}>
                            <TableCell className="font-medium">{job.job_name}</TableCell>
                            <TableCell>
                              <Badge variant={job.job_status === 'active' ? 'default' : 'secondary'}>
                                {job.job_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(job.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(job.directCosts)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(job.grossProfit)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Progress
                                  value={job.grossMargin * 100}
                                  className="h-2 w-16"
                                />
                                <span className="w-12">{formatPercent(job.grossMargin)}</span>
                              </div>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${isDanger ? 'text-red-600' : isHealthy ? 'text-green-600' : ''}`}>
                              {formatCurrency(job.netProfit)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant={isDanger ? 'destructive' : isWarning ? 'secondary' : 'default'}
                                className={isHealthy ? 'bg-green-100 text-green-800' : ''}
                              >
                                {formatPercent(job.netMargin)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals Row */}
                      <TableRow className="font-semibold bg-muted/50">
                        <TableCell colSpan={2}>Totals / Weighted Average</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.directCosts)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totals.grossProfit)}</TableCell>
                        <TableCell className="text-right">{formatPercent(avgGrossMargin)}</TableCell>
                        <TableCell className="text-right text-green-600">{formatCurrency(totals.netProfit)}</TableCell>
                        <TableCell className="text-right">{formatPercent(avgNetMargin)}</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="costs">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost Distribution</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {totals.directCosts > 0 ? (
                    <>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Labor</span>
                          <span className="font-medium">{formatCurrency(totals.laborCost)}</span>
                        </div>
                        <Progress value={(totals.laborCost / totals.directCosts) * 100} className="h-3" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {((totals.laborCost / totals.directCosts) * 100).toFixed(1)}% of direct costs
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Materials</span>
                          <span className="font-medium">{formatCurrency(totals.materialCost)}</span>
                        </div>
                        <Progress value={(totals.materialCost / totals.directCosts) * 100} className="h-3 [&>div]:bg-amber-500" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {((totals.materialCost / totals.directCosts) * 100).toFixed(1)}% of direct costs
                        </p>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Subcontractors</span>
                          <span className="font-medium">{formatCurrency(totals.subcontractorCost)}</span>
                        </div>
                        <Progress value={(totals.subcontractorCost / totals.directCosts) * 100} className="h-3 [&>div]:bg-blue-500" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {((totals.subcontractorCost / totals.directCosts) * 100).toFixed(1)}% of direct costs
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">No cost data available</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Profit Waterfall</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm">Total Revenue</span>
                    <span className="font-semibold">{formatCurrency(totals.revenue)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b text-red-600">
                    <span className="text-sm">− Direct Costs</span>
                    <span className="font-medium">({formatCurrency(totals.directCosts)})</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm font-medium">Gross Profit</span>
                    <span className="font-semibold">{formatCurrency(totals.grossProfit)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b text-red-600">
                    <span className="text-sm">− Overhead Allocation</span>
                    <span className="font-medium">({formatCurrency(totals.overhead)})</span>
                  </div>
                  <div className="flex justify-between items-center py-2 bg-green-50 dark:bg-green-900/20 px-3 -mx-3 rounded-lg">
                    <span className="text-sm font-semibold">Net Profit</span>
                    <span className="font-bold text-green-600">{formatCurrency(totals.netProfit)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="benchmark">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">NAHB 2024 Industry Benchmarks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <h4 className="font-medium">Gross Margin Comparison</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Your Average</span>
                          <span className={avgGrossMargin >= BENCHMARK_GROSS_MARGIN ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                            {formatPercent(avgGrossMargin)}
                          </span>
                        </div>
                        <Progress value={avgGrossMargin * 100} className="h-3" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Industry Benchmark</span>
                          <span className="font-medium">{formatPercent(BENCHMARK_GROSS_MARGIN)}</span>
                        </div>
                        <Progress value={BENCHMARK_GROSS_MARGIN * 100} className="h-3 [&>div]:bg-muted-foreground" />
                      </div>
                    </div>
                    {avgGrossMargin >= BENCHMARK_GROSS_MARGIN ? (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>Exceeding industry benchmark by {((avgGrossMargin - BENCHMARK_GROSS_MARGIN) * 100).toFixed(1)} points</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Below industry benchmark by {((BENCHMARK_GROSS_MARGIN - avgGrossMargin) * 100).toFixed(1)} points</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Net Margin Comparison</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Your Average</span>
                          <span className={avgNetMargin >= BENCHMARK_NET_MARGIN ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                            {formatPercent(avgNetMargin)}
                          </span>
                        </div>
                        <Progress value={avgNetMargin * 100 * 4} className="h-3" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Industry Benchmark</span>
                          <span className="font-medium">{formatPercent(BENCHMARK_NET_MARGIN)}</span>
                        </div>
                        <Progress value={BENCHMARK_NET_MARGIN * 100 * 4} className="h-3 [&>div]:bg-muted-foreground" />
                      </div>
                    </div>
                    {avgNetMargin >= BENCHMARK_NET_MARGIN ? (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <span>Exceeding industry benchmark by {((avgNetMargin - BENCHMARK_NET_MARGIN) * 100).toFixed(1)} points</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 text-sm">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Below industry benchmark by {((BENCHMARK_NET_MARGIN - avgNetMargin) * 100).toFixed(1)} points</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Profitability;
