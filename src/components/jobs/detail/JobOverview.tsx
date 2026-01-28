import { DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/job';
import { formatCurrency, formatCurrencyFull } from '@/types/job';

interface JobOverviewProps {
  job: Job;
}

export function JobOverview({ job }: JobOverviewProps) {
  const budgetProgress = (job.spent / job.budget) * 100;
  const laborProgress = (job.laborHours / job.estimatedHours) * 100;
  const remaining = job.budget - job.spent;
  const laborRemaining = job.estimatedHours - job.laborHours;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Budget */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-primary/10 p-2">
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Contract Value</p>
            <p className="text-xl font-bold font-mono">{formatCurrency(job.budget)}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-mono">{formatCurrency(job.spent)}</span>
          </div>
          <Progress value={budgetProgress} className="h-2" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{budgetProgress.toFixed(0)}% used</span>
            <span className="text-profit font-mono">{formatCurrency(remaining)} remaining</span>
          </div>
        </div>
      </div>

      {/* Labor Hours */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-secondary/50 p-2">
            <Clock className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Labor Hours</p>
            <p className="text-xl font-bold font-mono">{job.laborHours.toLocaleString()}</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Estimated</span>
            <span className="font-mono">{job.estimatedHours.toLocaleString()}</span>
          </div>
          <Progress value={laborProgress} className="h-2" />
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">{laborProgress.toFixed(0)}% complete</span>
            <span className="font-mono">{laborRemaining.toLocaleString()} hrs remaining</span>
          </div>
        </div>
      </div>

      {/* Margin */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn(
            "rounded-lg p-2",
            job.margin >= 20 ? "bg-profit/20" : job.margin >= 15 ? "bg-warning/20" : "bg-loss/20"
          )}>
            <TrendingUp className={cn(
              "h-5 w-5",
              job.margin >= 20 ? "text-profit" : job.margin >= 15 ? "text-warning" : "text-loss"
            )} />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current Margin</p>
            <p className={cn(
              "text-xl font-bold font-mono",
              job.margin >= 20 ? "text-profit" : job.margin >= 15 ? "text-warning" : "text-loss"
            )}>
              {job.margin}%
            </p>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross Profit</span>
            <span className="font-mono text-profit">
              {formatCurrencyFull((job.budget - job.spent) * (job.margin / 100))}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target</span>
            <span className="font-mono">20%</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-lg bg-warning/20 p-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Alerts</p>
            <p className="text-xl font-bold">2</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
            <span>Pending change order: $35K</span>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
            <span>Labor tracking 49% (budget at 48%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
