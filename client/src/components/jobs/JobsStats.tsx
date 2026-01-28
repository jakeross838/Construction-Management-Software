import type { Job } from '@/types/job';
import { formatCurrency } from '@/types/job';

interface JobsStatsProps {
  jobs: Job[];
}

export function JobsStats({ jobs }: JobsStatsProps) {
  const activeJobs = jobs.filter(j => j.status === 'active').length;
  const totalContractValue = jobs.reduce((sum, j) => sum + j.budget, 0);
  const avgMargin = jobs.reduce((sum, j) => sum + j.margin, 0) / jobs.length;

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Jobs</p>
        <p className="text-2xl font-bold">{jobs.length}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Active</p>
        <p className="text-2xl font-bold text-profit">{activeJobs}</p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Total Contract Value</p>
        <p className="text-2xl font-bold font-mono">
          {formatCurrency(totalContractValue)}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Avg Margin</p>
        <p className="text-2xl font-bold font-mono text-profit">
          {avgMargin.toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
