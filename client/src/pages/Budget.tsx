import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { formatCurrency } from '@/data/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  FileText,
  Download,
  Plus,
  Pencil,
} from 'lucide-react';
import { useJob } from '@/contexts/JobContext';
import { useBudgetSummary, useBudgetLines, type BudgetLine } from '@/hooks/useBudget';
import { useCostCodes } from '@/hooks/useFinancialData';
import { BudgetLineFormDialog } from '@/components/budgets/BudgetLineFormDialog';

const Budget = () => {
  const { selectedJobId } = useJob();
  const { data: budgetCategories = [], isLoading } = useBudgetSummary(selectedJobId || undefined);
  const { data: budgetLines = [] } = useBudgetLines(selectedJobId || undefined);
  const { data: costCodes = [] } = useCostCodes();

  // Dialog state
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);

  // Get existing cost code IDs to prevent duplicates
  const existingCostCodeIds = budgetLines.map(bl => bl.cost_code_id);

  const handleAddBudgetLine = () => {
    setEditingLine(null);
    setFormDialogOpen(true);
  };

  const handleEditBudgetLine = (category: typeof budgetCategories[0]) => {
    // Find the budget line that matches this category
    const budgetLine = budgetLines.find(bl => bl.cost_code_id === category.cost_code_id);
    if (budgetLine) {
      setEditingLine(budgetLine);
      setFormDialogOpen(true);
    }
  };

  const totals = useMemo(() => {
    return budgetCategories.reduce((acc, cat) => ({
      budget: acc.budget + cat.budget,
      committed: acc.committed + cat.committed,
      actual: acc.actual + cat.actual,
      forecast: acc.forecast + cat.forecast,
    }), { budget: 0, committed: 0, actual: 0, forecast: 0 });
  }, [budgetCategories]);

  const variance = totals.forecast - totals.budget;
  const variancePercent = totals.budget > 0 ? (variance / totals.budget) * 100 : 0;
  const remainingBudget = totals.budget - totals.actual;
  const committedPercent = totals.budget > 0 ? (totals.committed / totals.budget) * 100 : 0;

  // Get unique categories from cost codes for grouping
  const categories = useMemo(() => {
    return [...new Set(costCodes.map(cc => cc.category).filter(Boolean))].sort();
  }, [costCodes]);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Budget Tracking</h1>
            <p className="text-sm text-muted-foreground">Monitor job budgets, costs, and forecasts</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2" onClick={handleAddBudgetLine} disabled={!selectedJobId}>
              <Plus className="h-4 w-4" />
              Add Budget Line
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="stat-card border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Budget</p>
                  <p className="text-2xl font-semibold">{formatCurrency(totals.budget)}</p>
                </div>
                <Calculator className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {budgetCategories.length} cost code{budgetCategories.length !== 1 ? 's' : ''} budgeted
              </p>
            </CardContent>
          </Card>
          
          <Card className="stat-card border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Committed</p>
                  <p className="text-2xl font-semibold">{formatCurrency(totals.committed)}</p>
                </div>
                <FileText className="h-8 w-8 text-amber-500" />
              </div>
              <div className="mt-2">
                <Progress value={committedPercent} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">{committedPercent.toFixed(1)}% of budget</p>
              </div>
            </CardContent>
          </Card>

          <Card className="stat-card border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Actual Spent</p>
                  <p className="text-2xl font-semibold">{formatCurrency(totals.actual)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {formatCurrency(remainingBudget)} remaining
              </p>
            </CardContent>
          </Card>

          <Card className={`stat-card border-l-4 ${variance > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Forecast Variance</p>
                  <p className={`text-2xl font-semibold ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                  </p>
                </div>
                {variance > 0 ? (
                  <TrendingUp className="h-8 w-8 text-red-500" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-green-500" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {variance > 0 ? '+' : ''}{variancePercent.toFixed(1)}% from budget
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Budget Tabs */}
        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="summary">Cost Summary</TabsTrigger>
            <TabsTrigger value="variance">Variance Analysis</TabsTrigger>
            <TabsTrigger value="trends">Cost Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Budget by Cost Code</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : budgetCategories.length === 0 ? (
                  <div className="text-center py-12">
                    <Calculator className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-medium mb-2">No Budget Lines</h3>
                    <p className="text-muted-foreground mb-4">
                      {selectedJobId 
                        ? 'Add budget lines to this job to start tracking costs by cost code.'
                        : 'Select a job to view its budget, or add budget lines to get started.'}
                    </p>
                    <Button className="gap-2" onClick={handleAddBudgetLine} disabled={!selectedJobId}>
                      <Plus className="h-4 w-4" />
                      Add Budget Line
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Cost Code</TableHead>
                        <TableHead className="text-right">Budget</TableHead>
                        <TableHead className="text-right">Committed</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Forecast</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="w-32">Progress</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {budgetCategories.map((category) => {
                        const catVariance = category.forecast - category.budget;
                        const actualPercent = category.budget > 0 ? (category.actual / category.budget) * 100 : 0;
                        const isOverBudget = category.forecast > category.budget;
                        
                        return (
                          <TableRow key={category.cost_code_id}>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEditBudgetLine(category)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{category.code}</TableCell>
                            <TableCell className="font-medium">{category.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(category.budget)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(category.committed)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(category.actual)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(category.forecast)}</TableCell>
                            <TableCell className="text-right">
                              <span className={isOverBudget ? 'text-red-600' : 'text-green-600'}>
                                {catVariance > 0 ? '+' : ''}{formatCurrency(catVariance)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress 
                                  value={Math.min(actualPercent, 100)} 
                                  className={`h-2 flex-1 ${isOverBudget ? '[&>div]:bg-red-500' : ''}`}
                                />
                                <span className="text-xs text-muted-foreground w-10">
                                  {actualPercent.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals Row */}
                      {budgetCategories.length > 0 && (
                        <TableRow className="font-semibold bg-muted/50">
                          <TableCell></TableCell>
                          <TableCell></TableCell>
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{formatCurrency(totals.budget)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totals.committed)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totals.actual)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(totals.forecast)}</TableCell>
                          <TableCell className={`text-right ${variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {variance > 0 ? '+' : ''}{formatCurrency(variance)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variance">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Variance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {budgetCategories
                      .filter(cat => cat.forecast > cat.budget)
                      .sort((a, b) => (b.forecast - b.budget) - (a.forecast - a.budget))
                      .map((category) => {
                        const catVariance = category.forecast - category.budget;
                        const variancePercent = category.budget > 0 ? (catVariance / category.budget) * 100 : 0;
                        
                        return (
                          <div key={category.cost_code_id} className="flex items-center gap-4 p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
                            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">{category.code}</span>
                                <span className="font-medium">{category.name}</span>
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                Forecasted to exceed budget by {formatCurrency(catVariance)} ({variancePercent.toFixed(1)}%)
                              </p>
                            </div>
                            <Badge variant="destructive">
                              +{formatCurrency(catVariance)}
                            </Badge>
                          </div>
                        );
                      })}
                    
                    {budgetCategories.filter(cat => cat.forecast > cat.budget).length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        {budgetCategories.length === 0 
                          ? 'Add budget lines to track variance analysis'
                          : 'All categories are within budget'}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="trends">
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Cost trend charts and historical analysis coming soon</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Budget Line Form Dialog */}
        {selectedJobId && (
          <BudgetLineFormDialog
            open={formDialogOpen}
            onOpenChange={setFormDialogOpen}
            budgetLine={editingLine}
            jobId={selectedJobId}
            existingCostCodeIds={existingCostCodeIds}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Budget;
