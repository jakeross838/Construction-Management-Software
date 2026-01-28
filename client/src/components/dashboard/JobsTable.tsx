import { cn } from '@/lib/utils';
import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DBJob, formatCurrency } from '@/types/financial';

interface JobsTableProps {
  jobs: DBJob[];
}

const statusConfig: Record<string, { label: string; class: string }> = {
  active: { label: 'Active', class: 'status-badge-success' },
  completed: { label: 'Completed', class: 'status-badge-info' },
  'on-hold': { label: 'On Hold', class: 'status-badge-warning' },
  on_hold: { label: 'On Hold', class: 'status-badge-warning' },
  pre_construction: { label: 'Pre-Con', class: 'status-badge-info' },
  closed: { label: 'Closed', class: 'status-badge-default' },
  planning: { label: 'Planning', class: 'status-badge-info' },
};

export function JobsTable({ jobs }: JobsTableProps) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Active Jobs</h3>
            <p className="text-sm text-muted-foreground">Real-time profitability tracking</p>
          </div>
        </div>
        <Badge variant="outline">{jobs.length} jobs</Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th className="text-right">Contract</th>
              <th className="text-right">Budget</th>
              <th>Progress</th>
              <th className="text-right">Target Margin</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-muted-foreground">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const progress = job.percent_complete || 0;
                const status = statusConfig[job.status] || { label: job.status, class: '' };
                
                return (
                  <tr key={job.id} className="cursor-pointer">
                    <td>
                      <div>
                        <p className="font-medium">{job.name}</p>
                        <p className="text-sm text-muted-foreground">{job.client || 'No client'}</p>
                      </div>
                    </td>
                    <td>
                      <span className={cn("status-badge", status.class)}>
                        {status.label}
                      </span>
                    </td>
                    <td className="text-right font-mono">{formatCurrency(job.contract_amount || 0)}</td>
                    <td className="text-right font-mono">{formatCurrency(job.budget_amount || 0)}</td>
                    <td className="min-w-32">
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2" />
                        <span className="text-xs text-muted-foreground font-mono w-10">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="text-right">
                      <span className={cn(
                        "font-mono font-medium",
                        (job.target_margin || 0) >= 20 ? "text-profit" : (job.target_margin || 0) >= 15 ? "text-warning" : "text-loss"
                      )}>
                        {job.target_margin || 0}%
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}