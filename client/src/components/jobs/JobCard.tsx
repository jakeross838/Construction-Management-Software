import { Building2, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/job';
import { statusConfig, formatCurrency } from '@/types/job';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface JobCardProps {
  job: Job;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function JobCard({ job, onClick, onEdit, onDelete }: JobCardProps) {
  const budgetProgress = (job.spent / job.budget) * 100;
  const laborProgress = (job.laborHours / job.estimatedHours) * 100;
  const status = statusConfig[job.status];

  return (
    <div 
      onClick={onClick}
      className="group rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 group-hover:bg-primary/20 transition-colors">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold group-hover:text-primary transition-colors">
              {job.name}
            </h3>
            <p className="text-sm text-muted-foreground">{job.client}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("status-badge", status.class)}>
            {status.label}
          </span>
          {(onEdit || onDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">{job.address}</p>

      <div className="space-y-3">
        {/* Budget */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Budget</span>
            <span className="font-mono">
              {formatCurrency(job.spent)} / {formatCurrency(job.budget)}
            </span>
          </div>
          <Progress value={budgetProgress} className="h-1.5" />
        </div>

        {/* Labor Hours */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Labor Hours</span>
            <span className="font-mono">
              {job.laborHours.toLocaleString()} / {job.estimatedHours.toLocaleString()}
            </span>
          </div>
          <Progress value={laborProgress} className="h-1.5" />
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">Phase</p>
          <p className="text-sm font-medium">{job.phase}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Margin</p>
          <p className={cn(
            "text-lg font-bold font-mono",
            job.margin >= 20 ? "text-profit" : job.margin >= 15 ? "text-warning" : "text-loss"
          )}>
            {job.margin}%
          </p>
        </div>
      </div>
    </div>
  );
}
