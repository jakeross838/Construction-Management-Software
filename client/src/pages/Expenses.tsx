import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ExpenseFormDialog } from '@/components/expenses/ExpenseFormDialog';
import {
  DollarSign,
  TrendingUp,
  Plus,
  Filter,
  Download,
  Receipt,
  Truck,
  Building,
  Users,
  Wrench,
  Shield,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Trash2,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  useExpenses,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  categoryConfig,
  frequencyConfig,
  calculateAnnualAmount,
  formatCurrency,
  type Expense,
  type ExpenseCategory,
  type ExpenseStatus,
} from '@/hooks/useExpenses';
import { format, isAfter, isBefore, addDays } from 'date-fns';

const categoryIcons: Record<ExpenseCategory, React.ComponentType<{ className?: string }>> = {
  'labor-burden': Users,
  'fleet': Truck,
  'office': Building,
  'professional': Receipt,
  'tools': Wrench,
  'insurance': Shield,
  'marketing': Megaphone,
};

const Expenses = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | 'all'>('active');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');

  const { data: expenses = [], isLoading } = useExpenses(statusFilter);
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();

  const filteredExpenses = expenses.filter(
    (e) => categoryFilter === 'all' || e.category === categoryFilter
  );

  // Calculate metrics
  const monthlyTotal = filteredExpenses
    .filter((e) => e.status === 'active' && e.recurring && e.frequency === 'monthly')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const annualTotal = filteredExpenses
    .filter((e) => e.status === 'active')
    .reduce((sum, e) => sum + calculateAnnualAmount(Number(e.amount), e.frequency, e.recurring), 0);

  const laborBurdenTotal = filteredExpenses
    .filter((e) => e.status === 'active' && e.category === 'labor-burden')
    .reduce((sum, e) => sum + calculateAnnualAmount(Number(e.amount), e.frequency, e.recurring), 0);

  // Upcoming due dates (next 7 days)
  const upcomingDue = filteredExpenses.filter((e) => {
    if (!e.next_due_date || e.status !== 'active') return false;
    const dueDate = new Date(e.next_due_date);
    const now = new Date();
    return isAfter(dueDate, now) && isBefore(dueDate, addDays(now, 7));
  });

  // Category breakdown for pie chart
  const categoryTotals = filteredExpenses
    .filter((e) => e.status === 'active')
    .reduce((acc, e) => {
      const annual = calculateAnnualAmount(Number(e.amount), e.frequency, e.recurring);
      acc[e.category] = (acc[e.category] || 0) + annual;
      return acc;
    }, {} as Record<string, number>);

  const pieData = Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      name: categoryConfig[category as ExpenseCategory].label,
      value: amount,
      color: categoryConfig[category as ExpenseCategory].color,
    }))
    .sort((a, b) => b.value - a.value);

  // Monthly trend data (simulated based on current data)
  const monthlyData = [
    { month: 'Aug', amount: annualTotal / 12 * 0.92 },
    { month: 'Sep', amount: annualTotal / 12 * 0.95 },
    { month: 'Oct', amount: annualTotal / 12 * 0.94 },
    { month: 'Nov', amount: annualTotal / 12 * 0.98 },
    { month: 'Dec', amount: annualTotal / 12 * 1.02 },
    { month: 'Jan', amount: annualTotal / 12 },
  ];

  const handleSave = (data: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'vendor'>) => {
    if (editingExpense) {
      updateExpense.mutate({ id: editingExpense.id, ...data });
    } else {
      createExpense.mutate(data);
    }
    setEditingExpense(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setExpenseToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (expenseToDelete) {
      deleteExpense.mutate(expenseToDelete);
      setExpenseToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  return (
    <AppLayout hideJobSidebar>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Company Expenses</h1>
            <p className="text-muted-foreground">
              Track overhead, labor burden, insurance, and operating costs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={() => { setEditingExpense(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Monthly Overhead"
            value={isLoading ? '...' : formatCurrency(monthlyTotal)}
            icon={DollarSign}
            change={{ value: 2.6, label: 'vs last month' }}
            trend="up"
          />
          <MetricCard
            title="Annual Projection"
            value={isLoading ? '...' : formatCurrency(annualTotal)}
            icon={TrendingUp}
            change={{ value: 8.2, label: 'vs last year' }}
            trend="up"
          />
          <MetricCard
            title="Labor Burden"
            value={isLoading ? '...' : formatCurrency(laborBurdenTotal)}
            icon={Users}
            change={{ value: -1.2, label: 'reduction' }}
            trend="up"
          />
          <MetricCard
            title="Due This Week"
            value={isLoading ? '...' : upcomingDue.length.toString()}
            icon={Calendar}
            change={{ value: upcomingDue.length, label: 'payments' }}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Trend chart */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Monthly Overhead Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="month"
                    className="text-muted-foreground"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    className="text-muted-foreground"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                  />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Category Breakdown (Annual)</h3>
            <div className="flex items-center gap-6">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <span className="font-mono text-sm">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Expense list */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border px-6 py-4">
            <h3 className="font-semibold">All Expenses</h3>
            <div className="flex items-center gap-2">
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as ExpenseCategory | 'all')}>
                <SelectTrigger className="w-full sm:w-44">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {Object.entries(categoryConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ExpenseStatus | 'all')}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No expenses found</h3>
              <p className="text-muted-foreground mb-4">
                Start tracking your company overhead by adding your first expense.
              </p>
              <Button onClick={() => { setEditingExpense(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Expense
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Expense</th>
                    <th>Vendor</th>
                    <th>Frequency</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Annual</th>
                    <th>Next Due</th>
                    <th>Status</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExpenses.map((expense) => {
                    const config = categoryConfig[expense.category];
                    const Icon = categoryIcons[expense.category];
                    const annualAmount = calculateAnnualAmount(
                      Number(expense.amount),
                      expense.frequency,
                      expense.recurring
                    );
                    const isDueSoon =
                      expense.next_due_date &&
                      isBefore(new Date(expense.next_due_date), addDays(new Date(), 7));

                    return (
                      <tr
                        key={expense.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleEdit(expense)}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <div
                              className="rounded p-1.5 flex items-center justify-center"
                              style={{ backgroundColor: `${config.color}20`, color: config.color }}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className="text-sm">{config.label}</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <div className="font-medium">{expense.name}</div>
                            {expense.description && (
                              <div className="text-xs text-muted-foreground">
                                {expense.description}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="text-muted-foreground">
                          {expense.vendor?.name || '-'}
                        </td>
                        <td>
                          {expense.recurring ? (
                            <Badge variant="outline" className="capitalize">
                              {expense.frequency}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">One-time</Badge>
                          )}
                        </td>
                        <td className="text-right font-mono">
                          {formatCurrency(Number(expense.amount))}
                        </td>
                        <td className="text-right font-mono text-muted-foreground">
                          {formatCurrency(annualAmount)}
                        </td>
                        <td>
                          {expense.next_due_date ? (
                            <span
                              className={
                                isDueSoon ? 'text-warning font-medium' : 'text-muted-foreground'
                              }
                            >
                              {format(new Date(expense.next_due_date), 'MMM d, yyyy')}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td>
                          <Badge
                            variant={
                              expense.status === 'active'
                                ? 'default'
                                : expense.status === 'inactive'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {expense.status}
                          </Badge>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(expense)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDelete(expense.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        expense={editingExpense}
        onSave={handleSave}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Expenses;
