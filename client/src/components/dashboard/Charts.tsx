import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { DBJob } from '@/types/financial';

interface ChartProps {
  selectedJobId?: string | null;
  jobs: DBJob[];
}

// Generate revenue data based on job selection
const generateRevenueData = (jobs: DBJob[]) => {
  const totalBudget = jobs.reduce((sum, j) => sum + (j.contract_amount || 0), 0);
  const avgPercent = jobs.reduce((sum, j) => sum + (j.percent_complete || 0), 0) / Math.max(jobs.length, 1);
  const totalSpent = totalBudget * (avgPercent / 100);
  
  // Generate monthly data proportionally
  const monthlyFactor = [0.12, 0.11, 0.15, 0.14, 0.16, 0.18, 0.14];
  const months = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'];
  
  return months.map((month, i) => ({
    month,
    revenue: Math.round(totalBudget * monthlyFactor[i]),
    costs: Math.round(totalSpent * monthlyFactor[i]),
  }));
};

const generateExpenseBreakdown = (jobs: DBJob[]) => {
  // Different breakdown based on job count for variety
  if (jobs.length === 1) {
    const job = jobs[0];
    // Vary breakdown based on construction type
    if (job.construction_type === 'remodel') {
      return [
        { name: 'Labor', value: 52, color: 'hsl(38, 92%, 50%)' },
        { name: 'Materials', value: 28, color: 'hsl(199, 89%, 48%)' },
        { name: 'Overhead', value: 12, color: 'hsl(142, 71%, 45%)' },
        { name: 'Equipment', value: 8, color: 'hsl(280, 65%, 60%)' },
      ];
    }
    return [
      { name: 'Labor', value: 48, color: 'hsl(38, 92%, 50%)' },
      { name: 'Materials', value: 32, color: 'hsl(199, 89%, 48%)' },
      { name: 'Overhead', value: 14, color: 'hsl(142, 71%, 45%)' },
      { name: 'Equipment', value: 6, color: 'hsl(280, 65%, 60%)' },
    ];
  }
  
  return [
    { name: 'Labor', value: 45, color: 'hsl(38, 92%, 50%)' },
    { name: 'Materials', value: 35, color: 'hsl(199, 89%, 48%)' },
    { name: 'Overhead', value: 12, color: 'hsl(142, 71%, 45%)' },
    { name: 'Equipment', value: 8, color: 'hsl(280, 65%, 60%)' },
  ];
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-popover p-3 shadow-xl">
        <p className="text-sm font-medium mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="h-2 w-2 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground capitalize">{entry.name}:</span>
            <span className="font-mono font-medium">
              ${(entry.value / 1000).toFixed(0)}k
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function RevenueChart({ selectedJobId, jobs }: ChartProps) {
  const revenueData = useMemo(() => generateRevenueData(jobs), [jobs]);
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-profit/10 p-2">
            <TrendingUp className="h-5 w-5 text-profit" />
          </div>
          <div>
            <h3 className="font-semibold">Revenue vs Costs</h3>
            <p className="text-sm text-muted-foreground">
              {selectedJob ? `${selectedJob.name} - 7 month trend` : 'Last 7 months performance'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Revenue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-info" />
            <span className="text-sm text-muted-foreground">Costs</span>
          </div>
        </div>
      </div>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={revenueData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="costsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0}/>
              </linearGradient>
            </defs>
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
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="hsl(38, 92%, 50%)" 
              strokeWidth={2}
              fill="url(#revenueGradient)" 
            />
            <Area 
              type="monotone" 
              dataKey="costs" 
              stroke="hsl(199, 89%, 48%)" 
              strokeWidth={2}
              fill="url(#costsGradient)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function ExpenseBreakdownChart({ selectedJobId, jobs }: ChartProps) {
  const expenseBreakdown = useMemo(() => generateExpenseBreakdown(jobs), [jobs]);
  const selectedJob = selectedJobId ? jobs.find(j => j.id === selectedJobId) : null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-6">
        <h3 className="font-semibold">Expense Breakdown</h3>
        <p className="text-sm text-muted-foreground">
          {selectedJob ? `${selectedJob.name} costs` : 'Cost distribution by category'}
        </p>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="h-48 w-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseBreakdown}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={4}
                dataKey="value"
              >
                {expenseBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 space-y-3 pl-6">
          {expenseBreakdown.map((item) => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="h-3 w-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm">{item.name}</span>
              </div>
              <span className="font-mono font-medium">{item.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}