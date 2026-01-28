import { ArrowLeft, MoreVertical, Edit, Trash2, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Job } from '@/types/job';
import { statusConfig } from '@/types/job';

interface JobDetailHeaderProps {
  job: Job;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function JobDetailHeader({ job, onBack, onEdit, onDelete }: JobDetailHeaderProps) {
  const status = statusConfig[job.status];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.name}</h1>
            <span className={cn("status-badge", status.class)}>
              {status.label}
            </span>
          </div>
          <p className="text-muted-foreground">{job.client}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Job
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Clock className="h-4 w-4 mr-2" />
              View Timeline
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-4 w-4" />
          {job.address}
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          {job.startDate} — {job.targetCompletion}
        </div>
        <div className="px-2 py-1 bg-muted rounded text-xs font-medium">
          {job.phase}
        </div>
      </div>
    </div>
  );
}
